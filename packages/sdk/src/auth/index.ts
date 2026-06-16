import { User } from "@cryptopay/types";
import { ApiClient } from "../core/ApiClient";

export class AuthSdk {
  constructor(private client: ApiClient) {}

  async mockLogin(username: string): Promise<{ token: string; user: User }> {
    return this.client.post<{ token: string; user: User }>("/auth/mock-login", { username });
  }

  async walletChallenge(publicKey: string): Promise<{ challenge: string; expiresAt: string }> {
    return this.client.post<{ challenge: string; expiresAt: string }>("/auth/wallet/challenge", { publicKey });
  }

  async walletLogin(publicKey: string, signature: string, challenge: string): Promise<{ token: string; user: User }> {
    return this.client.post<{ token: string; user: User }>("/auth/wallet/login", { publicKey, signature, challenge });
  }

  async getCurrentUser(): Promise<User> {
    return this.client.get<User>("/auth/me");
  }

  logout(): void {
    // Implementing client-side logout cleanup could go here, or handled by the host app via token clearing.
  }
  
  refreshToken(): Promise<{ token: string }> {
    // Placeholder if a refresh endpoint is added later.
    return this.client.post<{ token: string }>("/auth/refresh");
  }
}
