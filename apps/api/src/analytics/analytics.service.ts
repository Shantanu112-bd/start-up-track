import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { 
  DashboardMetricsDto, 
  RevenueMetricsDto, 
  RewardMetricsDto, 
  CampaignMetricsDto 
} from "@cryptopay/types";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics(merchantId?: string): Promise<DashboardMetricsDto> {
    const whereClause = merchantId ? { merchantId } : {};

    const [transactionsResult, rewardsResult, campaignsCount] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          ...whereClause,
          status: "COMPLETED",
        },
        _sum: {
          amountInPaise: true,
        },
        _count: {
          id: true,
        },
      }),
      this.prisma.reward.aggregate({
        where: {
          status: "MINTED",
        },
        _sum: {
          starAmount: true,
        },
      }),
      this.prisma.campaign.count({
        where: {
          status: "ACTIVE",
        },
      }),
    ]);

    return {
      totalVolumeInr: Number(transactionsResult._sum.amountInPaise || 0) / 100,
      totalTransactions: transactionsResult._count.id,
      totalRewardsMinted: Number(rewardsResult._sum.starAmount || 0),
      activeCampaigns: campaignsCount,
    };
  }

  async getRevenueMetrics(merchantId?: string): Promise<RevenueMetricsDto> {
    const whereClause = merchantId ? { merchantId } : {};

    // For a real production app, we would use raw SQL for time-series grouping.
    // Here we will fetch recent transactions and group them manually for simplicity in MVP.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = await this.prisma.transaction.findMany({
      where: {
        ...whereClause,
        status: "COMPLETED",
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        amountInPaise: true,
        createdAt: true,
      },
    });

    let totalVolume = 0;
    const seriesMap = new Map<string, { volume: number; count: number }>();

    for (const tx of recentTransactions) {
      const dateStr = tx.createdAt.toISOString().split("T")[0];
      const volumeInr = Number(tx.amountInPaise) / 100;
      totalVolume += volumeInr;

      if (!seriesMap.has(dateStr)) {
        seriesMap.set(dateStr, { volume: 0, count: 0 });
      }
      const existing = seriesMap.get(dateStr)!;
      existing.volume += volumeInr;
      existing.count += 1;
    }

    const timeSeries = Array.from(seriesMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      timeSeries,
      totalVolume,
    };
  }

  async getRewardMetrics(merchantId?: string): Promise<RewardMetricsDto> {
    // Note: Rewards are given to users, but we can filter by transactions tied to the merchant if needed.
    // For this implementation, if merchantId is provided, we filter rewards associated with that merchant's transactions.
    let whereClause = {};
    if (merchantId) {
      whereClause = {
        transaction: {
          merchantId,
        },
      };
    }

    const rewardsGrouped = await this.prisma.reward.groupBy({
      by: ["reason"],
      where: {
        ...whereClause,
        status: "MINTED",
      },
      _sum: {
        starAmount: true,
      },
    });

    const byReason = { SPEND: 0, REFERRAL: 0, CAMPAIGN: 0, MERCHANT: 0 };
    let totalMinted = 0;

    for (const group of rewardsGrouped) {
      const amount = Number(group._sum.starAmount || 0);
      byReason[group.reason] = amount;
      totalMinted += amount;
    }

    return {
      totalMinted,
      byReason,
    };
  }

  async getCampaignMetrics(merchantId?: string): Promise<CampaignMetricsDto> {
    let whereClause = {};
    if (merchantId) {
      whereClause = {
        merchantLinks: {
          some: {
            merchantId,
          },
        },
      };
    }

    const [campaignsResult, activeCount] = await Promise.all([
      this.prisma.campaign.aggregate({
        where: whereClause,
        _sum: {
          budgetStar: true,
          spentStar: true,
        },
      }),
      this.prisma.campaign.count({
        where: {
          ...whereClause,
          status: "ACTIVE",
        },
      }),
    ]);

    // Approximate total merchants participating across campaigns matching whereClause
    const merchantsParticipating = await this.prisma.campaignMerchant.count({
      where: merchantId ? { merchantId } : {},
    });

    return {
      totalBudget: Number(campaignsResult._sum.budgetStar || 0),
      totalSpent: Number(campaignsResult._sum.spentStar || 0),
      activeCampaignsCount: activeCount,
      merchantsParticipating,
    };
  }
}
