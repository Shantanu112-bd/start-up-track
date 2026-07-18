#![cfg_attr(target_family = "wasm", no_std)]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    symbol_short, Address, BytesN, Env, Symbol,
};

const SPEND_REWARD_STAR_PER_100_INR: i128 = 10;
const PAISE_PER_100_INR: i128 = 10_000;
const REFERRAL_REWARD_STAR: i128 = 100;

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
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum RewardKind {
    Spend = 1,
    Referral = 2,
    Campaign = 3,
    Merchant = 4,
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
    Reward(BytesN<32>),
    StarToken,
}

#[contractimpl]
impl RewardEngine {
    pub fn initialize(
        env: Env,
        admin: Address,
        star_token: Address,
    ) -> Result<(), RewardEngineError> {
        if is_initialized(&env) {
            return Err(RewardEngineError::AlreadyInitialized);
        }
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
        RewardConfigEvent {
            action: symbol_short!("init"),
            account: admin.clone(),
            counterparty: star_token,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn admin(env: Env) -> Result<Address, RewardEngineError> {
        require_initialized(&env)?;
        Ok(read_admin(&env))
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), RewardEngineError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.storage()
            .persistent()
            .set(&DataKey::AuthorizedIssuer(new_admin.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::AuthorizedIssuer(new_admin.clone()), 100, 518400);
        RewardConfigEvent {
            action: symbol_short!("admin"),
            account: admin,
            counterparty: new_admin,
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
        Ok((amount_in_paise / PAISE_PER_100_INR) * SPEND_REWARD_STAR_PER_100_INR)
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
    env.storage()
        .persistent()
        .set(&DataKey::Reward(reward_id.clone()), &record);
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::Reward(reward_id.clone()), 100, 518400);
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
            let balance: i128 = env
                .storage()
                .persistent()
                .get(&MockStarKey::Balance(to.clone()))
                .unwrap_or(0);
            env.storage()
                .persistent()
                .set(&MockStarKey::Balance(to), &(balance + amount));
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
        let reward_id = env.register(RewardEngine, ());
        let reward_client = RewardEngineClient::new(&env, &reward_id);
        let star_client = MockStarTokenClient::new(&env, &star_id);
        let admin = Address::generate(&env);
        let issuer = Address::generate(&env);
        let recipient = Address::generate(&env);
        reward_client.initialize(&admin, &star_id);
        reward_client.set_issuer(&issuer, &true);
        (env, reward_client, star_client, admin, issuer, recipient)
    }

    #[test]
    fn calculates_spend_reward() {
        assert_eq!(RewardEngine::calculate_spend_reward(10000), Ok(10));
        assert_eq!(RewardEngine::calculate_spend_reward(50000), Ok(50));
        assert_eq!(RewardEngine::calculate_spend_reward(9999), Ok(0));
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
