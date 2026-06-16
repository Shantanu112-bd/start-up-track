import { Wallet, PaginationResponse } from "@cryptopay/types";
import { ApiClient } from "../core/ApiClient";

export class WalletsSdk {
  constructor(private client: ApiClient) {}

  async connectWallet(publicKey: string, signedPayload: string, label?: string): Promise<Wallet> {
    return this.client.post<Wallet>("/wallets", { publicKey, signedPayload, label });
  }

  async getWallet(walletId: string): Promise<Wallet> {
    return this.client.get<Wallet>(`/wallets/${walletId}`);
  }

  async getBalances(walletId: string): Promise<Array<{ asset: string; balance: string }>> {
    // This assumes the backend returns balance details either on the wallet object or via a dedicated endpoint.
    // For now, we fetch the wallet and extract its balance property if it exists, or hit a future balance endpoint.
    return this.client.get<Array<{ asset: string; balance: string }>>(`/wallets/${walletId}/balances`);
  }

  async listWallets(): Promise<PaginationResponse<Wallet>> {
    return this.client.get<PaginationResponse<Wallet>>("/wallets");
  }

  async disconnect(walletId: string): Promise<void> {
    return this.client.delete<void>(`/wallets/${walletId}`);
  }
}
