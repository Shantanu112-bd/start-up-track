import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { CircuitBreakerService } from "../common/circuit-breaker/circuit-breaker.service";
import { createReadableId, sha256Hex } from "../common/utils/ids";
import { calculateSpendRewardStar } from "../common/utils/rewards";
import { toPagination } from "../common/utils/pagination";
import {
  AssetCode,
  MerchantStatus,
  RewardReason,
  RewardStatus,
  SettlementStatus,
  TransactionStatus,
  UserRole,
  type Prisma,
} from "../generated/prisma";
import type { AuthenticatedPrincipal } from "../common/decorators/current-user.decorator";
import type { CreateTransactionDto } from "./dto/create-transaction.dto";
import type { FailTransactionDto } from "./dto/fail-transaction.dto";
import type { ListTransactionsDto } from "./dto/list-transactions.dto";
import type { QuoteTransactionDto } from "./dto/quote-transaction.dto";
import type { SimulateTransactionDto } from "./dto/simulate-transaction.dto";

type Quote = {
  amountInCrypto: string;
  amountInPaise: string;
  assetIn: AssetCode;
  expiresAt: Date;
  networkFeePaise: string;
  quoteRateInrPerAsset: string;
  starReward: string;
  usdcAmount: string;
};

@Injectable()
export class TransactionsService {
  private rateCache: Partial<Record<AssetCode, number>> = {};
  private rateCacheTime = 0;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  private async getLiveRates(): Promise<Record<AssetCode, number>> {
    const now = Date.now();
    if (now - this.rateCacheTime < 60_000 && Object.keys(this.rateCache).length > 0) {
      return this.rateCache as Record<AssetCode, number>;
    }

    try {
      const policy = this.circuitBreaker.getPolicy('COINGECKO');
      const res = (await policy.execute(() => fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=stellar,usd-coin,bitcoin,ethereum,solana&vs_currencies=inr'
      ))) as Response;
      const data = await res.json() as Record<string, { inr: number }>;

      this.rateCache = {
        [AssetCode.XLM]: data['stellar']?.inr || 9,
        [AssetCode.USDC]: data['usd-coin']?.inr || 83,
        [AssetCode.BTC]: data['bitcoin']?.inr || 9_000_000,
        [AssetCode.ETH]: data['ethereum']?.inr || 300_000,
        [AssetCode.SOL]: data['solana']?.inr || 14_000,
        [AssetCode.INR]: 1,
      };
      this.rateCacheTime = now;
    } catch {
      // Fall back to last cached or static estimates
      if (Object.keys(this.rateCache).length === 0) {
        this.rateCache = { XLM: 9, USDC: 83, BTC: 9_000_000, ETH: 300_000, SOL: 14_000, INR: 1 } as any;
      }
    }

    return this.rateCache as Record<AssetCode, number>;
  }

  async quote(dto: QuoteTransactionDto): Promise<Quote> {
    return this.createQuote(dto.assetIn, BigInt(dto.amountInPaise));
  }

  async create(owner: AuthenticatedPrincipal, dto: CreateTransactionDto) {
    const amountInPaise = BigInt(dto.amountInPaise);
    const merchant = await this.prisma.merchant.findUnique({
      include: {
        qrCodes:
          dto.merchantQrCodeId === undefined
            ? false
            : {
                where: {
                  id: dto.merchantQrCodeId,
                  isActive: true,
                },
              },
      },
      where: { id: dto.merchantId },
    });

    if (merchant === null || merchant.status !== MerchantStatus.APPROVED) {
      throw new BadRequestException("Merchant is not approved");
    }

    if (dto.walletId !== undefined) {
      await this.assertWalletAccess(owner, dto.walletId);
    }

    const qrCode = dto.merchantQrCodeId === undefined ? undefined : merchant.qrCodes[0];

    if (dto.merchantQrCodeId !== undefined && qrCode === undefined) {
      throw new BadRequestException("Merchant QR is not active");
    }

    const merchantUpiVpa = dto.merchantUpiVpa ?? qrCode?.upiVpa ?? merchant.defaultUpiVpa;

    if (merchantUpiVpa === null || merchantUpiVpa === undefined) {
      throw new BadRequestException("Merchant UPI VPA is required");
    }

    const quote = await this.createQuote(dto.assetIn, amountInPaise);
    const qrPayloadHash =
      dto.qrPayload === undefined ? qrCode?.qrPayloadHash : sha256Hex(dto.qrPayload);

    const newTransaction = await this.prisma.transaction.create({
      data: {
        amountInCrypto: quote.amountInCrypto,
        amountInPaise,
        assetIn: dto.assetIn,
        campaignId: dto.campaignId ?? null,
        events: {
          create: {
            eventType: "transaction.created",
            payload: {
              quote,
              source: "api",
            },
            sequence: 1,
            status: TransactionStatus.CREATED,
          },
        },
        expiresAt: quote.expiresAt,
        merchantId: dto.merchantId,
        merchantQrCodeId: dto.merchantQrCodeId ?? null,
        merchantSettlementPaise: amountInPaise,
        merchantUpiVpa,
        networkFeePaise: BigInt(quote.networkFeePaise),
        publicId: createReadableId("PAY"),
        qrPayloadHash: qrPayloadHash ?? null,
        quoteRateInrPerAsset: quote.quoteRateInrPerAsset,
        settlementInstruction: {
          create: {
            amountPaise: amountInPaise,
            merchantId: dto.merchantId,
          },
        },
        status: TransactionStatus.CREATED,
        usdcAmount: quote.usdcAmount,
        userId: owner.id,
        walletId: dto.walletId ?? null,
      },
      include: {
        events: true,
        merchant: true,
        rewards: true,
        settlementInstruction: true,
      },
    });

    await this.prisma.adminLog.create({
      data: {
        actorUserId: owner.id,
        action: 'TRANSACTION_CREATED',
        targetType: 'TRANSACTION',
        targetId: newTransaction.id,
        metadata: {
          merchantId: dto.merchantId,
          assetIn: dto.assetIn,
          amountInPaise: dto.amountInPaise,
          publicId: newTransaction.publicId,
        } as any,
      },
    })

    // Create spend reward for the transaction
    const starAmount = calculateSpendRewardStar(amountInPaise);
    await this.prisma.reward.create({
      data: {
        userId: owner.id,
        transactionId: newTransaction.id,
        reason: RewardReason.SPEND,
        starAmount,
        formulaVersion: 'STAR_SPEND_V1',
        status: RewardStatus.PENDING,
      },
    });

    return newTransaction;
  }

  async list(owner: AuthenticatedPrincipal, query: ListTransactionsDto) {
    const { skip, take } = toPagination(query);
    const where: Prisma.TransactionWhereInput = {
      ...this.accessWhere(owner),
      ...(query.assetIn === undefined ? {} : { assetIn: query.assetIn }),
      ...(query.campaignId === undefined ? {} : { campaignId: query.campaignId }),
      ...(query.merchantId === undefined ? {} : { merchantId: query.merchantId }),
      ...(query.status === undefined ? {} : { status: query.status }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        include: {
          merchant: true,
          rewards: true,
          settlementInstruction: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(owner: AuthenticatedPrincipal, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      include: {
        events: { orderBy: { sequence: "asc" } },
        merchant: true,
        rewards: true,
        settlementInstruction: true,
        wallet: true,
      },
      where: {
        id,
        ...this.accessWhere(owner),
      },
    });

    if (transaction === null) {
      throw new NotFoundException("Transaction not found");
    }

    return transaction;
  }


  async cancel(owner: AuthenticatedPrincipal, id: string) {
    const transaction = await this.findOne(owner, id);

    if (transaction.status !== TransactionStatus.CREATED) {
      throw new BadRequestException("Only created transactions can be cancelled");
    }

    await this.prisma.transactionEvent.create({
      data: {
        eventType: "transaction.cancelled",
        sequence: await this.nextEventSequence(id),
        status: TransactionStatus.CANCELLED,
        transactionId: id,
      },
    });

    return this.prisma.transaction.update({
      data: { status: TransactionStatus.CANCELLED },
      where: { id },
    });
  }

  async fail(owner: AuthenticatedPrincipal, id: string, dto: FailTransactionDto) {
    const transaction = await this.findOne(owner, id);

    if (transaction.status === TransactionStatus.COMPLETED) {
      throw new BadRequestException("Completed transactions cannot be failed");
    }

    await this.prisma.transactionEvent.create({
      data: {
        eventType: "transaction.failed",
        payload: {
          failureCode: dto.failureCode,
          failureMessage: dto.failureMessage,
        },
        sequence: await this.nextEventSequence(id),
        status: TransactionStatus.FAILED,
        transactionId: id,
      },
    });

    return this.prisma.transaction.update({
      data: {
        failureCode: dto.failureCode,
        failureMessage: dto.failureMessage ?? null,
        status: TransactionStatus.FAILED,
      },
      where: { id },
    });
  }

  private async createQuote(assetIn: AssetCode, amountInPaise: bigint): Promise<Quote> {
    if (assetIn === AssetCode.INR) {
      throw new BadRequestException("assetIn must be a crypto asset");
    }

    const rates = await this.getLiveRates();
    const rate = rates[assetIn];
    const amountInr = Number(amountInPaise) / 100;
    const amountInCrypto = amountInr / rate;
    const usdcAmount = amountInr / rates[AssetCode.USDC];

    return {
      amountInCrypto: amountInCrypto.toFixed(18),
      amountInPaise: amountInPaise.toString(),
      assetIn,
      expiresAt: new Date(Date.now() + 30 * 1000),
      networkFeePaise: "0",
      quoteRateInrPerAsset: rate.toFixed(18),
      starReward: calculateSpendRewardStar(amountInPaise).toString(),
      usdcAmount: usdcAmount.toFixed(18),
    };
  }

  private accessWhere(owner: AuthenticatedPrincipal): Prisma.TransactionWhereInput {
    if (owner.role === UserRole.ADMIN) {
      return {};
    }

    return {
      OR: [{ userId: owner.id }, { merchant: { ownerUserId: owner.id } }],
    };
  }

  private async assertWalletAccess(owner: AuthenticatedPrincipal, walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      select: { userId: true },
      where: { id: walletId },
    });

    if (wallet === null) {
      throw new NotFoundException("Wallet not found");
    }

    if (owner.role !== UserRole.ADMIN && wallet.userId !== owner.id) {
      throw new ForbiddenException("Wallet belongs to another user");
    }
  }

  private async appendEvents(
    tx: Prisma.TransactionClient,
    transactionId: string,
    statuses: TransactionStatus[],
  ) {
    const maxEvent = await tx.transactionEvent.aggregate({
      _max: { sequence: true },
      where: { transactionId },
    });
    const start = (maxEvent._max.sequence ?? 0) + 1;

    await tx.transactionEvent.createMany({
      data: statuses.map((status, index) => ({
        eventType: `transaction.${status.toLowerCase()}`,
        sequence: start + index,
        status,
        transactionId,
      })),
    });
  }

  private async nextEventSequence(transactionId: string): Promise<number> {
    const maxEvent = await this.prisma.transactionEvent.aggregate({
      _max: { sequence: true },
      where: { transactionId },
    });

    return (maxEvent._max.sequence ?? 0) + 1;
  }

  async getTaxReport(userId: string, year: number) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        status: TransactionStatus.COMPLETED,
        completedAt: {
          gte: startOfYear,
          lt: endOfYear,
        },
      },
      include: {
        merchant: true,
        rewards: true,
        settlementInstruction: true,
        events: { orderBy: { sequence: 'asc' } },
      },
      orderBy: { completedAt: 'asc' },
    });

    const totalTransactions = transactions.length;
    const totalSpentPaise = transactions.reduce((sum, tx) => sum + Number(tx.amountInPaise), 0);
    const totalStarRewards = transactions.reduce((sum, tx) =>
      sum + tx.rewards.reduce((rSum, r) => rSum + Number(r.starAmount), 0), 0);

    // Group by asset type
    const byAsset = transactions.reduce((acc, tx) => {
      const asset = tx.assetIn;
      if (!acc[asset]) {
        acc[asset] = { count: 0, totalPaise: 0, totalCrypto: 0 };
      }
      acc[asset].count++;
      acc[asset].totalPaise += Number(tx.amountInPaise);
      acc[asset].totalCrypto += Number(tx.amountInCrypto);
      return acc;
    }, {} as Record<string, { count: number; totalPaise: number; totalCrypto: number }>);

    // Group by month
    const byMonth = transactions.reduce((acc, tx) => {
      const month = tx.completedAt!.getMonth(); // get month 0-11
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      if (!acc[monthKey]) {
        acc[monthKey] = { count: 0, totalPaise: 0, starRewards: 0 };
      }
      acc[monthKey].count++;
      acc[monthKey].totalPaise += Number(tx.amountInPaise);
      acc[monthKey].starRewards += tx.rewards.reduce((sum, r) => sum + Number(r.starAmount), 0);
      return acc;
    }, {} as Record<string, { count: number; totalPaise: number; starRewards: number }>);

    // Detailed transaction list for the report
    const transactionDetails = transactions.map(tx => ({
      id: tx.id,
      publicId: tx.publicId,
      date: tx.completedAt!.toISOString(),
      merchantName: tx.merchant.displayName,
      merchantUpiVpa: tx.merchantUpiVpa,
      assetIn: tx.assetIn,
      amountInCrypto: tx.amountInCrypto,
      amountInPaise: tx.amountInPaise.toString(),
      amountInInr: (Number(tx.amountInPaise) / 100).toFixed(2),
      starRewards: tx.rewards.reduce((sum, r) => sum + Number(r.starAmount), 0),
      stellarTransactionHash: tx.stellarTransactionHash,
      settlementStatus: tx.settlementInstruction?.status,
      settlementReference: tx.settlementInstruction?.mockReference,
    }));

    return {
      taxYear: year,
      generatedAt: new Date().toISOString(),
      summary: {
        totalTransactions,
        totalSpentInr: (totalSpentPaise / 100).toFixed(2),
        totalStarRewards,
      },
      byAsset,
      byMonth,
      transactions: transactionDetails,
      disclaimer: "This report is generated for informational purposes only and does not constitute tax advice. Please consult a qualified tax professional for your specific situation.",
    };
  }
}
