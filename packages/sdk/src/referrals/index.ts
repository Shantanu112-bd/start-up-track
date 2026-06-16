import { Referral, PaginationResponse } from "@cryptopay/types";
import { ApiClient } from "../core/ApiClient";

export class ReferralsSdk {
  constructor(private client: ApiClient) {}

  async getReferralStats(): Promise<{ totalReferrals: number; totalStarEarned: string }> {
    // This assumes a stats endpoint or we can aggregate from listReferrals.
    // Mapping to an expected backend route or placeholder.
    return this.client.get<{ totalReferrals: number; totalStarEarned: string }>("/referrals/stats");
  }

  async generateReferralCode(): Promise<Referral> {
    return this.client.post<Referral>("/referrals");
  }

  async listReferrals(params?: { page?: number; limit?: number }): Promise<PaginationResponse<Referral>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    
    const queryStr = searchParams.toString();
    return this.client.get<PaginationResponse<Referral>>(`/referrals${queryStr ? "?" + queryStr : ""}`);
  }
}
