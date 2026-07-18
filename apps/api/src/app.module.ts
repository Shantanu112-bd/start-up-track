import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { LoggerModule } from 'nestjs-pino';
import * as crypto from 'crypto';

import { AdminModule } from "./admin/admin.module";
import { AmlModule } from "./aml/aml.module";
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
import { ScheduleModule } from '@nestjs/schedule';
import { StellarModule } from './stellar/stellar.module';
import { TransactionProcessorModule } from './transaction-processor/transaction-processor.module';
import { CircuitBreakerModule } from './common/circuit-breaker/circuit-breaker.module';
import { RampsModule } from './ramps/ramps.module';
import { PaginationInterceptor } from './common/interceptors/pagination.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req: any) => (req.headers['x-request-id'] as string) || crypto.randomUUID(),
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
        redact: ['req.headers.authorization', 'req.body.password', 'req.body.phoneE164'],
        level: process.env.LOG_LEVEL || 'info',
      } as any,
    }),
    ScheduleModule.forRoot(),
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
    StellarModule,
    TransactionProcessorModule,
    CircuitBreakerModule,
    RampsModule,
    AmlModule,
  ],
  controllers: [
    HealthController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PaginationInterceptor,
    },
  ],
})
export class AppModule {}
