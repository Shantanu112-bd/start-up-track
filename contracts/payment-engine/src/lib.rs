#![cfg_attr(target_family = "wasm", no_std)]
#![allow(clippy::too_many_arguments)]

//! Payment engine.
//!
//! TRUST ASSUMPTION (T4.4): this contract does NOT consult an on-chain price
//! oracle. Every economic figure — `amount_in_paise`, the crypto asset code,
//! the off-chain FX quote and settlement amounts — is supplied by the
//! authorized operator when it drives a payment through its lifecycle. The
//! contract enforces authorization, merchant approval, the state machine, and
//! idempotency; it does NOT independently verify that the quoted rate or the
//! paise amount reflect a fair market price. Operators are trusted to quote
//! honestly. A compromised or dishonest operator can mis-state amounts, so the
//! operator key must be held to the same custody standard as the admin key.
//! This is a deliberate design decision: FX and crypto pricing live off-chain
//! in the provider-agnostic ramp layer, keeping the contract oracle-free.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    symbol_short, Address, BytesN, Env, Symbol,
};

#[contractclient(name = "MerchantRegistryClient")]
pub trait MerchantRegistryInterface {
    fn is_approved(env: Env, merchant_id: BytesN<32>) -> bool;
}

#[contractclient(name = "RewardEngineClient")]
pub trait RewardEngineInterface {
    fn issue_spend_reward(
        env: Env,
        issuer: Address,
        reward_id: BytesN<32>,
        recipient: Address,
        source_id: BytesN<32>,
        amount_in_paise: i128,
    ) -> i128;
}

/// Instance-storage TTL management (see merchant-registry for rationale).
const INSTANCE_BUMP_THRESHOLD: u32 = 518_400; // ~30 days of ledgers
const INSTANCE_BUMP_AMOUNT: u32 = 1_036_800; // ~60 days of ledgers

#[contract]
pub struct PaymentEngine;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PaymentEngineError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Paused = 3,
    Unauthorized = 4,
    InvalidAmount = 5,
    MerchantNotApproved = 6,
    PaymentAlreadyExists = 7,
    PaymentNotFound = 8,
    InvalidStatus = 9,
    NoPendingAdmin = 10,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum AssetCode {
    ETH = 1,
    BTC = 2,
    SOL = 3,
    XLM = 4,
    USDC = 5,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum PaymentStatus {
    Created = 1,
    Quoted = 2,
    Converted = 3,
    Settled = 4,
    Rewarded = 5,
    Completed = 6,
    Failed = 7,
    Cancelled = 8,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentRecord {
    pub payment_id: BytesN<32>,
    pub payer: Address,
    pub merchant_id: BytesN<32>,
    pub asset: AssetCode,
    pub amount_in_paise: i128,
    pub qr_hash: BytesN<32>,
    pub reward_id: BytesN<32>,
    pub asset_amount: i128,
    pub usdc_amount: i128,
    pub network_fee_paise: i128,
    pub star_reward: i128,
    pub status: PaymentStatus,
    pub created_ledger: u32,
    pub updated_ledger: u32,
}

#[contractevent(topics = ["payment"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentEvent {
    #[topic]
    pub action: Symbol,
    #[topic]
    pub payment_id: BytesN<32>,
    pub actor: Address,
    pub status: PaymentStatus,
    pub amount: i128,
}

#[contractevent(topics = ["payment_cfg"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentConfigEvent {
    #[topic]
    pub action: Symbol,
    #[topic]
    pub account: Address,
    pub counterparty: Address,
    pub flag: bool,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Initialized,
    MerchantRegistry,
    Operator(Address),
    Paused,
    Payment(BytesN<32>),
    PendingAdmin,
    RewardEngine,
}

#[contractimpl]
impl PaymentEngine {
    // T3.2: atomic deploy+init via __constructor (see merchant-registry).
    pub fn __constructor(
        env: Env,
        admin: Address,
        merchant_registry: Address,
        reward_engine: Address,
    ) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage()
            .instance()
            .set(&DataKey::MerchantRegistry, &merchant_registry);
        env.storage()
            .instance()
            .set(&DataKey::RewardEngine, &reward_engine);
        env.storage()
            .persistent()
            .set(&DataKey::Operator(admin.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Operator(admin.clone()), 100, 518400);
        bump_instance(&env);
        PaymentConfigEvent {
            action: symbol_short!("init"),
            account: admin.clone(),
            counterparty: reward_engine,
            flag: true,
        }
        .publish(&env);
    }

    pub fn admin(env: Env) -> Result<Address, PaymentEngineError> {
        require_initialized(&env)?;
        Ok(read_admin(&env))
    }

    /// Permissionless: extend the instance-storage TTL. Anyone may call this.
    pub fn heartbeat(env: Env) -> Result<(), PaymentEngineError> {
        require_initialized(&env)?;
        bump_instance(&env);
        Ok(())
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), PaymentEngineError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);
        PaymentConfigEvent {
            action: symbol_short!("adm_prop"),
            account: admin,
            counterparty: new_admin,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    /// Second step of the two-step admin handoff: the proposed admin claims the
    /// role by authorizing itself, then the OUTGOING admin's operator privilege
    /// is revoked (T1.1) so a rotated-out key can no longer create/settle/refund
    /// payments. Skip revocation on self-rotation.
    pub fn accept_admin(env: Env) -> Result<(), PaymentEngineError> {
        require_not_paused(&env)?;
        let pending: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .ok_or(PaymentEngineError::NoPendingAdmin)?;
        pending.require_auth();
        let old_admin = read_admin(&env);

        if old_admin != pending {
            env.storage()
                .persistent()
                .set(&DataKey::Operator(old_admin.clone()), &false);
        }

        env.storage().instance().set(&DataKey::Admin, &pending);
        env.storage().instance().remove(&DataKey::PendingAdmin);
        env.storage()
            .persistent()
            .set(&DataKey::Operator(pending.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Operator(pending.clone()), 100, 518400);
        PaymentConfigEvent {
            action: symbol_short!("admin"),
            account: old_admin,
            counterparty: pending,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn pause(env: Env) -> Result<(), PaymentEngineError> {
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        PaymentConfigEvent {
            action: symbol_short!("pause"),
            account: admin.clone(),
            counterparty: admin,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), PaymentEngineError> {
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        PaymentConfigEvent {
            action: symbol_short!("unpause"),
            account: admin.clone(),
            counterparty: admin,
            flag: false,
        }
        .publish(&env);
        Ok(())
    }

    pub fn paused(env: Env) -> Result<bool, PaymentEngineError> {
        require_initialized(&env)?;
        Ok(is_paused(&env))
    }

    pub fn set_operator(
        env: Env,
        operator: Address,
        enabled: bool,
    ) -> Result<(), PaymentEngineError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Operator(operator.clone()), &enabled);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Operator(operator.clone()), 100, 518400);
        PaymentConfigEvent {
            action: symbol_short!("operator"),
            account: operator.clone(),
            counterparty: operator,
            flag: enabled,
        }
        .publish(&env);
        Ok(())
    }

    pub fn set_contracts(
        env: Env,
        merchant_registry: Address,
        reward_engine: Address,
    ) -> Result<(), PaymentEngineError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::MerchantRegistry, &merchant_registry);
        env.storage()
            .instance()
            .set(&DataKey::RewardEngine, &reward_engine);
        PaymentConfigEvent {
            action: symbol_short!("config"),
            account: admin,
            counterparty: reward_engine,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    /// Create a payment. `amount_in_paise` and `asset` are operator-supplied and
    /// trusted as-is (T4.4): the contract validates authorization, merchant
    /// approval and idempotency, but has no oracle to check the amount against a
    /// market rate.
    pub fn create_payment(
        env: Env,
        operator: Address,
        payer: Address,
        payment_id: BytesN<32>,
        merchant_id: BytesN<32>,
        asset: AssetCode,
        amount_in_paise: i128,
        qr_hash: BytesN<32>,
        reward_id: BytesN<32>,
    ) -> Result<(), PaymentEngineError> {
        require_not_paused(&env)?;
        require_operator(&env, &operator)?;
        if amount_in_paise <= 0 {
            return Err(PaymentEngineError::InvalidAmount);
        }
        if has_payment(&env, &payment_id) {
            return Err(PaymentEngineError::PaymentAlreadyExists);
        }
        let registry = read_merchant_registry(&env);
        let registry_client = MerchantRegistryClient::new(&env, &registry);
        if !registry_client.is_approved(&merchant_id) {
            return Err(PaymentEngineError::MerchantNotApproved);
        }

        let ledger = env.ledger().sequence();
        let payment = PaymentRecord {
            payment_id: payment_id.clone(),
            payer,
            merchant_id,
            asset,
            amount_in_paise,
            qr_hash,
            reward_id,
            asset_amount: 0,
            usdc_amount: 0,
            network_fee_paise: 0,
            star_reward: 0,
            status: PaymentStatus::Created,
            created_ledger: ledger,
            updated_ledger: ledger,
        };
        write_payment(&env, &payment);
        PaymentEvent {
            action: symbol_short!("created"),
            payment_id,
            actor: payment.payer,
            status: payment.status,
            amount: amount_in_paise,
        }
        .publish(&env);
        Ok(())
    }

    pub fn quote_payment(
        env: Env,
        operator: Address,
        payment_id: BytesN<32>,
        asset_amount: i128,
        usdc_amount: i128,
        network_fee_paise: i128,
    ) -> Result<(), PaymentEngineError> {
        require_operator(&env, &operator)?;
        if asset_amount <= 0 || usdc_amount <= 0 || network_fee_paise < 0 {
            return Err(PaymentEngineError::InvalidAmount);
        }
        let mut payment = read_payment(&env, &payment_id)?;
        require_status(&payment, PaymentStatus::Created)?;
        payment.asset_amount = asset_amount;
        payment.usdc_amount = usdc_amount;
        payment.network_fee_paise = network_fee_paise;
        payment.status = PaymentStatus::Quoted;
        touch_and_write(&env, &mut payment);
        PaymentEvent {
            action: symbol_short!("quoted"),
            payment_id,
            actor: operator,
            status: payment.status,
            amount: usdc_amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn mark_converted(
        env: Env,
        operator: Address,
        payment_id: BytesN<32>,
    ) -> Result<(), PaymentEngineError> {
        transition_operator(
            &env,
            operator,
            payment_id,
            PaymentStatus::Quoted,
            PaymentStatus::Converted,
            symbol_short!("convert"),
        )
    }

    pub fn mark_settled(
        env: Env,
        operator: Address,
        payment_id: BytesN<32>,
    ) -> Result<(), PaymentEngineError> {
        transition_operator(
            &env,
            operator,
            payment_id,
            PaymentStatus::Converted,
            PaymentStatus::Settled,
            symbol_short!("settled"),
        )
    }

    pub fn issue_reward(
        env: Env,
        operator: Address,
        payment_id: BytesN<32>,
    ) -> Result<i128, PaymentEngineError> {
        require_operator(&env, &operator)?;
        let mut payment = read_payment(&env, &payment_id)?;
        require_status(&payment, PaymentStatus::Settled)?;

        let reward_engine = read_reward_engine(&env);
        let reward_client = RewardEngineClient::new(&env, &reward_engine);
        let issuer = env.current_contract_address();
        // T2.2: use the non-trapping try_ variant. If the reward engine reverts
        // (e.g. STAR supply cap reached, reward engine paused), a *settled*
        // payment must still be able to reach a terminal state instead of being
        // permanently trapped in Settled. On failure we record star_reward = 0
        // and emit a distinct "rewarderr" event so the shortfall is auditable;
        // the payment still advances to Rewarded and can be completed.
        let amount = match reward_client.try_issue_spend_reward(
            &issuer,
            &payment.reward_id,
            &payment.payer,
            &payment.payment_id,
            &payment.amount_in_paise,
        ) {
            Ok(Ok(amount)) => amount,
            _ => 0,
        };
        payment.star_reward = amount;
        payment.status = PaymentStatus::Rewarded;
        touch_and_write(&env, &mut payment);
        PaymentEvent {
            action: if amount > 0 {
                symbol_short!("reward")
            } else {
                symbol_short!("rewarderr")
            },
            payment_id,
            actor: operator,
            status: payment.status,
            amount,
        }
        .publish(&env);
        Ok(amount)
    }

    pub fn complete_payment(
        env: Env,
        operator: Address,
        payment_id: BytesN<32>,
    ) -> Result<(), PaymentEngineError> {
        transition_operator(
            &env,
            operator,
            payment_id,
            PaymentStatus::Rewarded,
            PaymentStatus::Completed,
            symbol_short!("complete"),
        )
    }

    pub fn cancel_payment(
        env: Env,
        payer: Address,
        payment_id: BytesN<32>,
    ) -> Result<(), PaymentEngineError> {
        require_not_paused(&env)?;
        payer.require_auth();
        let mut payment = read_payment(&env, &payment_id)?;
        if payment.payer != payer {
            return Err(PaymentEngineError::Unauthorized);
        }
        if payment.status != PaymentStatus::Created && payment.status != PaymentStatus::Quoted {
            return Err(PaymentEngineError::InvalidStatus);
        }
        payment.status = PaymentStatus::Cancelled;
        touch_and_write(&env, &mut payment);
        PaymentEvent {
            action: symbol_short!("cancel"),
            payment_id,
            actor: payer,
            status: payment.status,
            amount: payment.amount_in_paise,
        }
        .publish(&env);
        Ok(())
    }

    pub fn fail_payment(
        env: Env,
        operator: Address,
        payment_id: BytesN<32>,
    ) -> Result<(), PaymentEngineError> {
        require_operator(&env, &operator)?;
        let mut payment = read_payment(&env, &payment_id)?;
        if payment.status == PaymentStatus::Completed || payment.status == PaymentStatus::Cancelled
        {
            return Err(PaymentEngineError::InvalidStatus);
        }
        payment.status = PaymentStatus::Failed;
        touch_and_write(&env, &mut payment);
        PaymentEvent {
            action: symbol_short!("failed"),
            payment_id,
            actor: operator,
            status: payment.status,
            amount: payment.amount_in_paise,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_payment(
        env: Env,
        payment_id: BytesN<32>,
    ) -> Result<PaymentRecord, PaymentEngineError> {
        require_initialized(&env)?;
        read_payment(&env, &payment_id)
    }
}

fn transition_operator(
    env: &Env,
    operator: Address,
    payment_id: BytesN<32>,
    from: PaymentStatus,
    to: PaymentStatus,
    event: Symbol,
) -> Result<(), PaymentEngineError> {
    require_operator(env, &operator)?;
    let mut payment = read_payment(env, &payment_id)?;
    require_status(&payment, from)?;
    payment.status = to;
    touch_and_write(env, &mut payment);
    PaymentEvent {
        action: event,
        payment_id,
        actor: operator,
        status: payment.status,
        amount: payment.amount_in_paise,
    }
    .publish(env);
    Ok(())
}

fn is_initialized(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Initialized)
        .unwrap_or(false)
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

fn require_initialized(env: &Env) -> Result<(), PaymentEngineError> {
    if !is_initialized(env) {
        return Err(PaymentEngineError::NotInitialized);
    }
    Ok(())
}

fn require_not_paused(env: &Env) -> Result<(), PaymentEngineError> {
    require_initialized(env)?;
    if is_paused(env) {
        return Err(PaymentEngineError::Paused);
    }
    Ok(())
}

fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false)
}

fn read_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic!("payment engine not initialized"))
}

fn read_merchant_registry(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::MerchantRegistry)
        .unwrap_or_else(|| panic!("merchant registry not configured"))
}

fn read_reward_engine(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::RewardEngine)
        .unwrap_or_else(|| panic!("reward engine not configured"))
}

fn require_operator(env: &Env, operator: &Address) -> Result<(), PaymentEngineError> {
    require_not_paused(env)?;
    operator.require_auth();
    let enabled = env
        .storage()
        .persistent()
        .get(&DataKey::Operator(operator.clone()))
        .unwrap_or(false);
    if !enabled {
        return Err(PaymentEngineError::Unauthorized);
    }
    Ok(())
}

fn has_payment(env: &Env, payment_id: &BytesN<32>) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Payment(payment_id.clone()))
}

fn read_payment(env: &Env, payment_id: &BytesN<32>) -> Result<PaymentRecord, PaymentEngineError> {
    env.storage()
        .persistent()
        .get(&DataKey::Payment(payment_id.clone()))
        .ok_or(PaymentEngineError::PaymentNotFound)
}

fn write_payment(env: &Env, payment: &PaymentRecord) {
    let key = DataKey::Payment(payment.payment_id.clone());
    env.storage()
        .persistent()
        .set(&key, payment);
    env.storage().persistent().extend_ttl(&key, 100, 518400);
}

fn touch_and_write(env: &Env, payment: &mut PaymentRecord) {
    payment.updated_ledger = env.ledger().sequence();
    write_payment(env, payment);
}

fn require_status(
    payment: &PaymentRecord,
    status: PaymentStatus,
) -> Result<(), PaymentEngineError> {
    if payment.status != status {
        return Err(PaymentEngineError::InvalidStatus);
    }
    Ok(())
}

#[cfg(test)]
mod test {
    extern crate std;

    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

    #[contract]
    pub struct MockMerchantRegistry;

    #[contracttype]
    #[derive(Clone)]
    enum RegistryKey {
        Approved(BytesN<32>),
    }

    #[contractimpl]
    impl MockMerchantRegistry {
        pub fn set_approved(env: Env, merchant_id: BytesN<32>, approved: bool) {
            let key = RegistryKey::Approved(merchant_id);
            env.storage()
                .persistent()
                .set(&key, &approved);
            env.storage().persistent().extend_ttl(&key, 100, 518400);
        }

        pub fn is_approved(env: Env, merchant_id: BytesN<32>) -> bool {
            env.storage()
                .persistent()
                .get(&RegistryKey::Approved(merchant_id))
                .unwrap_or(false)
        }
    }

    #[contract]
    pub struct MockRewardEngine;

    #[contracttype]
    #[derive(Clone)]
    enum RewardKey {
        Reward(BytesN<32>),
    }

    #[contractimpl]
    impl MockRewardEngine {
        pub fn issue_spend_reward(
            env: Env,
            _issuer: Address,
            reward_id: BytesN<32>,
            _recipient: Address,
            _source_id: BytesN<32>,
            amount_in_paise: i128,
        ) -> i128 {
            let amount = (amount_in_paise / 10_000) * 10;
            let key = RewardKey::Reward(reward_id);
            env.storage()
                .persistent()
                .set(&key, &amount);
            env.storage().persistent().extend_ttl(&key, 100, 518400);
            amount
        }
    }

    // A reward engine that always traps, mimicking STAR supply-cap exhaustion
    // or a paused reward engine. Used to prove a settled payment is not
    // permanently trapped when reward issuance fails (T2.2).
    #[contract]
    pub struct FailingRewardEngine;

    #[contractimpl]
    impl FailingRewardEngine {
        pub fn issue_spend_reward(
            _env: Env,
            _issuer: Address,
            _reward_id: BytesN<32>,
            _recipient: Address,
            _source_id: BytesN<32>,
            _amount_in_paise: i128,
        ) -> i128 {
            panic!("reward engine unavailable (e.g. STAR supply cap reached)");
        }
    }

    fn bytes(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn setup() -> (
        Env,
        PaymentEngineClient<'static>,
        MockMerchantRegistryClient<'static>,
        Address,
        Address,
        Address,
        BytesN<32>,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let registry_id = env.register(MockMerchantRegistry, ());
        let reward_id = env.register(MockRewardEngine, ());
        let admin = Address::generate(&env);
        let payment_id = env.register(PaymentEngine, (&admin, &registry_id, &reward_id));
        let payment_client = PaymentEngineClient::new(&env, &payment_id);
        let registry_client = MockMerchantRegistryClient::new(&env, &registry_id);
        let operator = Address::generate(&env);
        let payer = Address::generate(&env);
        let merchant_id = bytes(&env, 1);
        payment_client.set_operator(&operator, &true);
        registry_client.set_approved(&merchant_id, &true);
        (
            env,
            payment_client,
            registry_client,
            admin,
            operator,
            payer,
            merchant_id,
        )
    }

    #[test]
    fn creates_and_completes_payment_flow() {
        let (env, client, _registry, _admin, operator, payer, merchant_id) = setup();
        let payment_id = bytes(&env, 2);
        let reward_id = bytes(&env, 3);

        client.create_payment(
            &operator,
            &payer,
            &payment_id,
            &merchant_id,
            &AssetCode::USDC,
            &50_000,
            &bytes(&env, 4),
            &reward_id,
        );
        client.quote_payment(&operator, &payment_id, &600, &600, &50);
        client.mark_converted(&operator, &payment_id);
        client.mark_settled(&operator, &payment_id);
        let reward = client.issue_reward(&operator, &payment_id);
        client.complete_payment(&operator, &payment_id);

        let payment = client.get_payment(&payment_id);
        assert_eq!(reward, 50);
        assert_eq!(payment.status, PaymentStatus::Completed);
        assert_eq!(payment.star_reward, 50);
    }

    // T2.2: a settled payment must reach a terminal state even when the reward
    // engine reverts (e.g. STAR supply cap reached). Before the fix, issue_reward
    // used the trapping client call, so the whole tx reverted and the payment
    // was permanently stuck in Settled. Now issue_reward records star_reward = 0
    // and advances to Rewarded, allowing complete_payment to finish the flow.
    #[test]
    fn settled_payment_completes_when_reward_engine_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let registry_id = env.register(MockMerchantRegistry, ());
        let failing_reward_id = env.register(FailingRewardEngine, ());
        let admin = Address::generate(&env);
        let payment_contract =
            env.register(PaymentEngine, (&admin, &registry_id, &failing_reward_id));
        let client = PaymentEngineClient::new(&env, &payment_contract);
        let registry = MockMerchantRegistryClient::new(&env, &registry_id);
        let operator = Address::generate(&env);
        let payer = Address::generate(&env);
        let merchant_id = bytes(&env, 1);
        client.set_operator(&operator, &true);
        registry.set_approved(&merchant_id, &true);

        let payment_id = bytes(&env, 2);
        client.create_payment(
            &operator,
            &payer,
            &payment_id,
            &merchant_id,
            &AssetCode::USDC,
            &50_000,
            &bytes(&env, 4),
            &bytes(&env, 3),
        );
        client.quote_payment(&operator, &payment_id, &600, &600, &50);
        client.mark_converted(&operator, &payment_id);
        client.mark_settled(&operator, &payment_id);

        // issue_reward must NOT trap even though the reward engine panics.
        let reward = client.issue_reward(&operator, &payment_id);
        assert_eq!(reward, 0);

        // The payment can still be completed — it is not trapped in Settled.
        client.complete_payment(&operator, &payment_id);
        let payment = client.get_payment(&payment_id);
        assert_eq!(payment.status, PaymentStatus::Completed);
        assert_eq!(payment.star_reward, 0);
    }

    // T2.1: heartbeat() permissionlessly re-extends the instance TTL.
    #[test]
    fn heartbeat_extends_instance_ttl() {
        use soroban_sdk::testutils::storage::Instance as _;
        use soroban_sdk::testutils::Ledger as _;
        let (env, client, _registry, _admin, _operator, _payer, _merchant_id) = setup();
        let contract_id = client.address.clone();

        env.ledger().set_sequence_number(600_000);
        client.heartbeat();

        let ttl = env.as_contract(&contract_id, || env.storage().instance().get_ttl());
        assert_eq!(ttl, INSTANCE_BUMP_AMOUNT);
    }

    #[test]
    fn rejects_unapproved_merchant() {
        let (env, client, registry, _admin, operator, payer, merchant_id) = setup();
        registry.set_approved(&merchant_id, &false);
        assert_eq!(
            client.try_create_payment(
                &operator,
                &payer,
                &bytes(&env, 2),
                &merchant_id,
                &AssetCode::ETH,
                &50_000,
                &bytes(&env, 4),
                &bytes(&env, 5)
            ),
            Err(Ok(PaymentEngineError::MerchantNotApproved))
        );
    }

    #[test]
    fn set_admin_revokes_old_admin_operator_power() {
        // The initial admin is granted the Operator flag at initialize().
        // After a two-step rotation the old admin key must no longer be able to
        // create/settle payments (privilege-escalation regression guard). T4.1:
        // revocation happens on accept_admin, not on the propose step.
        let (env, client, _registry, admin, _operator, payer, merchant_id) = setup();

        // Sanity: the old admin can create a payment while still admin/operator.
        client.create_payment(
            &admin,
            &payer,
            &bytes(&env, 10),
            &merchant_id,
            &AssetCode::ETH,
            &50_000,
            &bytes(&env, 4),
            &bytes(&env, 5),
        );

        let new_admin = Address::generate(&env);

        // T4.1: proposing alone must NOT revoke the old admin's operator power.
        client.set_admin(&new_admin);
        client.create_payment(
            &admin,
            &payer,
            &bytes(&env, 20),
            &merchant_id,
            &AssetCode::ETH,
            &50_000,
            &bytes(&env, 4),
            &bytes(&env, 5),
        );

        client.accept_admin();
        assert_eq!(client.admin(), new_admin);

        // The rotated-out admin must now be rejected as an operator.
        assert_eq!(
            client.try_create_payment(
                &admin,
                &payer,
                &bytes(&env, 11),
                &merchant_id,
                &AssetCode::ETH,
                &50_000,
                &bytes(&env, 4),
                &bytes(&env, 5)
            ),
            Err(Ok(PaymentEngineError::Unauthorized))
        );

        // The new admin inherits operator power and can create payments.
        client.create_payment(
            &new_admin,
            &payer,
            &bytes(&env, 12),
            &merchant_id,
            &AssetCode::ETH,
            &50_000,
            &bytes(&env, 4),
            &bytes(&env, 5),
        );
    }

    // T4.1: accept_admin with no proposal outstanding is rejected.
    #[test]
    fn accept_admin_without_proposal_fails() {
        let (_env, client, _registry, _admin, _operator, _payer, _merchant_id) = setup();
        assert_eq!(
            client.try_accept_admin(),
            Err(Ok(PaymentEngineError::NoPendingAdmin))
        );
    }

    #[test]
    fn rejects_duplicate_payment_id() {
        let (env, client, _registry, _admin, operator, payer, merchant_id) = setup();
        let payment_id = bytes(&env, 2);

        client.create_payment(
            &operator,
            &payer,
            &payment_id,
            &merchant_id,
            &AssetCode::BTC,
            &50_000,
            &bytes(&env, 4),
            &bytes(&env, 5),
        );

        assert_eq!(
            client.try_create_payment(
                &operator,
                &payer,
                &payment_id,
                &merchant_id,
                &AssetCode::BTC,
                &50_000,
                &bytes(&env, 4),
                &bytes(&env, 6)
            ),
            Err(Ok(PaymentEngineError::PaymentAlreadyExists))
        );
    }

    #[test]
    fn enforces_status_transitions() {
        let (env, client, _registry, _admin, operator, payer, merchant_id) = setup();
        let payment_id = bytes(&env, 2);

        client.create_payment(
            &operator,
            &payer,
            &payment_id,
            &merchant_id,
            &AssetCode::SOL,
            &50_000,
            &bytes(&env, 4),
            &bytes(&env, 5),
        );

        assert_eq!(
            client.try_mark_settled(&operator, &payment_id),
            Err(Ok(PaymentEngineError::InvalidStatus))
        );
    }

    #[test]
    fn payer_can_cancel_before_conversion() {
        let (env, client, _registry, _admin, operator, payer, merchant_id) = setup();
        let payment_id = bytes(&env, 2);

        client.create_payment(
            &operator,
            &payer,
            &payment_id,
            &merchant_id,
            &AssetCode::XLM,
            &50_000,
            &bytes(&env, 4),
            &bytes(&env, 5),
        );
        client.cancel_payment(&payer, &payment_id);

        assert_eq!(
            client.get_payment(&payment_id).status,
            PaymentStatus::Cancelled
        );
    }

    #[test]
    fn integrates_all_four_contracts() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);

        // T3.2: each contract is initialized atomically at registration via its
        // __constructor. reward depends on star; payment depends on registry +
        // reward, so they are registered in dependency order.
        let star_id = env.register(
            star_token::StarToken,
            (
                &admin,
                soroban_sdk::String::from_str(&env, "STAR Token"),
                soroban_sdk::String::from_str(&env, "STAR"),
                1_000_000_i128,
            ),
        );
        let registry_id = env.register(merchant_registry::MerchantRegistry, (&admin,));
        let reward_id = env.register(reward_engine::RewardEngine, (&admin, &star_id));
        let payment_id = env.register(PaymentEngine, (&admin, &registry_id, &reward_id));

        let star = star_token::StarTokenClient::new(&env, &star_id);
        let registry = merchant_registry::MerchantRegistryClient::new(&env, &registry_id);
        let reward = reward_engine::RewardEngineClient::new(&env, &reward_id);
        let payment = PaymentEngineClient::new(&env, &payment_id);

        let operator = Address::generate(&env);
        let owner = Address::generate(&env);
        let payer = Address::generate(&env);
        let merchant_id = bytes(&env, 1);
        let chain_payment_id = bytes(&env, 2);
        let reward_record_id = bytes(&env, 3);

        star.set_minter(&reward_id, &true);
        reward.set_issuer(&payment_id, &true);
        payment.set_operator(&operator, &true);

        registry.register_merchant(&merchant_id, &owner, &bytes(&env, 4), &bytes(&env, 5));
        registry.approve_merchant(&merchant_id);

        payment.create_payment(
            &operator,
            &payer,
            &chain_payment_id,
            &merchant_id,
            &AssetCode::USDC,
            &50_000,
            &bytes(&env, 6),
            &reward_record_id,
        );
        payment.quote_payment(&operator, &chain_payment_id, &600, &600, &50);
        payment.mark_converted(&operator, &chain_payment_id);
        payment.mark_settled(&operator, &chain_payment_id);
        payment.issue_reward(&operator, &chain_payment_id);
        payment.complete_payment(&operator, &chain_payment_id);

        assert_eq!(star.balance(&payer), 50);
        assert_eq!(
            payment.get_payment(&chain_payment_id).status,
            PaymentStatus::Completed
        );
        assert_eq!(
            reward.get_reward(&reward_record_id).kind,
            reward_engine::RewardKind::Spend
        );
    }
}
