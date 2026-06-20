import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { RewardStatus, TransactionStatus } from '../generated/prisma';

@Injectable()
export class TransactionProcessorService {
  private readonly logger = new Logger(TransactionProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellarService: StellarService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handlePendingTransactions() {
    const pendingTransactions = await this.prisma.transaction.findMany({
      where: {
        status: {
          in: [TransactionStatus.CREATED, TransactionStatus.AUTHORIZED],
        },
      },
    });

    for (const tx of pendingTransactions) {
      if (tx.expiresAt && tx.expiresAt < new Date()) {
        await this.updateStatus(tx.id, TransactionStatus.FAILED, 'EXPIRED', 'Transaction expired');
        continue;
      }

      try {
        await this.processTransaction(tx);
      } catch (error) {
        this.logger.error(`Failed to process transaction ${tx.id}`, error);
      }
    }
  }

  private async processTransaction(tx: any) {
    this.logger.log(`Processing transaction ${tx.id} with status ${tx.status}`);

    try {
      if (tx.status === TransactionStatus.CREATED) {
        await this.updateStatus(tx.id, TransactionStatus.AUTHORIZED);
      }

      await this.updateStatus(tx.id, TransactionStatus.ROUTING_STELLAR);

      const { hash } = await this.stellarService.submitPayment({
        transactionPublicId: tx.publicId,
        assetCode: tx.assetIn,
        amountCrypto: tx.amountInCrypto?.toString() || '0.0000001',
      });

      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.SETTLING,
          stellarTransactionHash: hash,
        },
      });
      await this.logEvent(tx.id, TransactionStatus.SETTLING);

      await this.prisma.reward.updateMany({
        where: { transactionId: tx.id },
        data: {
          status: RewardStatus.MINTED,
          stellarMintHash: hash,
        },
      });

      await this.prisma.settlementInstruction.updateMany({
        where: { transactionId: tx.id },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          mockReference: hash,
        },
      });

      await this.updateStatus(tx.id, TransactionStatus.COMPLETED);
      
      this.logger.log(`Transaction ${tx.id} completed successfully. Stellar Hash: ${hash}`);

    } catch (error: any) {
      await this.updateStatus(
        tx.id, 
        TransactionStatus.FAILED, 
        'STELLAR_ERROR', 
        error.message || 'Unknown error during Stellar routing'
      );
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
}
