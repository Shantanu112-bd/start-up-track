import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";


@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics(merchantId?: string) {
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

  async getRevenueMetrics(merchantId?: string) {
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
        assetIn: true,
        createdAt: true,
      },
    });

    let totalVolume = 0;
    const seriesMap = new Map<string, { volume: number; count: number; usdc: number; xlm: number }>();

    for (const tx of recentTransactions) {
      const dateStr = tx.createdAt.toISOString().split("T")[0]!;
      const volumeInr = Number(tx.amountInPaise) / 100;
      totalVolume += volumeInr;

      if (!seriesMap.has(dateStr)) {
        seriesMap.set(dateStr, { volume: 0, count: 0, usdc: 0, xlm: 0 });
      }
      const existing = seriesMap.get(dateStr)!;
      existing.volume += volumeInr;
      existing.count += 1;
      
      if (tx.assetIn === "USDC") {
        existing.usdc += 1;
      } else if (tx.assetIn === "XLM") {
        existing.xlm += 1;
      }
    }

    const timeSeries = Array.from(seriesMap.entries())
      .map(([date, data]) => ({ date, volume: data.volume, count: data.count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const transactionSeries = Array.from(seriesMap.entries())
      .map(([date, data]) => ({ date, usdc: data.usdc, xlm: data.xlm }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalCount = recentTransactions.length;
    const averageOrderValueInr = totalCount > 0 ? totalVolume / totalCount : 0;

    return {
      timeSeries,
      transactionSeries,
      totalVolume,
      averageOrderValueInr,
    };
  }

  async getRewardMetrics(merchantId?: string) {
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
      by: ["reason", "campaignId"],
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
    const campaignMap = new Map<string, number>();

    for (const group of rewardsGrouped) {
      const amount = Number(group._sum.starAmount || 0);
      byReason[group.reason as keyof typeof byReason] += amount;
      totalMinted += amount;

      if (group.campaignId) {
        campaignMap.set(group.campaignId, (campaignMap.get(group.campaignId) || 0) + amount);
      }
    }

    // Resolve campaign names for the distribution pie chart
    const campaignIds = Array.from(campaignMap.keys());
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, name: true }
    });
    
    const nameMap = new Map<string, string>();
    campaigns.forEach((c: any) => nameMap.set(c.id, c.name));

    const campaignDistribution = Array.from(campaignMap.entries()).map(([id, value]) => ({
      name: nameMap.get(id) || "Unknown Campaign",
      value,
    }));

    // If there's rewards from SPEND that aren't tied to campaigns
    if (byReason.SPEND > 0) {
      campaignDistribution.push({
        name: "Direct Spend Bonus",
        value: byReason.SPEND
      });
    }

    return {
      totalMinted,
      campaignDistribution,
      byReason,
    };
  }

  async getConsumerRewardMetrics(userId?: string) {
    const rewards = await this.prisma.reward.findMany({
      where: {
        ...(userId ? { userId } : {}),
        status: "MINTED",
      },
      select: {
        starAmount: true,
        reason: true,
        createdAt: true,
      },
    });

    const metrics = {
      totalEarned: 0,
      byReason: { SPEND: 0, REFERRAL: 0, CAMPAIGN: 0, MERCHANT: 0 },
      timeSeries: [] as { month: string, earned: number }[]
    };
    const seriesMap = new Map<string, number>();

    for (const reward of rewards) {
      const amount = Number(reward.starAmount);
      metrics.totalEarned += amount;
      metrics.byReason[reward.reason as keyof typeof metrics.byReason] += amount;

      const date = new Date(reward.createdAt);
      const monthStr = date.toISOString().substring(0, 7); // e.g., '2026-06'
      
      if (!seriesMap.has(monthStr)) {
        seriesMap.set(monthStr, 0);
      }
      seriesMap.set(monthStr, seriesMap.get(monthStr)! + amount);
    }

    metrics.timeSeries = Array.from(seriesMap.entries())
      .map(([month, earned]) => ({ month, earned }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return metrics;
  }

  async getCampaignMetrics(merchantId?: string) {
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
