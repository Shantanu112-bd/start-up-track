import { User, Merchant, Transaction, PaginationResponse } from "@cryptopay/types";
import { ApiClient } from "../core/ApiClient";

export class AdminSdk {
  constructor(private client: ApiClient) {}

  async listUsers(params?: { page?: number; limit?: number }): Promise<PaginationResponse<User>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    
    const queryStr = searchParams.toString();
    return this.client.get<PaginationResponse<User>>(`/users${queryStr ? "?" + queryStr : ""}`);
  }

  async listMerchants(params?: { page?: number; limit?: number }): Promise<PaginationResponse<Merchant>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    
    const queryStr = searchParams.toString();
    return this.client.get<PaginationResponse<Merchant>>(`/merchants${queryStr ? "?" + queryStr : ""}`);
  }

  async listTransactions(params?: { page?: number; limit?: number }): Promise<PaginationResponse<Transaction>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    
    const queryStr = searchParams.toString();
    return this.client.get<PaginationResponse<Transaction>>(`/transactions${queryStr ? "?" + queryStr : ""}`);
  }
}
