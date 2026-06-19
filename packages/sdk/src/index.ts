import { ApiClient, ApiClientConfig } from "./core/ApiClient";
import { AuthSdk } from "./auth";
import { UsersSdk } from "./users";
import { WalletsSdk } from "./wallets";
import { MerchantsSdk } from "./merchants";
import { TransactionsSdk } from "./transactions";
import { RewardsSdk } from "./rewards";
import { CampaignsSdk } from "./campaigns";
import { ReferralsSdk } from "./referrals";
import { AnalyticsSdk } from "./analytics";
import { AdminSdk } from "./admin";

export { ApiClient, type ApiClientConfig } from "./core/ApiClient";
export { ApiError } from "./core/ApiError";

export class CryptoPaySdk {
  public auth: AuthSdk;
  public users: UsersSdk;
  public wallets: WalletsSdk;
  public merchants: MerchantsSdk;
  public transactions: TransactionsSdk;
  public rewards: RewardsSdk;
  public campaigns: CampaignsSdk;
  public referrals: ReferralsSdk;
  public analytics: AnalyticsSdk;
  public admin: AdminSdk;

  private client: ApiClient;

  constructor(config: ApiClientConfig) {
    this.client = new ApiClient(config);
    
    this.auth = new AuthSdk(this.client);
    this.users = new UsersSdk(this.client);
    this.wallets = new WalletsSdk(this.client);
    this.merchants = new MerchantsSdk(this.client);
    this.transactions = new TransactionsSdk(this.client);
    this.rewards = new RewardsSdk(this.client);
    this.campaigns = new CampaignsSdk(this.client);
    this.referrals = new ReferralsSdk(this.client);
    this.analytics = new AnalyticsSdk(this.client);
    this.admin = new AdminSdk(this.client);
  }
}

// Support singleton pattern if apps want to initialize once
let sharedSdkInstance: CryptoPaySdk | null = null;

export const initializeSdk = (config: ApiClientConfig): CryptoPaySdk => {
  sharedSdkInstance = new CryptoPaySdk(config);
  return sharedSdkInstance;
};

export const getSdk = (): CryptoPaySdk => {
  if (!sharedSdkInstance) {
    throw new Error("SDK has not been initialized. Call initializeSdk first.");
  }
  return sharedSdkInstance;
};

// Export a default pre-initialized instance for convenience
// Note: Providers.tsx also calls initializeSdk() which replaces this for browser requests.
// This singleton is used by pages that import cryptoPaySdk directly.
export const cryptoPaySdk = new CryptoPaySdk({
  baseUrl: (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL 
    ? process.env.NEXT_PUBLIC_API_URL 
    : "http://localhost:4000") + "/api/v1",
  getToken: () => typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,
});

// Also export raw classes if tree-shaking and custom instantiation is needed
export {
  AuthSdk,
  UsersSdk,
  WalletsSdk,
  MerchantsSdk,
  TransactionsSdk,
  RewardsSdk,
  CampaignsSdk,
  ReferralsSdk,
  AnalyticsSdk,
  AdminSdk,
};
