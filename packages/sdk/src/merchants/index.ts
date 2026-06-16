import { Merchant, PaginationResponse, Transaction } from "@cryptopay/types";
import { ApiClient } from "../core/ApiClient";

export class MerchantsSdk {
  constructor(private client: ApiClient) {}

  async getMerchant(merchantId: string): Promise<Merchant> {
    return this.client.get<Merchant>(`/merchants/${merchantId}`);
  }

  async getMerchantAnalytics(merchantId: string): Promise<any> {
    return this.client.get<any>(`/merchants/${merchantId}/analytics`);
  }

  async getMerchantTransactions(merchantId: string, params?: { page?: number; limit?: number }): Promise<PaginationResponse<Transaction>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    searchParams.set("merchantId", merchantId);
    
    return this.client.get<PaginationResponse<Transaction>>(`/transactions?${searchParams.toString()}`);
  }
}
