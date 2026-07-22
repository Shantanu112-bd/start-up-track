#![cfg_attr(target_family = "wasm", no_std)]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    symbol_short, Address, BytesN, Env, Symbol,
};

const SPEND_REWARD_STAR_PER_100_INR: i128 = 10;
const PAISE_PER_100_INR: i128 = 10_000;
const REFERRAL_REWARD_STAR: i128 = 100;

/// Instance-storage TTL management (see merchant-registry for rationale).
const INSTANCE_BUMP_THRESHOLD: u32 = 518_400; // ~30 days of ledgers
const INSTANCE_BUMP_AMOUNT: u32 = 1_036_800; // ~60 days of ledgers

#[contractclient(name = "StarTokenClient")]
pub trait StarTokenInterface {
    fn mint_from_minter(env: Env, minter: Address, to: Address, amount: i128);
}

#[contract]
pub struct RewardEngine;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RewardEngineError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Paused = 3,
    Unauthorized = 4,
    InvalidAmount = 5,
    RewardAlreadyIssued = 6,
    RewardNotFound = 7,
    NoPendingAdmin = 8,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum RewardKind {
    Spend = 1,
    Referral = 2,
    Campaign = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardRecord {
    pub reward_id: BytesN<32>,
    pub recipient: Address,
    pub source_id: BytesN<32>,
    pub issuer: Address,
    pub kind: RewardKind,
    pub amount_star: i128,
    pub created_ledger: u32,
}

#[contractevent(topics = ["reward"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardIssuedEvent {
    #[topic]
    pub reward_id: BytesN<32>,
    #[topic]
    pub recipient: Address,
    pub issuer: Address,
    pub kind: RewardKind,
    pub amount_star: i128,
}

#[contractevent(topics = ["reward_cfg"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardConfigEvent {
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
    AuthorizedIssuer(Address),
    Initialized,
    Paused,
    PendingAdmin,
    Reward(BytesN<32>),
    StarToken,
}

#[contractimpl]
impl RewardEngine {
    // T3.2: atomic deploy+init via __constructor (see merchant-registry).
    pub fn __constructor(env: Env, admin: Address, star_token: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage()
            .instance()
            .set(&DataKey::StarToken, &star_token);
        env.storage()
            .persistent()
            .set(&DataKey::AuthorizedIssuer(admin.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::AuthorizedIssuer(admin.clone()), 100, 518400);
        bump_instance(&env);
        RewardConfigEvent {
            action: symbol_short!("init"),
            account: admin.clone(),
            counterparty: star_token,
            flag: true,
        }
        .publish(&env);
    }

    pub fn admin(env: Env) -> Result<Address, RewardEngineError> {
        require_initialized(&env)?;
        Ok(read_admin(&env))
    }

    /// Permissionless: extend the instance-storage TTL. Anyone may call this.
    pub fn heartbeat(env: Env) -> Result<(), RewardEngineError> {
        require_initialized(&env)?;
        bump_instance(&env);
        Ok(())
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), RewardEngineError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);
        RewardConfigEvent {
            action: symbol_short!("adm_prop"),
            account: admin,
            counterparty: new_admin,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    /// Second step of the two-step admin handoff: the proposed admin claims the
    /// role by authorizing itself, then the OUTGOING admin's issuer privilege is
    /// revoked (T1.1) so a rotated-out key can no longer mint STAR via rewards.
    pub fn accept_admin(env: Env) -> Result<(), RewardEngineError> {
        require_not_paused(&env)?;
        let pending: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .ok_or(RewardEngineError::NoPendingAdmin)?;
        pending.require_auth();
        let old_admin = read_admin(&env);

        // Revoke the OUTGOING admin's issuer privilege. Skip on self-rotation.
        if old_admin != pending {
            env.storage()
                .persistent()
                .set(&DataKey::AuthorizedIssuer(old_admin.clone()), &false);
        }

        env.storage().instance().set(&DataKey::Admin, &pending);
        env.storage().instance().remove(&DataKey::PendingAdmin);
        env.storage()
            .persistent()
            .set(&DataKey::AuthorizedIssuer(pending.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::AuthorizedIssuer(pending.clone()), 100, 518400);
        RewardConfigEvent {
            action: symbol_short!("admin"),
            account: old_admin,
            counterparty: pending,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn pause(env: Env) -> Result<(), RewardEngineError> {
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        RewardConfigEvent {
            action: symbol_short!("pause"),
            account: admin.clone(),
            counterparty: admin,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), RewardEngineError> {
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        RewardConfigEvent {
            action: symbol_short!("unpause"),
            account: admin.clone(),
            counterparty: admin,
            flag: false,
        }
        .publish(&env);
        Ok(())
    }

    pub fn paused(env: Env) -> Result<bool, RewardEngineError> {
        require_initialized(&env)?;
        Ok(is_paused(&env))
    }

    pub fn set_star_token(env: Env, star_token: Address) -> Result<(), RewardEngineError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::StarToken, &star_token);
        RewardConfigEvent {
            action: symbol_short!("star"),
            account: admin,
            counterparty: star_token,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn set_issuer(env: Env, issuer: Address, enabled: bool) -> Result<(), RewardEngineError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::AuthorizedIssuer(issuer.clone()), &enabled);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::AuthorizedIssuer(issuer.clone()), 100, 518400);
        RewardConfigEvent {
            action: symbol_short!("issuer"),
            account: issuer.clone(),
            counterparty: issuer,
            flag: enabled,
        }
        .publish(&env);
        Ok(())
    }

    pub fn is_issuer(env: Env, issuer: Address) -> Result<bool, RewardEngineError> {
        require_initialized(&env)?;
        Ok(is_authorized_issuer(&env, &issuer))
    }

    pub fn calculate_spend_reward(amount_in_paise: i128) -> Result<i128, RewardEngineError> {
        if amount_in_paise <= 0 {
            return Err(RewardEngineError::InvalidAmount);
        }
        // T4.2: checked arithmetic. A very large operator-supplied amount must
        // surface an error rather than silently overflow the reward figure.
        (amount_in_paise / PAISE_PER_100_INR)
            .checked_mul(SPEND_REWARD_STAR_PER_100_INR)
            .ok_or(RewardEngineError::InvalidAmount)
    }

    pub fn issue_spend_reward(
        env: Env,
        issuer: Address,
        reward_id: BytesN<32>,
        recipient: Address,
        source_id: BytesN<32>,
        amount_in_paise: i128,
    ) -> Result<i128, RewardEngineError> {
        let amount_star = Self::calculate_spend_reward(amount_in_paise)?;
        if amount_star <= 0 {
            return Err(RewardEngineError::InvalidAmount);
        }
        issue_reward(
            &env,
            issuer,
            reward_id,
            recipient,
            source_id,
            RewardKind::Spend,
            amount_star,
        )
    }

    pub fn issue_referral_reward(
        env: Env,
        issuer: Address,
        reward_id: BytesN<32>,
        recipient: Address,
        source_id: BytesN<32>,
    ) -> Result<i128, RewardEngineError> {
        issue_reward(
            &env,
            issuer,
            reward_id,
            recipient,
            source_id,
            RewardKind::Referral,
            REFERRAL_REWARD_STAR,
        )
    }

    pub fn issue_campaign_reward(
        env: Env,
        issuer: Address,
        reward_id: BytesN<32>,
        recipient: Address,
        source_id: BytesN<32>,
        amount_star: i128,
    ) -> Result<i128, RewardEngineError> {
        issue_reward(
            &env,
            issuer,
            reward_id,
            recipient,
            source_id,
            RewardKind::Campaign,
            amount_star,
        )
    }

    pub fn get_reward(env: Env, reward_id: BytesN<32>) -> Result<RewardRecord, RewardEngineError> {
        require_initialized(&env)?;
        read_reward(&env, &reward_id)
    }
}

fn issue_reward(
    env: &Env,
    issuer: Address,
    reward_id: BytesN<32>,
    recipient: Address,
    source_id: BytesN<32>,
    kind: RewardKind,
    amount_star: i128,
) -> Result<i128, RewardEngineError> {
    require_not_paused(env)?;
    if amount_star <= 0 {
        return Err(RewardEngineError::InvalidAmount);
    }
    issuer.require_auth();
    if !is_authorized_issuer(env, &issuer) {
        return Err(RewardEngineError::Unauthorized);
    }
    if has_reward(env, &reward_id) {
        return Err(RewardEngineError::RewardAlreadyIssued);
    }

    let star_token = read_star_token(env);
    let minter = env.current_contract_address();
    let star_client = StarTokenClient::new(env, &star_token);
    star_client.mint_from_minter(&minter, &recipient, &amount_star);

    let record = RewardRecord {
        reward_id: reward_id.clone(),
        recipient,
        source_id,
        issuer,
        kind,
        amount_star,
        created_ledger: env.ledger().sequence(),
    };
    let key = DataKey::Reward(reward_id.clone());
    env.storage()
        .persistent()
        .set(&key, &record);
    env.storage().persistent().extend_ttl(&key, 100, 518400);
    RewardIssuedEvent {
        reward_id,
        recipient: record.recipient,
        issuer: record.issuer,
        kind: record.kind,
        amount_star,
    }
    .publish(env);
    Ok(amount_star)
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

fn require_initialized(env: &Env) -> Result<(), RewardEngineError> {
    if !is_initialized(env) {
        return Err(RewardEngineError::NotInitialized);
    }
    Ok(())
}

fn require_not_paused(env: &Env) -> Result<(), RewardEngineError> {
    require_initialized(env)?;
    if is_paused(env) {
        return Err(RewardEngineError::Paused);
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
        .unwrap_or_else(|| panic!("reward engine not initialized"))
}

fn read_star_token(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::StarToken)
        .unwrap_or_else(|| panic!("STAR token address not configured"))
}

fn is_authorized_issuer(env: &Env, issuer: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::AuthorizedIssuer(issuer.clone()))
        .unwrap_or(false)
}

fn has_reward(env: &Env, reward_id: &BytesN<32>) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Reward(reward_id.clone()))
}

fn read_reward(env: &Env, reward_id: &BytesN<32>) -> Result<RewardRecord, RewardEngineError> {
    env.storage()
        .persistent()
        .get(&DataKey::Reward(reward_id.clone()))
        .ok_or(RewardEngineError::RewardNotFound)
}

#[cfg(test)]
mod test {
    extern crate std;

    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

    #[contract]
    pub struct MockStarToken;

    #[contracttype]
    #[derive(Clone)]
    enum MockStarKey {
        Balance(Address),
        LastMinter,
    }

    #[contractimpl]
    impl MockStarToken {
        pub fn mint_from_minter(env: Env, minter: Address, to: Address, amount: i128) {
            let key = MockStarKey::Balance(to.clone());
            let balance: i128 = env
                .storage()
                .persistent()
                .get(&key)
                .unwrap_or(0);
            env.storage()
                .persistent()
                .set(&key, &(balance + amount));
            env.storage().persistent().extend_ttl(&key, 100, 518400);
            env.storage()
                .instance()
                .set(&MockStarKey::LastMinter, &minter);
        }

        pub fn balance(env: Env, id: Address) -> i128 {
            env.storage()
                .persistent()
                .get(&MockStarKey::Balance(id))
                .unwrap_or(0)
        }
    }

    fn bytes(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn setup() -> (
        Env,
        RewardEngineClient<'static>,
        MockStarTokenClient<'static>,
        Address,
        Address,
        Address,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let star_id = env.register(MockStarToken, ());
        let admin = Address::generate(&env);
        let reward_id = env.register(RewardEngine, (&admin, &star_id));
        let reward_client = RewardEngineClient::new(&env, &reward_id);
        let star_client = MockStarTokenClient::new(&env, &star_id);
        let issuer = Address::generate(&env);
        let recipient = Address::generate(&env);
        reward_client.set_issuer(&issuer, &true);
        (env, reward_client, star_client, admin, issuer, recipient)
    }

    #[test]
    fn calculates_spend_reward() {
        assert_eq!(RewardEngine::calculate_spend_reward(10000), Ok(10));
        assert_eq!(RewardEngine::calculate_spend_reward(50000), Ok(50));
        assert_eq!(RewardEngine::calculate_spend_reward(9999), Ok(0));
    }

    // T2.1: heartbeat() permissionlessly re-extends the instance TTL.
    #[test]
    fn heartbeat_extends_instance_ttl() {
        use soroban_sdk::testutils::storage::Instance as _;
        use soroban_sdk::testutils::Ledger as _;
        let (env, reward_client, _star_client, _admin, _issuer, _recipient) = setup();
        let contract_id = reward_client.address.clone();

        env.ledger().set_sequence_number(600_000);
        reward_client.heartbeat();

        let ttl = env.as_contract(&contract_id, || env.storage().instance().get_ttl());
        assert_eq!(ttl, INSTANCE_BUMP_AMOUNT);
    }

    #[test]
    fn issues_spend_reward_and_mints_star() {
        let (env, reward_client, star_client, _admin, issuer, recipient) = setup();

        let amount = reward_client.issue_spend_reward(
            &issuer,
            &bytes(&env, 1),
            &recipient,
            &bytes(&env, 2),
            &50_000,
        );

        assert_eq!(amount, 50);
        assert_eq!(star_client.balance(&recipient), 50);
        assert_eq!(
            reward_client.get_reward(&bytes(&env, 1)).kind,
            RewardKind::Spend
        );
    }

    // T1.1 + T4.1: after a two-step admin rotation the OLD admin must lose
    // issuer power. The admin is an authorized issuer at init; before the T1.1
    // fix AuthorizedIssuer(old) persisted, letting the rotated-out key keep
    // issuing (=minting STAR). Revocation now happens on accept_admin.
    #[test]
    fn set_admin_revokes_old_admin_issuer_power() {
        let (env, reward_client, _star_client, admin, _issuer, recipient) = setup();
        let new_admin = Address::generate(&env);

        // sanity: admin can issue before rotation
        reward_client.issue_spend_reward(&admin, &bytes(&env, 10), &recipient, &bytes(&env, 11), &10_000);

        // T4.1: proposing alone must NOT revoke the old admin's power yet.
        reward_client.set_admin(&new_admin);
        assert!(reward_client.is_issuer(&admin));

        reward_client.accept_admin();
        assert_eq!(reward_client.admin(), new_admin);

        // new admin can issue
        reward_client.issue_spend_reward(&new_admin, &bytes(&env, 12), &recipient, &bytes(&env, 13), &10_000);

        // OLD admin must NOT be an issuer anymore
        assert!(!reward_client.is_issuer(&admin));
        assert_eq!(
            reward_client.try_issue_spend_reward(&admin, &bytes(&env, 14), &recipient, &bytes(&env, 15), &10_000),
            Err(Ok(RewardEngineError::Unauthorized))
        );
    }

    // T4.1: accept_admin with no proposal outstanding is rejected.
    #[test]
    fn accept_admin_without_proposal_fails() {
        let (_env, reward_client, _star_client, _admin, _issuer, _recipient) = setup();
        assert_eq!(
            reward_client.try_accept_admin(),
            Err(Ok(RewardEngineError::NoPendingAdmin))
        );
    }

    #[test]
    fn rejects_duplicate_reward_id() {
        let (env, reward_client, _star_client, _admin, issuer, recipient) = setup();

        reward_client.issue_referral_reward(&issuer, &bytes(&env, 1), &recipient, &bytes(&env, 2));

        assert_eq!(
            reward_client.try_issue_referral_reward(
                &issuer,
                &bytes(&env, 1),
                &recipient,
                &bytes(&env, 2)
            ),
            Err(Ok(RewardEngineError::RewardAlreadyIssued))
        );
    }

    #[test]
    fn rejects_unauthorized_issuer() {
        let (env, reward_client, _star_client, _admin, _issuer, recipient) = setup();
        let other = Address::generate(&env);

        assert_eq!(
            reward_client.try_issue_referral_reward(
                &other,
                &bytes(&env, 1),
                &recipient,
                &bytes(&env, 2)
            ),
            Err(Ok(RewardEngineError::Unauthorized))
        );
    }

    #[test]
    fn pause_blocks_rewards() {
        let (env, reward_client, _star_client, _admin, issuer, recipient) = setup();
        reward_client.pause();

        assert_eq!(
            reward_client.try_issue_referral_reward(
                &issuer,
                &bytes(&env, 1),
                &recipient,
                &bytes(&env, 2)
            ),
            Err(Ok(RewardEngineError::Paused))
        );
    }
}
