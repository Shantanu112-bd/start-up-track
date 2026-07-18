import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { SorobanService } from '../stellar';
import { SettlementService } from '../settlement/settlement.service';
import { RewardStatus, TransactionStatus } from '../generated/prisma';

@Injectable()
export class TransactionProcessorService {
  private readonly logger = new Logger(TransactionProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellarService: StellarService,
    private readonly sorobanService: SorobanService,
    private readonly settlementService: SettlementService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handlePendingTransactions(): Promise<void> {
    // Atomically claim one transaction at a time by updating status first
    // Only process if we successfully moved it from CREATED to AUTHORIZED
    const claimed = await this.prisma.transaction.updateMany({
      where: {
        status: TransactionStatus.CREATED,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: TransactionStatus.AUTHORIZED,
        authorizedAt: new Date(),
      },
    });

    if (claimed.count === 0) return;

    // Now fetch the transactions we just claimed
    const transactions = await this.prisma.transaction.findMany({
      where: {
        status: TransactionStatus.AUTHORIZED,
        authorizedAt: { gte: new Date(Date.now() - 6000) },
      },
      take: 10,
    });

    for (const tx of transactions) {
      await this.processTransactionWithRetry(tx);
    }
  }
  private async processTransactionWithRetry(tx: any, attempt = 1): Promise<void> {
    const MAX_ATTEMPTS = 3;
    const BACKOFF_MS = [0, 2000, 8000];

    try {
      await this.processTransaction(tx, attempt);
    } catch (error: any) {
      this.logger.warn(`Transaction ${tx.id} failed on attempt ${attempt}: ${error.message}`);

      if (attempt < MAX_ATTEMPTS) {
        const delay = BACKOFF_MS[attempt] || 8000;
        this.logger.log(`Retrying transaction ${tx.id} in ${delay}ms (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.processTransactionWithRetry(tx, attempt + 1);
      }

      this.logger.error(`Transaction ${tx.id} permanently failed after ${MAX_ATTEMPTS} attempts`);
      
      const metadata = tx.metadata && typeof tx.metadata === 'object' ? tx.metadata : {};
      
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.FAILED,
          failureCode: 'MAX_RETRIES_EXCEEDED',
          failureMessage: `Failed after ${MAX_ATTEMPTS} attempts. Last error: ${error.message}`,
          metadata: { ...metadata, retryAttempts: attempt },
        },
      });
    }
  }

  private async processTransaction(tx: any, attempt: number) {
    this.logger.log(`Processing transaction ${tx.id} with status ${tx.status}`);

    // Declare variables at function scope for catch block access
    let hash: string | undefined;
    let ledger: number | undefined;
    let rewardResult: { hash: string; starAmount: bigint } | undefined;

    try {
      // Step 1: Create payment on PaymentEngine contract
      await this.updateStatus(tx.id, TransactionStatus.AUTHORIZED);

      const reward = await this.prisma.reward.findFirst({
        where: { transactionId: tx.id, reason: 'SPEND' },
      });

      if (!reward) {
        throw new Error('No spend reward found for transaction');
      }

      const qrCode = tx.merchantQrCodeId
        ? await this.prisma.merchantQrCode.findUnique({ where: { id: tx.merchantQrCodeId } })
        : null;

      const qrHash = qrCode?.qrPayloadHash ?? tx.qrPayloadHash ?? '0'.repeat(64);

      // Get payer wallet address
      const wallet = tx.walletId
        ? await this.prisma.wallet.findUnique({ where: { id: tx.walletId } })
        : null;
      const payerWallet = wallet?.address ?? '';

      await this.sorobanService.createPayment({
        paymentId: tx.id,
        payer: payerWallet,
        merchantId: tx.merchantId,
        asset: tx.assetIn as 'XLM' | 'USDC' | 'ETH' | 'BTC' | 'SOL',
        amountInPaise: tx.amountInPaise,
        qrHash,
        rewardId: reward.id,
      });

      await this.updateStatus(tx.id, TransactionStatus.QUOTED);

      // Step 2: Quote payment on PaymentEngine
      const quoteRate = Number(tx.quoteRateInrPerAsset);
      const usdcRate = await this.getUsdcRate();
      const usdcAmount = BigInt(Math.round((Number(tx.amountInPaise) / 100) / usdcRate * 1_000_000)); // USDC has 6 decimals
      const assetAmount = BigInt(Math.round((Number(tx.amountInPaise) / 100) / quoteRate * 10_000_000)); // asset has 7 decimals
      const networkFeePaise = BigInt(0);

      await this.sorobanService.quotePayment({
        paymentId: tx.id,
        assetAmount,
        usdcAmount,
        networkFeePaise,
      });

      await this.updateStatus(tx.id, TransactionStatus.CONVERTING);

      // Step 3: Mark converted
      await this.sorobanService.markConverted(tx.id);
      await this.updateStatus(tx.id, TransactionStatus.ROUTING_STELLAR);

      // Step 4: Submit real Stellar payment
      const stellarResult = await this.stellarService.submitPayment({
        transactionPublicId: tx.publicId,
        assetCode: tx.assetIn,
        amountCrypto: tx.amountInCrypto?.toString() || '0.0000001',
      });
      hash = stellarResult.hash;
      ledger = stellarResult.ledger;

      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.SETTLING,
          stellarTransactionHash: hash,
          stellarLedger: BigInt(ledger),
        },
      });
      await this.logEvent(tx.id, TransactionStatus.SETTLING);

      // Step 5: Mark settled on PaymentEngine
      await this.sorobanService.markSettled(tx.id);
      await this.updateStatus(tx.id, TransactionStatus.SETTLING);

      // Step 5.5: Settle via UPI payout to merchant (Decentro integration)
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: tx.merchantId },
        select: { defaultUpiVpa: true, displayName: true },
      });

      if (merchant?.defaultUpiVpa) {
        this.logger.log(`Initiating UPI payout to merchant ${tx.merchantId} (${merchant.defaultUpiVpa})`);
        const settlementResult = await this.settlementService.initiateUpiPayout({
          referenceId: `SETTLE_${tx.id}`,
          amountPaise: tx.amountInPaise,
          merchantUpiVpa: merchant.defaultUpiVpa,
          merchantName: merchant.displayName,
          purpose: `Payment settlement for transaction ${tx.publicId}`,
        });

        await this.prisma.settlementInstruction.updateMany({
          where: { transactionId: tx.id },
          data: {
            status: 'SENT',
            settlementReference: settlementResult.transactionId,
            metadata: { settlementStatus: settlementResult.status },
          },
        });

        this.logger.log(`UPI payout initiated: ${settlementResult.transactionId}, status: ${settlementResult.status}. Settlement will be confirmed by background poller.`);
      } else {
        this.logger.warn(`Merchant ${tx.merchantId} has no UPI VPA, skipping UPI settlement`);
      }

      // Step 6: Issue STAR reward via RewardEngine (called by PaymentEngine.issue_reward)
      rewardResult = await this.sorobanService.issueReward(tx.id);

      // Update reward record with on-chain mint hash
      await this.prisma.reward.updateMany({
        where: { transactionId: tx.id },
        data: {
          status: RewardStatus.MINTED,
          stellarMintHash: rewardResult.hash,
          mintedAt: new Date(),
        },
      });

      await this.updateStatus(tx.id, TransactionStatus.REWARDING);

      // Step 7: Complete payment on PaymentEngine
      await this.sorobanService.completePayment(tx.id);
      await this.updateStatus(tx.id, TransactionStatus.COMPLETED);

      await this.prisma.settlementInstruction.updateMany({
        where: { transactionId: tx.id },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          mockReference: hash,
        },
      });

      // Only log adminLog if hash and rewardResult are defined (success path)
      if (hash && ledger !== undefined && rewardResult) {
        await this.prisma.adminLog.create({
          data: {
            actorUserId: null,
            action: 'TRANSACTION_COMPLETED',
            targetType: 'TRANSACTION',
            targetId: tx.id,
            metadata: {
              stellarHash: hash,
              ledger,
              processorAttempt: attempt,
              starAmount: rewardResult.starAmount.toString(),
            },
          },
        })

        this.logger.log(`Transaction ${tx.id} completed successfully. Stellar Hash: ${hash}, STAR earned: ${rewardResult.starAmount}`);
      }

    } catch (error: any) {
      // Only use hash if it was set before the error
      if (hash) {
        // Transaction reached Stellar submission but failed later - hash exists
        await this.prisma.transaction.update({
          where: { id: tx.id },
          data: { stellarTransactionHash: hash },
        }).catch(() => {});
      }
      await this.updateStatus(
        tx.id,
        TransactionStatus.FAILED,
        'STELLAR_ERROR',
        error.message || 'Unknown error during Stellar routing'
      );
    }
  }

  private async getUsdcRate(): Promise<number> {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=inr');
      const data = await res.json() as Record<string, { inr: number }>;
      return data['usd-coin']?.inr || 83;
    } catch {
      return 83;
    }
  }

  private async updateStatus(
    transactionId: string, 
    status: TransactionStatus, 
    failureCode?: string, 
    failureMessage?: string
  ) {
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status,
        ...(status === TransactionStatus.COMPLETED ? { completedAt: new Date() } : {}),
        ...(failureCode !== undefined ? { failureCode } : {}),
        ...(failureMessage !== undefined ? { failureMessage } : {})
      },
    });
    
    const payload = failureCode ? { failureCode, failureMessage } : undefined;
    await this.logEvent(transactionId, status, payload);
  }

  private async logEvent(transactionId: string, status: TransactionStatus, payload?: any) {
    const maxEvent = await this.prisma.transactionEvent.aggregate({
      _max: { sequence: true },
      where: { transactionId },
    });
    const sequence = (maxEvent._max.sequence ?? 0) + 1;

    await this.prisma.transactionEvent.create({
      data: {
        transactionId,
        status,
        sequence,
        eventType: `transaction.${status.toLowerCase()}`,
        payload: payload || {},
      },
    });
  }

  /**
   * Background cron job to poll for pending UPI settlements
   * Runs every 30 seconds to check Decentro status for SENT settlements
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handlePendingSettlements(): Promise<void> {
    this.logger.debug('Polling for pending UPI settlements...');

    // Find all SENT settlements that are not yet confirmed/failed
    const pendingSettlements = await this.prisma.settlementInstruction.findMany({
      where: {
        status: 'SENT',
        settlementReference: { not: null },
      },
      take: 20,
    });

    if (pendingSettlements.length === 0) {
      return;
    }

    this.logger.log(`Found ${pendingSettlements.length} pending settlements to poll`);

    for (const settlement of pendingSettlements) {
      try {
        const statusResult = await this.settlementService.checkPayoutStatus(settlement.settlementReference!);

        if (statusResult.status === 'SUCCESS' || statusResult.status === 'COMPLETED') {
          await this.prisma.settlementInstruction.update({
            where: { id: settlement.id },
            data: {
              status: 'CONFIRMED',
              confirmedAt: new Date(),
              mockReference: settlement.settlementReference,
              metadata: {
                ...(settlement.metadata as object),
                utrNumber: statusResult.utrNumber,
                settlementStatus: statusResult.status
              },
            },
          });
          this.logger.log(`UPI settlement confirmed: ${settlement.settlementReference}, UTR: ${statusResult.utrNumber}`);
        } else if (statusResult.status === 'FAILED' || statusResult.status === 'REJECTED') {
          await this.prisma.settlementInstruction.update({
            where: { id: settlement.id },
            data: {
              status: 'FAILED',
              failureReason: `Decentro status: ${statusResult.status}`,
            },
          });
          this.logger.warn(`UPI settlement failed: ${settlement.settlementReference}, status: ${statusResult.status}`);
        } else {
          // Still processing - update metadata with latest status
          await this.prisma.settlementInstruction.update({
            where: { id: settlement.id },
            data: {
              metadata: {
                ...(settlement.metadata as object),
                settlementStatus: statusResult.status,
                lastPolledAt: new Date().toISOString(),
              },
            },
          });
        }
      } catch (error: any) {
        this.logger.error(`Failed to poll settlement ${settlement.settlementReference}: ${error.message}`);
      }
    }
  }
}
