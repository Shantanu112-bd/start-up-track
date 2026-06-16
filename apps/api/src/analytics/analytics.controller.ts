import { Controller, Get, Query } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { 
  DashboardMetricsDto, 
  RevenueMetricsDto, 
  RewardMetricsDto, 
  CampaignMetricsDto 
} from "@cryptopay/types";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  async getDashboardMetrics(@Query("merchantId") merchantId?: string): Promise<DashboardMetricsDto> {
    return this.analyticsService.getDashboardMetrics(merchantId);
  }

  @Get("revenue")
  async getRevenueMetrics(@Query("merchantId") merchantId?: string): Promise<RevenueMetricsDto> {
    return this.analyticsService.getRevenueMetrics(merchantId);
  }

  @Get("rewards")
  async getRewardMetrics(@Query("merchantId") merchantId?: string): Promise<RewardMetricsDto> {
    return this.analyticsService.getRewardMetrics(merchantId);
  }

  @Get("campaigns")
  async getCampaignMetrics(@Query("merchantId") merchantId?: string): Promise<CampaignMetricsDto> {
    return this.analyticsService.getCampaignMetrics(merchantId);
  }
}
