-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CONSUMER', 'MERCHANT_OPERATOR', 'BRAND_OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_ONBOARDING', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "WalletProvider" AS ENUM ('FREIGHTER', 'WALLET_CONNECT', 'MOCK');

-- CreateEnum
CREATE TYPE "WalletNetwork" AS ENUM ('STELLAR', 'ETHEREUM', 'BITCOIN', 'SOLANA');

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignRewardType" AS ENUM ('WELCOME_BONUS', 'DOUBLE_REWARDS', 'SPEND_AND_EARN', 'REFERRAL_CAMPAIGN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('CREATED', 'QUOTED', 'AUTHORIZED', 'CONVERTING', 'ROUTING_STELLAR', 'SETTLING', 'REWARDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CRYPTO_TO_FIAT');

-- CreateEnum
CREATE TYPE "PaymentRail" AS ENUM ('UPI_MOCK');

-- CreateEnum
CREATE TYPE "SettlementLayer" AS ENUM ('STELLAR');

-- CreateEnum
CREATE TYPE "AssetCode" AS ENUM ('ETH', 'BTC', 'SOL', 'XLM', 'USDC', 'INR');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'SENT', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "RewardReason" AS ENUM ('SPEND', 'REFERRAL', 'CAMPAIGN', 'MERCHANT');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('PENDING', 'MINTED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('INVITED', 'QUALIFIED', 'REWARDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320),
    "email_normalized" VARCHAR(320),
    "phone_e164" VARCHAR(20),
    "display_name" VARCHAR(160),
    "role" "UserRole" NOT NULL DEFAULT 'CONSUMER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_ONBOARDING',
    "referral_code" VARCHAR(32),
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'NONE',
    "kyc_reference" VARCHAR(128),
    "kyc_verified_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "hashed_refresh_token" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "WalletProvider" NOT NULL DEFAULT 'FREIGHTER',
    "network" "WalletNetwork" NOT NULL,
    "address" VARCHAR(191) NOT NULL,
    "address_normalized" VARCHAR(191) NOT NULL,
    "label" VARCHAR(80),
    "public_key" VARCHAR(191),
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "approved_by_admin_id" UUID,
    "merchant_code" VARCHAR(40) NOT NULL,
    "legal_name" VARCHAR(180) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "default_upi_vpa" VARCHAR(120),
    "category" VARCHAR(80),
    "status" "MerchantStatus" NOT NULL DEFAULT 'PENDING',
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "city" VARCHAR(80),
    "state" VARCHAR(80),
    "country" CHAR(2) NOT NULL DEFAULT 'IN',
    "postal_code" VARCHAR(20),
    "gstin" VARCHAR(32),
    "mock_kyc_reference" VARCHAR(80),
    "approved_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_qr_codes" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "upi_vpa" VARCHAR(120) NOT NULL,
    "qr_payload" TEXT NOT NULL,
    "qr_payload_hash" VARCHAR(64) NOT NULL,
    "default_amount_paise" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "merchant_qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "status" "BrandStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "reward_type" "CampaignRewardType" NOT NULL DEFAULT 'SPEND_AND_EARN',
    "threshold_amount_paise" BIGINT NOT NULL,
    "reward_amount_star" BIGINT NOT NULL,
    "budget_star" BIGINT NOT NULL,
    "spent_star" BIGINT NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_merchants" (
    "campaign_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_merchants_pkey" PRIMARY KEY ("campaign_id","merchant_id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "public_id" VARCHAR(40) NOT NULL,
    "user_id" UUID NOT NULL,
    "wallet_id" UUID,
    "merchant_id" UUID NOT NULL,
    "merchant_qr_code_id" UUID,
    "campaign_id" UUID,
    "type" "TransactionType" NOT NULL DEFAULT 'CRYPTO_TO_FIAT',
    "status" "TransactionStatus" NOT NULL DEFAULT 'CREATED',
    "rail" "PaymentRail" NOT NULL DEFAULT 'UPI_MOCK',
    "settlement_layer" "SettlementLayer" NOT NULL DEFAULT 'STELLAR',
    "asset_in" "AssetCode" NOT NULL,
    "amount_in_crypto" DECIMAL(36,18),
    "amount_in_paise" BIGINT NOT NULL,
    "quote_rate_inr_per_asset" DECIMAL(36,18),
    "usdc_amount" DECIMAL(36,18),
    "network_fee_paise" BIGINT NOT NULL DEFAULT 0,
    "merchant_settlement_paise" BIGINT NOT NULL,
    "merchant_upi_vpa" VARCHAR(120) NOT NULL,
    "qr_payload_hash" VARCHAR(64),
    "stellar_ledger" BIGINT,
    "stellar_transaction_hash" VARCHAR(128),
    "failure_code" VARCHAR(80),
    "failure_message" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "authorized_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_events" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "TransactionStatus",
    "event_type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_instructions" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "currency" "AssetCode" NOT NULL DEFAULT 'INR',
    "rail" "PaymentRail" NOT NULL DEFAULT 'UPI_MOCK',
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "mock_reference" VARCHAR(80),
    "attempted_at" TIMESTAMPTZ(6),
    "confirmed_at" TIMESTAMPTZ(6),
    "failure_reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settlement_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "transaction_id" UUID,
    "campaign_id" UUID,
    "referral_id" UUID,
    "reason" "RewardReason" NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'PENDING',
    "star_amount" BIGINT NOT NULL,
    "formula_version" VARCHAR(40) NOT NULL DEFAULT 'STAR_SPEND_V1',
    "rule_snapshot" JSONB NOT NULL DEFAULT '{}',
    "stellar_mint_hash" VARCHAR(128),
    "minted_at" TIMESTAMPTZ(6),
    "reversed_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "inviter_user_id" UUID NOT NULL,
    "invited_user_id" UUID,
    "code" VARCHAR(32) NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'INVITED',
    "first_transaction_id" UUID,
    "reward_amount_star" BIGINT NOT NULL DEFAULT 100,
    "qualified_at" TIMESTAMPTZ(6),
    "rewarded_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(80) NOT NULL,
    "target_id" VARCHAR(80) NOT NULL,
    "request_id" VARCHAR(80),
    "ip_address" INET,
    "user_agent" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "scope" VARCHAR(80) NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "request_hash" VARCHAR(128) NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "locked_until" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "api_idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" VARCHAR(80) NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_e164_key" ON "users"("phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "wallets_user_id_status_idx" ON "wallets"("user_id", "status");

-- CreateIndex
CREATE INDEX "wallets_provider_status_idx" ON "wallets"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_network_address_normalized_key" ON "wallets"("network", "address_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_merchant_code_key" ON "merchants"("merchant_code");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_default_upi_vpa_key" ON "merchants"("default_upi_vpa");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_gstin_key" ON "merchants"("gstin");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_mock_kyc_reference_key" ON "merchants"("mock_kyc_reference");

-- CreateIndex
CREATE INDEX "merchants_owner_user_id_status_idx" ON "merchants"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "merchants_status_created_at_idx" ON "merchants"("status", "created_at");

-- CreateIndex
CREATE INDEX "merchants_city_state_idx" ON "merchants"("city", "state");

-- CreateIndex
CREATE INDEX "merchants_risk_level_status_idx" ON "merchants"("risk_level", "status");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_qr_codes_qr_payload_hash_key" ON "merchant_qr_codes"("qr_payload_hash");

-- CreateIndex
CREATE INDEX "merchant_qr_codes_merchant_id_is_active_idx" ON "merchant_qr_codes"("merchant_id", "is_active");

-- CreateIndex
CREATE INDEX "merchant_qr_codes_upi_vpa_idx" ON "merchant_qr_codes"("upi_vpa");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_owner_user_id_status_idx" ON "brands"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "brands_status_created_at_idx" ON "brands"("status", "created_at");

-- CreateIndex
CREATE INDEX "campaigns_brand_id_status_idx" ON "campaigns"("brand_id", "status");

-- CreateIndex
CREATE INDEX "campaigns_status_starts_at_ends_at_idx" ON "campaigns"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "campaigns_reward_type_status_idx" ON "campaigns"("reward_type", "status");

-- CreateIndex
CREATE INDEX "campaign_merchants_merchant_id_is_active_idx" ON "campaign_merchants"("merchant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_public_id_key" ON "transactions"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_stellar_transaction_hash_key" ON "transactions"("stellar_transaction_hash");

-- CreateIndex
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_merchant_id_created_at_idx" ON "transactions"("merchant_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_status_created_at_idx" ON "transactions"("status", "created_at");

-- CreateIndex
CREATE INDEX "transactions_asset_in_status_idx" ON "transactions"("asset_in", "status");

-- CreateIndex
CREATE INDEX "transactions_campaign_id_created_at_idx" ON "transactions"("campaign_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_qr_payload_hash_idx" ON "transactions"("qr_payload_hash");

-- CreateIndex
CREATE INDEX "transaction_events_event_type_created_at_idx" ON "transaction_events"("event_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_events_transaction_id_sequence_key" ON "transaction_events"("transaction_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_instructions_transaction_id_key" ON "settlement_instructions"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_instructions_mock_reference_key" ON "settlement_instructions"("mock_reference");

-- CreateIndex
CREATE INDEX "settlement_instructions_merchant_id_status_created_at_idx" ON "settlement_instructions"("merchant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "settlement_instructions_status_created_at_idx" ON "settlement_instructions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_referral_id_key" ON "rewards"("referral_id");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_stellar_mint_hash_key" ON "rewards"("stellar_mint_hash");

-- CreateIndex
CREATE INDEX "rewards_user_id_status_created_at_idx" ON "rewards"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "rewards_status_created_at_idx" ON "rewards"("status", "created_at");

-- CreateIndex
CREATE INDEX "rewards_campaign_id_created_at_idx" ON "rewards"("campaign_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_transaction_id_reason_key" ON "rewards"("transaction_id", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_invited_user_id_key" ON "referrals"("invited_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_first_transaction_id_key" ON "referrals"("first_transaction_id");

-- CreateIndex
CREATE INDEX "referrals_inviter_user_id_status_idx" ON "referrals"("inviter_user_id", "status");

-- CreateIndex
CREATE INDEX "referrals_status_created_at_idx" ON "referrals"("status", "created_at");

-- CreateIndex
CREATE INDEX "admin_logs_actor_user_id_created_at_idx" ON "admin_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_logs_target_type_target_id_created_at_idx" ON "admin_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_logs_action_created_at_idx" ON "admin_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "api_idempotency_keys_user_id_created_at_idx" ON "api_idempotency_keys"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "api_idempotency_keys_expires_at_idx" ON "api_idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_idempotency_keys_scope_key_key" ON "api_idempotency_keys"("scope", "key");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_approved_by_admin_id_fkey" FOREIGN KEY ("approved_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_qr_codes" ADD CONSTRAINT "merchant_qr_codes_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_merchants" ADD CONSTRAINT "campaign_merchants_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_merchants" ADD CONSTRAINT "campaign_merchants_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_qr_code_id_fkey" FOREIGN KEY ("merchant_qr_code_id") REFERENCES "merchant_qr_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_events" ADD CONSTRAINT "transaction_events_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_instructions" ADD CONSTRAINT "settlement_instructions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_instructions" ADD CONSTRAINT "settlement_instructions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_first_transaction_id_fkey" FOREIGN KEY ("first_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviter_user_id_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_idempotency_keys" ADD CONSTRAINT "api_idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
