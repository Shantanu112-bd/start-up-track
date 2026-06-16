export interface AnalyticsEventPayload {
  eventName: string;
  userId?: string;
  sessionId?: string;
  properties: Record<string, any>;
  timestamp?: number;
  source?: "web" | "admin" | "api" | "worker";
}

export interface DashboardMetricsDto {
  totalVolumeInr: number;
  totalTransactions: number;
  totalRewardsMinted: number;
  activeCampaigns: number;
}

export interface RevenueDataPoint {
  date: string;
  volume: number;
  count: number;
}

export interface RevenueMetricsDto {
  timeSeries: RevenueDataPoint[];
  totalVolume: number;
}

export interface RewardMetricsDto {
  totalMinted: number;
  byReason: {
    SPEND: number;
    REFERRAL: number;
    CAMPAIGN: number;
    MERCHANT: number;
  };
}

export interface CampaignMetricsDto {
  totalBudget: number;
  totalSpent: number;
  activeCampaignsCount: number;
  merchantsParticipating: number;
}
