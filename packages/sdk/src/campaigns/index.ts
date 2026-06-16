import { Campaign, PaginationResponse } from "@cryptopay/types";
import { ApiClient } from "../core/ApiClient";

export class CampaignsSdk {
  constructor(private client: ApiClient) {}

  async listCampaigns(params?: { page?: number; limit?: number; status?: string }): Promise<PaginationResponse<Campaign>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.status) searchParams.set("status", params.status);

    const queryStr = searchParams.toString();
    return this.client.get<PaginationResponse<Campaign>>(`/campaigns${queryStr ? "?" + queryStr : ""}`);
  }

  async getCampaign(campaignId: string): Promise<Campaign> {
    return this.client.get<Campaign>(`/campaigns/${campaignId}`);
  }

  async joinCampaign(campaignId: string, merchantId: string): Promise<void> {
    return this.client.post<void>(`/campaigns/${campaignId}/merchants/${merchantId}`);
  }

  async createCampaign(data: any): Promise<Campaign> {
    return this.client.post<Campaign>("/campaigns", data);
  }

  async getCampaignAnalytics(campaignId: string): Promise<any> {
    return this.client.get<any>(`/campaigns/${campaignId}/analytics`);
  }
}
