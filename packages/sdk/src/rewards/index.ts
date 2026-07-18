import { Reward, PaginationResponse } from "@cryptopay/types";
import { ApiClient } from "../core/ApiClient";

export interface RewardsBalance {
  lifetimeStar: number;
  mintedStar: number;
  pendingStar: number;
  userId: string;
}

export class RewardsSdk {
  constructor(private client: ApiClient) {}

  async getRewards(): Promise<RewardsBalance> {
    return this.client.get<RewardsBalance>("/rewards/balance");
  }

  async claimReward(rewardId: string): Promise<Reward> {
    return this.client.post<Reward>(`/rewards/${rewardId}/mint`);
  }

  async listRewards(params?: { page?: number; limit?: number }): Promise<PaginationResponse<Reward>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    const queryStr = searchParams.toString();
    return this.client.get<PaginationResponse<Reward>>(`/rewards${queryStr ? "?" + queryStr : ""}`);
  }
}
