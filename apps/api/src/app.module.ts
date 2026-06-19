import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

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
import { KycModule } from "./kyc/kyc.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
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
    KycModule,
  ],
  controllers: [
    HealthController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
