import { Transaction, PaginationResponse } from "@cryptopay/types";
import { ApiClient } from "../core/ApiClient";

export class TransactionsSdk {
  constructor(private client: ApiClient) {}

  async createTransaction(payload: {
    merchantId: string;
    assetIn: string;
    amountInPaise: string;
    walletId?: string;
    merchantQrCodeId?: string;
    campaignId?: string;
    merchantUpiVpa?: string;
    qrPayload?: string;
  }): Promise<Transaction> {
    return this.client.post<Transaction>("/transactions", payload);
  }

  async getQuote(payload: { assetIn: string; amountInPaise: string }): Promise<any> {
    return this.client.post<any>("/transactions/quote", payload);
  }

  async simulateTransaction(transactionId: string, payload?: { networkFeePaise?: string }): Promise<Transaction> {
    return this.client.post<Transaction>(`/transactions/${transactionId}/simulate`, payload || {});
  }

  async cancelTransaction(transactionId: string): Promise<Transaction> {
    return this.client.post<Transaction>(`/transactions/${transactionId}/cancel`);
  }

  async getTransaction(transactionId: string): Promise<Transaction> {
    return this.client.get<Transaction>(`/transactions/${transactionId}`);
  }

  async listTransactions(params?: { page?: number; limit?: number; status?: string }): Promise<PaginationResponse<Transaction>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.status) searchParams.set("status", params.status);

    const queryStr = searchParams.toString();
    return this.client.get<PaginationResponse<Transaction>>(`/transactions${queryStr ? "?" + queryStr : ""}`);
  }
}
