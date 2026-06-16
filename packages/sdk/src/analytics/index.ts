import { 
  DashboardMetricsDto, 
  RevenueMetricsDto, 
  RewardMetricsDto, 
  CampaignMetricsDto 
} from "@cryptopay/types";
import { ApiClient } from "../core/ApiClient";

export class AnalyticsSdk {
  constructor(private client: ApiClient) {}

  async getDashboardMetrics(merchantId?: string): Promise<DashboardMetricsDto> {
    const url = merchantId ? `/analytics/dashboard?merchantId=${merchantId}` : "/analytics/dashboard";
    return this.client.get<DashboardMetricsDto>(url);
  }

  async getRevenueMetrics(merchantId?: string): Promise<RevenueMetricsDto> {
    const url = merchantId ? `/analytics/revenue?merchantId=${merchantId}` : "/analytics/revenue";
    return this.client.get<RevenueMetricsDto>(url);
  }

  async getRewardMetrics(merchantId?: string): Promise<RewardMetricsDto> {
    const url = merchantId ? `/analytics/rewards?merchantId=${merchantId}` : "/analytics/rewards";
    return this.client.get<RewardMetricsDto>(url);
  }

  async getCampaignMetrics(merchantId?: string): Promise<CampaignMetricsDto> {
    const url = merchantId ? `/analytics/campaigns?merchantId=${merchantId}` : "/analytics/campaigns";
    return this.client.get<CampaignMetricsDto>(url);
  }
}
