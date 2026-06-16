import { Module } from "@nestjs/common";

import { AdminModule } from "./admin/admin.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuthModule } from "./auth/auth.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { CommonModule } from "./common/common.module";
import { MerchantsModule } from "./merchants/merchants.module";
import { ReferralsModule } from "./referrals/referrals.module";
import { RewardsModule } from "./rewards/rewards.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { UsersModule } from "./users/users.module";
import { WalletsModule } from "./wallets/wallets.module";

@Module({
  imports: [
    CommonModule,
    AuthModule,
    UsersModule,
    WalletsModule,
    MerchantsModule,
    TransactionsModule,
    RewardsModule,
    CampaignsModule,
    ReferralsModule,
    AdminModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
