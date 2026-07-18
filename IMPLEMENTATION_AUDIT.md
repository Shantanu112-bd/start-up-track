# StellarPay / CryptoPay — Comprehensive Implementation Audit

**Audit Date:** 2026-07-17  
**Branch:** `main` (commit `4cfcb4d`)  
**Scope:** Full-stack monorepo (Soroban contracts × NestJS API × Next.js Web × Shared SDK)  
**Auditor:** Automated code review via tool-assisted analysis

---

## Executive Summary

| Dimension | Score | Summary |
|-----------|-------|---------|
| **Architecture** | 🟢 9/10 | Clean monorepo, clear separation of concerns, well-defined contract interfaces |
| **Smart Contracts** | 🟡 7/10 | Core logic solid; TTL extensions **fixed**; 1 auth bug **fixed**; operator param missing in API client |
| **Backend API** | 🟢 8.5/10 | Comprehensive endpoints, good auth/roles, circuit breakers, but **createPayment missing operator** |
| **Frontend** | 🟢 8.5/10 | Polished UX, wallet auth flow works, pay flow complete; some pages use hardcoded demo IDs |
| **Payment Flow (E2E)** | 🟡 6.5/10 | End-to-end flow implemented; **transaction processor has bugs** (missing `hash`, `ledger`, `rewardResult` vars); settlement polling blocks event loop |
| **KYC/AML** | 🟡 6/10 | KYCAID integration exists; **no AML sanctions screening**; no ongoing monitoring |
| **Rewards/Campaigns** | 🟢 8/10 | Full CRUD + analytics; referral flow implemented; on-chain reward issuance via Soroban |
| **Merchant Features** | 🟢 8/10 | Registry, approval, campaigns, dashboard; QR codes stored off-chain |
| **On/Off-Ramp** | 🟡 7/10 | MoneyGram SEP-24 integration complete; **mock mode when unconfigured**; no fallback anchor |
| **Testing/CI/CD** | 🟡 5/10 | Contract tests pass (21/21); **API/web tests minimal**; CI builds but no E2E; deploy is webhook-only |
| **Security/Compliance** | 🟡 6/10 | JWT + refresh rotation + reuse detection ✓; SEP-10 verify ✓; **no rate limits on auth**, **no WAF**, secrets in env only |

**Overall Readiness:** **MVP-ready for testnet demo**; **NOT production-ready** without fixes in Section 7.

---

## 1. Architecture & Tech Stack

### 1.1 Monorepo Structure (Turborepo)
```
stellar/
├── apps/
│   ├── api/          # NestJS 10 + Prisma + PostgreSQL
│   └── web/          # Next.js 14 App Router + React 18 + React Query
├── packages/
│   ├── sdk/          # TypeScript API client (Axios + typed endpoints)
│   ├── ui/           # Shared React component library (Tailwind + Framer Motion)
│   └── types/        # Shared Zod/TS types (Prisma enums mirrored)
├── contracts/
│   ├── star-token/           # ERC-20-like token + minter/authorized roles
│   ├── merchant-registry/    # Merchant onboarding + status lifecycle
│   ├── reward-engine/        # STAR minting for spend/referral/campaign/merchant
│   └── payment-engine/       # Payment lifecycle (create→quote→convert→settle→reward→complete)
```

### 1.2 Key Technologies
| Layer | Stack |
|-------|-------|
| **Smart Contracts** | Soroban SDK (Rust), `soroban-sdk` v22, `stellar-sdk` v16 (Horizon), `soroban-rpc` v16 |
| **API** | NestJS 10, Prisma ORM (PostgreSQL), `@nestjs/schedule` (cron), `fastify` |
| **Auth** | SEP-10 challenge/sign/verify (Freighter), JWT access (15m) + refresh (7d) with rotation & reuse detection |
| **Frontend** | Next.js 14 (App Router), React Query v5, Freighter API, Framer Motion, Tailwind CSS |
| **Stellar** | Horizon (balances/tx history), Soroban RPC (contract calls), SEP-24 (MoneyGram) |
| **External APIs** | Decentro (UPI payouts), CoinGecko (USDC/INR), KYCAID (KYC), MoneyGram (fiat rails) |
| **Resilience** | Custom circuit breaker (exponential backoff), outbox pattern for events |

### 1.3 Data Flow Summary
```
User (Freighter) 
  → SEP-10 challenge → /auth/wallet/challenge
  → signMessage → /auth/wallet/verify → JWT pair
  → /pay (QR scan / manual VPA)
  → /transactions/create (CREATED)
  → TransactionProcessor cron (5s) claims CREATED → AUTHORIZED
  → Soroban: create_payment (operator auth)
  → Soroban: quote_payment (rate, amounts)
  → Stellar: submit USDC/XLM payment (Horizon)
  → Soroban: mark_converted → mark_settled
  → Decentro: UPI payout to merchant (polling)
  → Soroban: issue_reward (spend reward)
  → Soroban: complete_payment
  → DB: COMPLETED + reward MINTED
```

---

## 2. Feature Verification Matrix

| Feature Area | Checklist Item | Status | Evidence / Notes |
|--------------|----------------|--------|------------------|
| **Authentication** | SEP-10 challenge generation | ✅ | `auth.service.ts:58-76` |
| | SEP-10 signature verification (multi-format) | ✅ | `auth.service.ts:98-163` handles 3 message formats |
| | JWT access + refresh tokens | ✅ | `auth.service.ts:175-255`, 15m/7d, rotation + reuse detection |
| | Refresh token rotation & reuse detection | ✅ | `auth.service.ts:198-224` revokes family on reuse |
| | Role-based guards (USER, MERCHANT_OPERATOR, ADMIN) | ✅ | `roles.guard.ts`, `roles.decorator.ts` |
| | Wallet connection (Freighter) + network check | ✅ | `StellarWalletProvider.tsx:18-45` |
| **KYC/AML** | KYCAID integration (init + webhook) | ✅ | `kyc.service.ts:74-117`, `kyc.controller.ts:15-39` |
| | KYC status persisted on User | ✅ | `prisma/schema.prisma:127` `kycStatus` enum |
| | **AML sanctions screening (OFAC, UN, EU)** | ❌ | **Missing** — no integration, no checklist |
| | **Ongoing KYC monitoring / re-verification** | ❌ | **Missing** — one-time only |
| | **PEP/adverse media screening** | ❌ | **Missing** |
| **Payment Flow (Consumer)** | QR scan (html5-qrcode) | ✅ | `pay/page.tsx:163-185` |
| | Manual VPA entry fallback | ✅ | `pay/page.tsx:210-225` |
| | Merchant resolution (UPI → registry) | ✅ | `transactions.service.ts:42-90` |
| | Asset selection (XLM/USDC) + live quote | ✅ | `pay/page.tsx:230-280`, `transactions.service.ts:120-180` |
| | STAR fee toggle (user pays fee → extra STAR) | ✅ | `pay/page.tsx:290-310`, `transactions.service.ts:200-240` |
| | PaymentConfirm modal (biometric/PIN) | ✅ | `PaymentConfirm.tsx:36-45` uses WebAuthn + PIN |
| | Transaction created (CREATED status) | ✅ | `transactions.service.ts:250-320` |
| **Payment Flow (Processor)** | Cron claims CREATED → AUTHORIZED | ✅ | `transaction-processor.service.ts:24-48` |
| | Soroban `create_payment` (operator auth) | ✅ | `soroban.service.ts:110-155` **BUG: missing `operator` param** |
| | Soroban `quote_payment` | ✅ | `soroban.service.ts:160-210` |
| | Stellar payment submission (Horizon) | ✅ | `stellar.service.ts:45-95` |
| | Soroban `mark_converted` / `mark_settled` | ✅ | `soroban.service.ts:215-270` |
| | Decentro UPI payout + polling | ⚠️ | `transaction-processor.service.ts:162-220` **blocks event loop** |
| | Soroban `issue_reward` (spend) | ✅ | `soroban.service.ts:275-320` |
| | Soroban `complete_payment` | ✅ | `soroban.service.ts:325-360` |
| | Status transitions logged (TransactionEvent) | ✅ | `transaction-processor.service.ts:307-323` |
| **Rewards Engine** | Spend reward (10 STAR / 100 INR) | ✅ | `reward-engine/lib.rs:222-250` |
| | Referral reward (100 STAR) | ✅ | `reward-engine/lib.rs:252-268` |
| | Campaign reward (custom multiplier) | ✅ | `reward-engine/lib.rs:270-287` |
| | Merchant reward (configurable) | ✅ | `reward-engine/lib.rs:36` `RewardKind::Merchant` |
| | On-chain mint via STAR token minter | ✅ | `reward-engine/lib.rs:316-319` |
| | Duplicate reward_id rejection | ✅ | `reward-engine/lib.rs:312-314` |
| **Merchant Features** | Register merchant (pending → approved) | ✅ | `merchant-registry/lib.rs:150-184` |
| | Approve/reject/suspend/transfer | ✅ | `merchant-registry/lib.rs:186-300` |
| | QR code generation + payload hash | ✅ | `merchants.service.ts:120-180` |
| | Campaign creation (budget, multiplier, dates) | ✅ | `campaigns.service.ts:45-62` |
| | Campaign analytics (distributed, participants) | ✅ | `campaigns.service.ts:157-200` |
| | Merchant dashboard (revenue, txns, campaigns) | ✅ | `merchant/page.tsx`, `merchant/transactions/page.tsx` |
| **Referrals** | Create invite code | ✅ | `referrals.service.ts:33-43` |
| | Accept code (invited user) | ✅ | `referrals.service.ts:45-73` |
| | Qualify on first completed payment | ✅ | `referrals.service.ts:104-131` |
| | Issue 100 STAR reward | ✅ | `referrals.service.ts:133-172` |
| **On/Off Ramp** | MoneyGram SEP-10 auth | ✅ | `ramps.service.ts:46-72` |
| | SEP-24 deposit (on-ramp) interactive URL | ✅ | `ramps.service.ts:78-116` |
| | SEP-24 withdrawal (off-ramp) interactive URL | ✅ | `ramps.service.ts:122-160` |
| | Transaction status polling | ✅ | `ramps.service.ts:165-207` |
| | Frontend trustline management (USDC) | ✅ | `wallet/onramp/page.tsx:33-64`, `lib/trustline.ts` |
| | **Fallback anchor / multiple providers** | ❌ | **Missing** — MoneyGram only |
| **Admin** | Merchant approve/reject/suspend | ✅ | `admin.controller.ts:67-95` |
| | Transaction monitoring list | ✅ | `admin.controller.ts:97-101` |
| | Reward monitoring list | ✅ | `admin.controller.ts:103-107` |
| | Audit log listing | ✅ | `admin.controller.ts:109-113` |
| | Brand management (campaign funding) | ✅ | `campaigns.controller.ts:40-50` |

---

## 3. Smart Contract Completeness (Soroban)

### 3.1 Contract Inventory

| Contract | Functions | Events | TTL Extends | Tests |
|----------|-----------|--------|-------------|-------|
| **star-token** | 22 | 5 | 7 locations | 6 tests ✅ |
| **merchant-registry** | 13 | 2 | 1 location | 5 tests ✅ |
| **reward-engine** | 16 | 2 | 5 locations | 6 tests ✅ |
| **payment-engine** | 12 | 3 | 1 location | 4 tests ✅ |

### 3.2 Critical Fixes Applied (Phase 1)

| Bug | Location | Fix Applied |
|-----|----------|-------------|
| **Missing TTL extensions** | All 4 contracts | Added `extend_ttl(key, 100, 518400)` after every `persistent().set()` (17 total) |
| **Wrong auth in `create_payment`** | `payment-engine/src/lib.rs:262` | Changed `payer.require_auth()` → `operator.require_auth()` + added `operator` param first |
| **Test compilation errors** | `payment-engine/src/lib.rs:560-628` | Fixed `_operator` → `operator` destructuring in test setup |

### 3.3 Contract API Surface (Exported)

#### STAR Token (`star-token`)
```rust
// Admin/Config
initialize(admin, minter) → ()
set_admin(new_admin) → ()
set_minter(minter, enabled) → ()
set_authorized(account, enabled) → ()
pause() / unpause() → ()

// Token ops (auth: minter/authorized)
mint(to, amount) → ()
mint_from_minter(minter, to, amount) → ()
burn_from_authorized(authorized, from, amount) → ()
set_balance(account, amount) → ()        // admin only
approve(spender, amount) → ()
spend_allowance(owner, spender, amount) → ()
transfer(from, to, amount) → ()
transfer_from(spender, from, to, amount) → ()

// Views
balance(id) → i128
allowance(owner, spender) → i128
total_supply() → i128
decimals() → u32
name() → Symbol
symbol() → Symbol
admin() → Address
is_minter(addr) → bool
is_authorized(addr) → bool
paused() → bool
```

#### Merchant Registry (`merchant-registry`)
```rust
initialize(admin) → ()
set_admin(new_admin) → ()
pause() / unpause() → ()
register_merchant(merchant_id, owner, upi_id_hash, metadata_hash) → ()
approve_merchant(merchant_id) → ()
suspend_merchant(merchant_id) → ()
reject_merchant(merchant_id) → ()
update_metadata(merchant_id, metadata_hash) → ()
transfer_owner(merchant_id, new_owner) → ()
get_merchant(merchant_id) → MerchantRecord
is_approved(merchant_id) → bool
admin() → Address
paused() → bool
```

#### Reward Engine (`reward-engine`)
```rust
initialize(admin, star_token) → ()
set_admin(new_admin) → ()
pause() / unpause() → ()
set_star_token(star_token) → ()
set_issuer(issuer, enabled) → ()
is_issuer(issuer) → bool
calculate_spend_reward(amount_in_paise) → i128
issue_spend_reward(issuer, reward_id, recipient, source_id, amount_in_paise) → i128
issue_referral_reward(issuer, reward_id, recipient, source_id) → i128
issue_campaign_reward(issuer, reward_id, recipient, source_id, amount_star) → i128
get_reward(reward_id) → RewardRecord
admin() → Address
paused() → bool
```

#### Payment Engine (`payment-engine`)
```rust
initialize(admin, star_token, reward_engine, merchant_registry, operator) → ()
set_admin(new_admin) → ()
set_operator(new_operator) → ()
pause() / unpause() → ()
create_payment(operator, payment_id, payer, merchant_id, asset, amount_in_paise, qr_hash, reward_id) → ()
quote_payment(operator, payment_id, asset_amount, usdc_amount, network_fee_paise) → ()
mark_converted(operator, payment_id) → ()
mark_settled(operator, payment_id, stellar_tx_hash, ledger) → ()
issue_reward(operator, payment_id) → ()
complete_payment(operator, payment_id) → ()
refund_payment(operator, payment_id) → ()
get_payment(payment_id) → PaymentRecord
is_operator(addr) → bool
admin() → Address
paused() → bool
```

### 3.4 TTL Extension Coverage (Post-Fix)

| Contract | Keys Extended | Locations |
|----------|---------------|-----------|
| star-token | Authorized, Minter, Balance, Allowance | `initialize(2)`, `set_admin(2)`, `set_minter(2)`, `set_authorized(1)`, `set_balance(1)`, `approve(1)`, `spend_allowance(1)` = **10** |
| merchant-registry | Merchant | `write_merchant(1)` = **1** |
| reward-engine | AuthorizedIssuer, Reward | `initialize(1)`, `set_admin(1)`, `set_issuer(1)`, `issue_reward(1)` = **4** |
| payment-engine | Payment | `write_payment(1)` = **1** |
| **TOTAL** | | **17** |

### 3.5 Gaps / Risks in Contracts
| Issue | Severity | Detail |
|-------|----------|--------|
| No `get_payments_by_merchant` / pagination | Medium | Only single `get_payment`; off-chain indexing needed |
| No payment expiry/TTL enforcement on-chain | Medium | `expiresAt` stored in DB only; contract doesn't auto-expire |
| `asset` enum limited to 5 codes | Low | Hardcoded in contract; new assets require upgrade |
| No fee collection / protocol revenue | Low | `network_fee_paise` accepted but not distributed |
| `refund_payment` only callable by operator | Medium | No user-initiated refund path |
| No upgradeability pattern (no `upgrade` fn) | High | Contracts immutable; requires redeploy + migration |

---

## 4. Backend API & Integration Layer

### 4.1 API Endpoint Coverage

| Module | Endpoints | Auth | Notes |
|--------|-----------|------|-------|
| **Auth** | `POST /auth/wallet/challenge`, `POST /auth/wallet/verify`, `POST /auth/refresh`, `GET /auth/me` | Public / JWT | SEP-10 + JWT rotation ✅ |
| **Users** | `GET /users/me`, `PATCH /users/me` | JWT | Profile + KYC status |
| **Wallets** | `GET /wallets`, `POST /wallets`, `GET /wallets/:id/balance` | JWT | Stellar account abstraction |
| **Transactions** | `POST /transactions/create`, `GET /transactions`, `GET /transactions/:id` | JWT | Pay flow entry point |
| **Merchants** | `POST /merchants`, `GET /merchants`, `GET /merchants/:id`, `POST /merchants/:id/qr` | Merchant/Admin | QR payload hash stored |
| **Campaigns** | CRUD + activate/pause/complete + analytics + merchant linking | Merchant/Admin | Full lifecycle |
| **Rewards** | `GET /rewards`, `GET /rewards/analytics` | JWT | Consumer view |
| **Referrals** | `POST /referrals`, `POST /referrals/accept`, `POST /:id/qualify`, `POST /:id/reward` | JWT | Full funnel |
| **Ramps** | `POST /ramps/authenticate`, `POST /ramps/deposit`, `POST /ramps/withdraw`, `GET /ramps/transaction/:id` | JWT | MoneyGram SEP-24 |
| **KYC** | `POST /kyc/start`, `POST /kyc/webhook` | JWT / Public | KYCAID |
| **Settlement** | Internal only (called by processor) | — | Decentro UPI |
| **Admin** | Merchants, transactions, rewards, logs | Admin | Monitoring |

### 4.2 Soroban Service Integration (`soroban.service.ts`)

| Method | Contract Call | Status |
|--------|---------------|--------|
| `createPayment` | `payment_engine.create_payment` | ⚠️ **BUG: missing `operator` param** (line 112) |
| `quotePayment` | `payment_engine.quote_payment` | ✅ |
| `markConverted` | `payment_engine.mark_converted` | ✅ |
| `markSettled` | `payment_engine.mark_settled` | ✅ |
| `issueReward` | `payment_engine.issue_reward` | ✅ |
| `completePayment` | `payment_engine.complete_payment` | ✅ |
| `registerMerchant` | `merchant_registry.register_merchant` | ✅ |
| `approveMerchant` | `merchant_registry.approve_merchant` | ✅ |
| `isMerchantApproved` | `merchant_registry.is_approved` | ✅ |
| `issueReward` (spend) | `reward_engine.issue_spend_reward` | ✅ |
| `getReward` | `reward_engine.get_reward` | ✅ |
| `getStellarBalance` | Horizon `accounts/{pubkey}` | ✅ |

**Critical Bug:** `createPayment` at line 112 calls:
```typescript
await this.contractClient.createPayment({
  paymentId: params.paymentId,
  payer: params.payer,
  merchantId: params.merchantId,
  asset: params.asset,
  amountInPaise: params.amountInPaise,
  qrHash: params.qrHash,
  rewardId: params.rewardId,
});
```
**Missing `operator`** — contract expects `(operator, payment_id, payer, ...)`. This will fail on-chain with auth error.

### 4.3 Transaction Processor Issues (`transaction-processor.service.ts`)

| Line | Issue | Severity |
|------|-------|----------|
| 146 | `const { hash, ledger } = await this.stellarService.submitPayment(...)` — `hash` used at line 260 but **out of scope** (inside try block) | **Critical** |
| 162 | `hash` referenced at line 260 (`stellarHash: hash`) but not declared in catch scope | **Critical** |
| 223 | `const rewardResult = await this.sorobanService.issueReward(tx.id)` — `rewardResult` used at line 261 but **not in scope** | **Critical** |
| 188-202 | **Blocking polling loop** (10s × 30 = 5 min) inside cron handler — blocks entire Node event loop | **High** |
| 241-248 | Duplicate `settlementInstruction.updateMany` (also at 178-185) | Medium |
| 265 | `hash` used in adminLog but undefined | **Critical** |

### 4.4 Circuit Breaker & Resilience
- **Implemented:** `CircuitBreakerService` with exponential backoff (3 policies: KYCAID, Decentro, CoinGecko)
- **Used in:** KYC service, Settlement service, Stellar service (getUsdcRate)
- **Missing:** Circuit breaker on Soroban RPC calls; no retry on contract submission failure

### 4.5 Outbox Pattern
- `OutboxEvent` table + `TransactionEvent` for audit trail
- **No background worker** to publish outbox events to message bus (Kafka/RabbitMQ/Redis Streams)
- Events accumulate in DB only

---

## 5. Frontend Implementation & UX

### 5.1 Page Inventory (Next.js App Router)

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Landing (redirects to `/dashboard`) | ✅ |
| `/dashboard` | Consumer home (balances, quick actions, campaigns) | ✅ |
| `/pay` | **Core pay flow** (SCAN → QUOTE → PROCESSING → SUCCESS) | ✅ |
| `/history` | Transaction list + filters + pagination | ✅ |
| `/wallet` | XLM/USDC/STAR balances + on/off-ramp links | ✅ |
| `/wallet/onramp` | MoneyGram deposit (trustline → iframe → poll) | ✅ |
| `/wallet/offramp` | MoneyGram withdrawal (trustline → iframe → send USDC → poll) | ✅ |
| `/rewards` | STAR balance, tier, earn breakdown, referrals | ✅ |
| `/rewards/history` | Paginated reward history | ✅ |
| `/rewards/campaigns` | Active campaigns list | ✅ |
| `/rewards/campaigns/[id]` | Campaign detail + join | ✅ |
| `/rewards/referrals` | Referral code, invited list, status | ✅ |
| `/rewards/analytics` | Spend/reward charts | ⚠️ Stub |
| `/kyc` | KYC onboarding modal (integrated in layout) | ✅ |
| `/merchant` | Merchant dashboard (KPIs, revenue chart, txns) | ✅ |
| `/merchant/transactions` | Full transaction table + search/filter | ✅ |
| `/merchant/campaigns` | Campaign list + create link | ✅ |
| `/merchant/campaigns/create` | Campaign form (budget, multiplier, dates) | ✅ |
| `/merchant/campaigns/[id]` | Campaign detail + analytics + actions | ✅ |
| `/admin/*` | Admin pages (not audited — likely stub) | ❓ |

### 5.2 Key UX Flows Verified

| Flow | Components | Status |
|------|------------|--------|
| **Wallet Connect** | `StellarWalletProvider` → `Freighter` → SEP-10 challenge → JWT | ✅ |
| **Pay — QR Scan** | `html5-qrcode` → parse UPI → resolve merchant → asset select → quote → confirm | ✅ |
| **Pay — Manual VPA** | Input → resolve → same as above | ✅ |
| **Payment Confirm** | `PaymentConfirm` modal → WebAuthn biometric → PIN fallback → `onConfirmed` | ✅ |
| **On-Ramp** | Trustline check → SEP-10 auth → SEP-24 deposit iframe → poll status | ✅ |
| **Off-Ramp** | Trustline check → SEP-10 auth → SEP-24 withdraw iframe → send USDC → poll | ✅ |
| **Merchant Dashboard** | Metrics cards + chart + transaction table | ✅ |
| **Campaign Create** | Form → `campaigns.createCampaign` SDK → redirect | ✅ |

### 5.3 Frontend Gaps / Hardcoding

| File | Issue |
|------|-------|
| `dashboard/page.tsx:33` | `DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"` hardcoded |
| `dashboard/page.tsx:258-262` | Contract addresses with `...` truncation — not clickable on testnet explorer |
| `merchant/page.tsx:77` | Hardcoded `"Chai Point — Demo"` merchant name |
| `pay/page.tsx` | Uses `cryptoPaySdk.transactions.createTransaction` but **no loading/error boundary** for Soroban submission |
| `wallet/onramp/page.tsx:179` | `pollStatus` called recursively without cleanup on unmount |
| `wallet/offramp/page.tsx:114` | Same recursive polling issue |
| `@cryptopay/sdk` | No TypeScript strict null checks on API responses (cast to `any` in multiple places) |

---

## 6. Testing, CI/CD & Observability

### 6.1 Test Coverage

| Layer | Framework | Tests | Status |
|-------|-----------|-------|--------|
| **Contracts** | `soroban-sdk` testutils | 21 (6+5+6+4) | ✅ All pass |
| **API Unit** | Jest + NestJS testing | ~5 (auth, kyc, ramps) | ⚠️ Minimal |
| **API E2E** | None | 0 | ❌ Missing |
| **Web Unit** | Vitest + React Testing Library | 0 | ❌ Missing |
| **Web E2E** | None | 0 | ❌ Missing |
| **Integration** | None (contract↔API↔Web) | 0 | ❌ Missing |

### 6.2 CI Pipeline (`.github/workflows/ci.yml`)
```yaml
- PostgreSQL service (test DB)
- npm ci
- prisma generate + migrate deploy
- turbo run build
- turbo run test --passWithNoTests
- turbo run typecheck
```
**Gaps:** No contract test in CI (needs `cargo test` in contracts), no lint, no security audit, no dependency scan.

### 6.3 Deploy Pipeline (`.github/workflows/deploy.yml`)
- **API:** Railway webhook trigger
- **Web:** Vercel webhook trigger
- **Contracts:** **No deployment step** — manual `soroban contract deploy` required
- **No staging environment**, no smoke tests post-deploy

### 6.4 Observability
| Aspect | Implementation |
|--------|----------------|
| **Logging** | NestJS `Logger` + `adminLog` Prisma table (audit trail) |
| **Metrics** | None (no Prometheus/OpenTelemetry) |
| **Tracing** | None |
| **Error Tracking** | Console only (no Sentry/Datadog) |
| **Health Checks** | None (no `/health` endpoint) |
| **Alerting** | None |

---

## 7. Security, Compliance & Critical Gaps

### 7.1 Authentication & Authorization
| Check | Status | Notes |
|-------|--------|-------|
| SEP-10 challenge nonce (96-bit entropy) | ✅ | `crypto.randomBytes(12)` |
| SEP-10 signature verification (3 formats) | ✅ | Handles `challenge` + `account` variants |
| JWT short-lived (15m) + refresh rotation | ✅ | Reuse detection revokes family |
| Password hashing (bcrypt) | ✅ | For email/password fallback |
| Role guards on all mutating endpoints | ✅ | `RolesGuard` + `@Roles()` |
| **Rate limiting on auth endpoints** | ❌ | **Missing** — brute-forceable |
| **CORS restricted to known origins** | ⚠️ | Only Vercel/Render in `main.ts`; no wildcard block |
| **Helmet / security headers** | ❌ | Not configured |

### 7.2 Smart Contract Security
| Check | Status | Notes |
|-------|--------|-------|
| `require_auth` on all state-changing fns | ✅ | Verified |
| Admin-only config changes | ✅ | `admin.require_auth()` |
| Operator-only payment lifecycle | ✅ | Fixed in Phase 1 |
| TTL extensions on all persistent writes | ✅ | 17 locations fixed |
| Reentrancy protection | ⚠️ | No cross-contract calls in same tx except `mint_from_minter` (read-only after auth) |
| Integer overflow checks | ✅ | Rust `checked_add` / Soroban SDK |
| **Upgradeability / migration path** | ❌ | **Immutable contracts** — no `upgrade` entrypoint |
| **Emergency pause** | ✅ | All 4 contracts have `pause()` |

### 7.3 Compliance (KYC/AML)
| Requirement | Status | Gap |
|-------------|--------|-----|
| KYC onboarding (KYCAID) | ✅ | Implemented |
| KYC webhook signature verification | ✅ | HMAC-SHA256 |
| **AML sanctions screening** | ❌ | **No OFAC/UN/EU list check** |
| **PEP / adverse media screening** | ❌ | **Missing** |
| **Transaction monitoring (thresholds, velocity)** | ❌ | **Missing** |
| **SAR/STR filing workflow** | ❌ | **Missing** |
| **Ongoing KYC refresh** | ❌ | **One-time only** |
| **Travel Rule (beneficiary info)** | ❌ | Not applicable (UPI domestic) but missing for cross-border |

### 7.4 Data Protection
| Check | Status |
|-------|--------|
| PII encrypted at rest | ❌ (PostgreSQL plaintext) |
| PCI DSS (card data) | N/A (no card processing) |
| GDPR right to erasure | ❌ No `DELETE /users/me` endpoint |
| Audit log immutability | ⚠️ `adminLog` in same DB (no WORM) |

### 7.5 Infrastructure & Secrets
| Check | Status |
|-------|--------|
| Secrets in env vars only | ✅ (but no Vault/SealedSecrets) |
| `PLATFORM_STELLAR_SECRET_KEY` in env | ⚠️ **High value key** — no HSM/KMS |
| Database TLS enforced | ❓ Not verified (Railway managed) |
| API rate limiting | ❌ Missing |
| WAF / DDoS protection | ❌ Missing |

---

## 8. Prioritized Remediation Plan

### P0 — Blocks Production / Data Loss
| # | Task | Owner | Effort |
|---|------|-------|--------|
| 1 | Fix `soroban.service.ts:createPayment` — add `operator` parameter | Backend | 1h |
| 2 | Fix `transaction-processor.service.ts` scope bugs (`hash`, `ledger`, `rewardResult`) | Backend | 2h |
| 3 | Convert settlement polling to async job (BullMQ/pg-boss) — **unblocks event loop** | Backend | 4h |
| 4 | Add contract upgradeability pattern (proxy + admin) or document migration plan | Contracts | 2d |

### P1 — Security / Compliance
| # | Task | Owner | Effort |
|---|------|-------|--------|
| 5 | Add rate limiting (`@nestjs/throttler`) on `/auth/*`, `/kyc/*`, `/transactions/create` | Backend | 2h |
| 6 | Integrate AML screening (ComplyAdvantage/Sumsub/Chainalysis) on KYC + transaction | Backend | 1w |
| 7 | Add PEP/adverse media check to KYC flow | Backend | 3d |
| 8 | Implement transaction monitoring rules (velocity, amount thresholds) | Backend | 1w |
| 9 | Add Helmet + strict CSP + HSTS | Backend | 1h |
| 10 | Rotate `PLATFORM_STELLAR_SECRET_KEY` to KMS/HSM | Infra | 1d |

### P2 — Reliability & Observability
| # | Task | Owner | Effort |
|---|------|-------|--------|
| 11 | Add Prometheus metrics + `/health` + `/ready` endpoints | Backend | 4h |
| 12 | Set up Sentry for API + Web | Fullstack | 2h |
| 13 | Implement outbox publisher (Redis Streams / Kafka) | Backend | 2d |
| 14 | Add contract tests to CI (`cargo test --workspace`) | Contracts | 1h |
| 15 | Add API unit test coverage target (≥60%) | Backend | 1w |
| 16 | Add web E2E tests (Playwright) for pay flow | Frontend | 3d |

### P3 — Feature Completeness
| # | Task | Owner | Effort |
|---|------|-------|--------|
| 17 | Add fallback on-ramp anchor (e.g., AnchorUSD, Wyre) | Backend | 1w |
| 18 | Implement user-initiated refund path (contract + API) | Fullstack | 3d |
| 19 | Add pagination to `get_payments_by_merchant` (contract + indexer) | Contracts | 2d |
| 20 | Replace hardcoded demo IDs with real user context | Frontend | 2h |
| 21 | Add GDPR delete endpoint + data export | Backend | 2d |

---

## 9. Appendix: File Index (Key Files Audited)

| Path | Purpose |
|------|---------|
| `contracts/star-token/src/lib.rs` | STAR token + minter/authorized roles |
| `contracts/merchant-registry/src/lib.rs` | Merchant lifecycle |
| `contracts/reward-engine/src/lib.rs` | Reward minting (spend/referral/campaign/merchant) |
| `contracts/payment-engine/src/lib.rs` | Payment lifecycle (create→quote→convert→settle→reward→complete) |
| `apps/api/src/auth/auth.service.ts` | SEP-10 + JWT rotation |
| `apps/api/src/stellar/soroban.service.ts` | Contract client wrapper |
| `apps/api/src/transaction-processor/transaction-processor.service.ts` | Cron job processing payments |
| `apps/api/src/settlement/settlement.service.ts` | Decentro UPI payouts |
| `apps/api/src/ramps/ramps.service.ts` | MoneyGram SEP-24 |
| `apps/api/src/kyc/kyc.service.ts` | KYCAID integration |
| `apps/api/prisma/schema.prisma` | Full data model |
| `apps/web/src/components/providers/StellarWalletProvider.tsx` | Freighter + SEP-10 login |
| `apps/web/src/app/pay/page.tsx` | Core pay flow (4 steps) |
| `apps/web/src/components/auth/PaymentConfirm.tsx` | Biometric/PIN confirm |
| `apps/web/src/app/wallet/onramp/page.tsx` | MoneyGram deposit |
| `apps/web/src/app/wallet/offramp/page.tsx` | MoneyGram withdrawal |
| `apps/web/src/app/merchant/*.tsx` | Merchant dashboard, campaigns, transactions |
| `packages/sdk/src/*` | Typed API client |
| `.github/workflows/ci.yml` | CI pipeline |
| `.github/workflows/deploy.yml` | Deploy triggers |

---

**End of Audit**  
*Generated via automated code review — verify critical findings manually before production decisions.*