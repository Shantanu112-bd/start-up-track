#![cfg_attr(target_family = "wasm", no_std)]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short, Address, Env,
    MuxedAddress, String, Symbol,
};

const STAR_DECIMALS: u32 = 0;

#[contract]
pub struct StarToken;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum StarTokenError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
    InsufficientBalance = 4,
    InsufficientAllowance = 5,
    AllowanceExpired = 6,
    SupplyCapExceeded = 7,
    Paused = 8,
    AccountNotAuthorized = 9,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
    pub max_supply: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeBurnConfig {
    pub enabled: bool,
    pub fee_basis_points: u32, // 1 basis point = 0.01%
    pub fee_recipient: Address, // Address that receives fees before burn
}

#[contractevent(topics = ["star"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StarEvent {
    #[topic]
    pub action: Symbol,
    #[topic]
    pub account: Address,
    pub counterparty: Address,
    pub amount: i128,
    pub flag: bool,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Allowance(Address, Address),
    Authorized(Address),
    Balance(Address),
    Initialized,
    Metadata,
    Minter(Address),
    Paused,
    TotalSupply,
    FeeBurnConfig,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[contractimpl]
impl StarToken {
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        max_supply: i128,
    ) -> Result<(), StarTokenError> {
        if is_initialized(&env) {
            return Err(StarTokenError::AlreadyInitialized);
        }
        if max_supply <= 0 {
            return Err(StarTokenError::InvalidAmount);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(
            &DataKey::Metadata,
            &TokenMetadata {
                name,
                symbol,
                decimals: STAR_DECIMALS,
                max_supply,
            },
        );
        env.storage().instance().set(&DataKey::TotalSupply, &0_i128);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage()
            .persistent()
            .set(&DataKey::Authorized(admin.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Authorized(admin.clone()), 100, 518400);
        env.storage()
            .persistent()
            .set(&DataKey::Minter(admin.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Minter(admin.clone()), 100, 518400);

        StarEvent {
            action: symbol_short!("init"),
            account: admin.clone(),
            counterparty: admin,
            amount: max_supply,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn admin(env: Env) -> Result<Address, StarTokenError> {
        require_initialized(&env)?;
        Ok(read_admin(&env))
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), StarTokenError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();

        // Revoke the OUTGOING admin's privileged flags so a rotated-out key can
        // no longer mint or move funds while frozen. Skip when rotating to self
        // (would otherwise lock the admin out of its own powers).
        if admin != new_admin {
            env.storage()
                .persistent()
                .set(&DataKey::Minter(admin.clone()), &false);
            env.storage()
                .persistent()
                .set(&DataKey::Authorized(admin.clone()), &false);
        }

        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.storage()
            .persistent()
            .set(&DataKey::Authorized(new_admin.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Authorized(new_admin.clone()), 100, 518400);
        env.storage()
            .persistent()
            .set(&DataKey::Minter(new_admin.clone()), &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Minter(new_admin.clone()), 100, 518400);
        StarEvent {
            action: symbol_short!("admin"),
            account: admin,
            counterparty: new_admin,
            amount: 0,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn set_fee_burn_config(
        env: Env,
        enabled: bool,
        fee_basis_points: u32,
        fee_recipient: Address,
    ) -> Result<(), StarTokenError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();

        if fee_basis_points > 10000 {
            return Err(StarTokenError::InvalidAmount);
        }

        let config = FeeBurnConfig {
            enabled,
            fee_basis_points,
            fee_recipient: fee_recipient.clone(),
        };
        env.storage().instance().set(&DataKey::FeeBurnConfig, &config);

        StarEvent {
            action: symbol_short!("feeburn"),
            account: admin.clone(),
            counterparty: fee_recipient,
            amount: fee_basis_points as i128,
            flag: enabled,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_fee_burn_config(env: Env) -> Result<FeeBurnConfig, StarTokenError> {
        require_initialized(&env)?;
        Ok(env.storage().instance().get(&DataKey::FeeBurnConfig).unwrap_or(FeeBurnConfig {
            enabled: false,
            fee_basis_points: 0,
            fee_recipient: env.current_contract_address(),
        }))
    }

    pub fn burn_fee(env: Env, from: Address, amount: i128) -> Result<i128, StarTokenError> {
        require_not_paused(&env)?;
        require_positive(amount)?;
        from.require_auth();

        let config = env.storage().instance().get(&DataKey::FeeBurnConfig).unwrap_or(FeeBurnConfig {
            enabled: false,
            fee_basis_points: 0,
            fee_recipient: env.current_contract_address(),
        });

        if !config.enabled || config.fee_basis_points == 0 {
            return Ok(0);
        }

        // Calculate fee amount
        let fee_amount = (amount * config.fee_basis_points as i128) / 10000;

        if fee_amount == 0 {
            return Ok(0);
        }

        // Transfer fee to recipient first
        transfer_internal(&env, &from, &config.fee_recipient, fee_amount)?;

        // Then burn from recipient
        burn_internal(&env, &config.fee_recipient, fee_amount)?;

        StarEvent {
            action: symbol_short!("burnfee"),
            account: from,
            counterparty: config.fee_recipient,
            amount: fee_amount,
            flag: true,
        }
        .publish(&env);

        Ok(fee_amount)
    }

    pub fn pause(env: Env) -> Result<(), StarTokenError> {
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        StarEvent {
            action: symbol_short!("pause"),
            account: admin.clone(),
            counterparty: admin,
            amount: 0,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), StarTokenError> {
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        StarEvent {
            action: symbol_short!("unpause"),
            account: admin.clone(),
            counterparty: admin,
            amount: 0,
            flag: false,
        }
        .publish(&env);
        Ok(())
    }

    pub fn paused(env: Env) -> Result<bool, StarTokenError> {
        require_initialized(&env)?;
        Ok(is_paused(&env))
    }

    pub fn set_minter(env: Env, minter: Address, enabled: bool) -> Result<(), StarTokenError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Minter(minter.clone()), &enabled);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Minter(minter.clone()), 100, 518400);
        if enabled {
            env.storage()
                .persistent()
                .set(&DataKey::Authorized(minter.clone()), &true);
            env.storage()
                .persistent()
                .extend_ttl(&DataKey::Authorized(minter.clone()), 100, 518400);
        }
        StarEvent {
            action: symbol_short!("minter"),
            account: minter.clone(),
            counterparty: minter,
            amount: 0,
            flag: enabled,
        }
        .publish(&env);
        Ok(())
    }

    pub fn is_minter(env: Env, minter: Address) -> Result<bool, StarTokenError> {
        require_initialized(&env)?;
        Ok(is_minter(&env, &minter))
    }

    pub fn set_authorized(env: Env, id: Address, authorize: bool) -> Result<(), StarTokenError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Authorized(id.clone()), &authorize);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Authorized(id.clone()), 100, 518400);
        StarEvent {
            action: symbol_short!("auth"),
            account: id.clone(),
            counterparty: id,
            amount: 0,
            flag: authorize,
        }
        .publish(&env);
        Ok(())
    }

    pub fn authorized(env: Env, id: Address) -> Result<bool, StarTokenError> {
        require_initialized(&env)?;
        Ok(is_authorized(&env, &id))
    }

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), StarTokenError> {
        require_not_paused(&env)?;
        require_positive(amount)?;
        require_authorized(&env, &to)?;

        read_admin(&env).require_auth();

        let metadata = read_metadata(&env);
        let supply = read_total_supply(&env);
        let next_supply = supply
            .checked_add(amount)
            .ok_or(StarTokenError::SupplyCapExceeded)?;
        if next_supply > metadata.max_supply {
            return Err(StarTokenError::SupplyCapExceeded);
        }

        add_balance(&env, &to, amount)?;
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &next_supply);
        StarEvent {
            action: symbol_short!("mint"),
            account: to.clone(),
            counterparty: to,
            amount,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn mint_from_minter(
        env: Env,
        minter: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), StarTokenError> {
        require_not_paused(&env)?;
        require_positive(amount)?;
        require_authorized(&env, &to)?;
        minter.require_auth();
        if !is_minter(&env, &minter) {
            return Err(StarTokenError::AccountNotAuthorized);
        }

        let metadata = read_metadata(&env);
        let supply = read_total_supply(&env);
        let next_supply = supply
            .checked_add(amount)
            .ok_or(StarTokenError::SupplyCapExceeded)?;
        if next_supply > metadata.max_supply {
            return Err(StarTokenError::SupplyCapExceeded);
        }

        add_balance(&env, &to, amount)?;
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &next_supply);
        StarEvent {
            action: symbol_short!("mint"),
            account: minter,
            counterparty: to,
            amount,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> Result<i128, StarTokenError> {
        require_initialized(&env)?;
        Ok(read_allowance(&env, &from, &spender))
    }

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) -> Result<(), StarTokenError> {
        require_not_paused(&env)?;
        if amount < 0 {
            return Err(StarTokenError::InvalidAmount);
        }
        from.require_auth();
        require_authorized(&env, &from)?;
        require_authorized(&env, &spender)?;
        if amount > 0 && expiration_ledger < env.ledger().sequence() {
            return Err(StarTokenError::AllowanceExpired);
        }

        let key = DataKey::Allowance(from.clone(), spender.clone());
        env.storage().persistent().set(
            &key,
            &AllowanceValue {
                amount,
                expiration_ledger,
            },
        );
        env.storage().persistent().extend_ttl(&key, 100, 518400);
        StarEvent {
            action: symbol_short!("approve"),
            account: from,
            counterparty: spender,
            amount,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn balance(env: Env, id: Address) -> Result<i128, StarTokenError> {
        require_initialized(&env)?;
        Ok(read_balance(&env, &id))
    }

    pub fn transfer(
        env: Env,
        from: Address,
        to: MuxedAddress,
        amount: i128,
    ) -> Result<(), StarTokenError> {
        require_not_paused(&env)?;
        from.require_auth();
        let to_address = to.address();
        transfer_internal(&env, &from, &to_address, amount)?;
        StarEvent {
            action: symbol_short!("transfer"),
            account: from,
            counterparty: to_address,
            amount,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), StarTokenError> {
        require_not_paused(&env)?;
        spender.require_auth();
        spend_allowance(&env, &from, &spender, amount)?;
        transfer_internal(&env, &from, &to, amount)?;
        StarEvent {
            action: symbol_short!("transfer"),
            account: from,
            counterparty: to,
            amount,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), StarTokenError> {
        require_not_paused(&env)?;
        from.require_auth();
        burn_internal(&env, &from, amount)?;
        StarEvent {
            action: symbol_short!("burn"),
            account: from.clone(),
            counterparty: from,
            amount,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn burn_from(
        env: Env,
        spender: Address,
        from: Address,
        amount: i128,
    ) -> Result<(), StarTokenError> {
        require_not_paused(&env)?;
        spender.require_auth();
        spend_allowance(&env, &from, &spender, amount)?;
        burn_internal(&env, &from, amount)?;
        StarEvent {
            action: symbol_short!("burn"),
            account: from.clone(),
            counterparty: from,
            amount,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn decimals(env: Env) -> Result<u32, StarTokenError> {
        require_initialized(&env)?;
        Ok(read_metadata(&env).decimals)
    }

    pub fn name(env: Env) -> Result<String, StarTokenError> {
        require_initialized(&env)?;
        Ok(read_metadata(&env).name)
    }

    pub fn symbol(env: Env) -> Result<String, StarTokenError> {
        require_initialized(&env)?;
        Ok(read_metadata(&env).symbol)
    }

    pub fn total_supply(env: Env) -> Result<i128, StarTokenError> {
        require_initialized(&env)?;
        Ok(read_total_supply(&env))
    }

    pub fn max_supply(env: Env) -> Result<i128, StarTokenError> {
        require_initialized(&env)?;
        Ok(read_metadata(&env).max_supply)
    }
}

fn is_initialized(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Initialized)
        .unwrap_or(false)
}

fn require_initialized(env: &Env) -> Result<(), StarTokenError> {
    if !is_initialized(env) {
        return Err(StarTokenError::NotInitialized);
    }
    Ok(())
}

fn require_not_paused(env: &Env) -> Result<(), StarTokenError> {
    require_initialized(env)?;
    if is_paused(env) {
        return Err(StarTokenError::Paused);
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
        .unwrap_or_else(|| panic!("STAR token not initialized"))
}

fn read_metadata(env: &Env) -> TokenMetadata {
    env.storage()
        .instance()
        .get(&DataKey::Metadata)
        .unwrap_or_else(|| panic!("STAR token metadata not initialized"))
}

fn read_total_supply(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0)
}

fn is_minter(env: &Env, id: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Minter(id.clone()))
        .unwrap_or(false)
}

// DELIBERATE POSTURE (audit finding H-2): STAR uses a FREEZE-LIST (blocklist),
// NOT an allowlist. An address is authorized by DEFAULT; `set_authorized(x,
// false)` freezes it (blocking transfer/mint/approve for that address). This is
// intentional for a loyalty/rewards token that is minted broadly to consumers:
// an allowlist would require pre-authorizing every recipient before they could
// receive STAR, which is operationally infeasible. The default therefore is
// `true` (authorized) on purpose. To move to an allowlist posture, change this
// to `unwrap_or(false)` and authorize accounts explicitly at init / set_minter
// / first receipt — and expect existing holders to be frozen until authorized.
fn is_authorized(env: &Env, id: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Authorized(id.clone()))
        .unwrap_or(true)
}

fn require_authorized(env: &Env, id: &Address) -> Result<(), StarTokenError> {
    if !is_authorized(env, id) {
        return Err(StarTokenError::AccountNotAuthorized);
    }
    Ok(())
}

fn require_positive(amount: i128) -> Result<(), StarTokenError> {
    if amount <= 0 {
        return Err(StarTokenError::InvalidAmount);
    }
    Ok(())
}

fn read_balance(env: &Env, id: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(id.clone()))
        .unwrap_or(0)
}

fn set_balance(env: &Env, id: &Address, amount: i128) {
    let key = DataKey::Balance(id.clone());
    env.storage()
        .persistent()
        .set(&key, &amount);
    env.storage().persistent().extend_ttl(&key, 100, 518400);
}

fn add_balance(env: &Env, id: &Address, amount: i128) -> Result<(), StarTokenError> {
    let next = read_balance(env, id)
        .checked_add(amount)
        .ok_or(StarTokenError::InvalidAmount)?;
    set_balance(env, id, next);
    Ok(())
}

fn sub_balance(env: &Env, id: &Address, amount: i128) -> Result<(), StarTokenError> {
    let current = read_balance(env, id);
    if current < amount {
        return Err(StarTokenError::InsufficientBalance);
    }
    set_balance(env, id, current - amount);
    Ok(())
}

fn transfer_internal(
    env: &Env,
    from: &Address,
    to: &Address,
    amount: i128,
) -> Result<(), StarTokenError> {
    require_positive(amount)?;
    require_authorized(env, from)?;
    require_authorized(env, to)?;
    sub_balance(env, from, amount)?;
    add_balance(env, to, amount)?;
    Ok(())
}

fn burn_internal(env: &Env, from: &Address, amount: i128) -> Result<(), StarTokenError> {
    require_positive(amount)?;
    require_authorized(env, from)?;
    sub_balance(env, from, amount)?;
    let supply = read_total_supply(env);
    env.storage()
        .instance()
        .set(&DataKey::TotalSupply, &(supply - amount));
    Ok(())
}

fn read_allowance(env: &Env, from: &Address, spender: &Address) -> i128 {
    let Some(allowance) = env
        .storage()
        .persistent()
        .get::<DataKey, AllowanceValue>(&DataKey::Allowance(from.clone(), spender.clone()))
    else {
        return 0;
    };

    if allowance.expiration_ledger < env.ledger().sequence() {
        return 0;
    }
    allowance.amount
}

fn spend_allowance(
    env: &Env,
    from: &Address,
    spender: &Address,
    amount: i128,
) -> Result<(), StarTokenError> {
    require_positive(amount)?;
    let Some(allowance) = env
        .storage()
        .persistent()
        .get::<DataKey, AllowanceValue>(&DataKey::Allowance(from.clone(), spender.clone()))
    else {
        return Err(StarTokenError::InsufficientAllowance);
    };

    if allowance.expiration_ledger < env.ledger().sequence() {
        return Err(StarTokenError::AllowanceExpired);
    }
    if allowance.amount < amount {
        return Err(StarTokenError::InsufficientAllowance);
    }

    let key = DataKey::Allowance(from.clone(), spender.clone());
    env.storage().persistent().set(
        &key,
        &AllowanceValue {
            amount: allowance.amount - amount,
            expiration_ledger: allowance.expiration_ledger,
        },
    );
    env.storage().persistent().extend_ttl(&key, 100, 518400);
    Ok(())
}

#[cfg(test)]
mod test {
    extern crate std;

    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    fn setup() -> (Env, StarTokenClient<'static>, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StarToken, ());
        let client = StarTokenClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.initialize(
            &admin,
            &String::from_str(&env, "STAR Token"),
            &String::from_str(&env, "STAR"),
            &1_000_000,
        );

        (env, client, admin, alice, bob)
    }

    #[test]
    fn initializes_metadata_and_admin() {
        let (_env, client, admin, _alice, _bob) = setup();

        assert_eq!(client.admin(), admin);
        assert_eq!(client.decimals(), STAR_DECIMALS);
        assert_eq!(client.symbol(), String::from_str(&client.env, "STAR"));
        assert_eq!(client.total_supply(), 0);
        assert!(client.is_minter(&admin));
    }

    #[test]
    fn mints_transfers_and_burns() {
        let (_env, client, _admin, alice, bob) = setup();

        client.mint(&alice, &500);
        assert_eq!(client.balance(&alice), 500);
        assert_eq!(client.total_supply(), 500);

        client.transfer(&alice, MuxedAddress::from(bob.clone()), &125);
        assert_eq!(client.balance(&alice), 375);
        assert_eq!(client.balance(&bob), 125);

        client.burn(&bob, &25);
        assert_eq!(client.balance(&bob), 100);
        assert_eq!(client.total_supply(), 475);
    }

    #[test]
    fn allowance_is_consumed() {
        let (env, client, _admin, alice, bob) = setup();
        let spender = Address::generate(&env);

        client.mint(&alice, &500);
        client.approve(&alice, &spender, &200, &(env.ledger().sequence() + 10));
        assert_eq!(client.allowance(&alice, &spender), 200);

        client.transfer_from(&spender, &alice, &bob, &150);
        assert_eq!(client.allowance(&alice, &spender), 50);
        assert_eq!(client.balance(&bob), 150);
    }

    #[test]
    fn rejects_supply_cap_overflow() {
        let (_env, client, _admin, alice, _bob) = setup();

        assert_eq!(
            client.try_mint(&alice, &1_000_001),
            Err(Ok(StarTokenError::SupplyCapExceeded))
        );
    }

    #[test]
    fn pause_blocks_transfers() {
        let (_env, client, _admin, alice, bob) = setup();

        client.mint(&alice, &100);
        client.pause();

        assert_eq!(
            client.try_transfer(&alice, MuxedAddress::from(bob), &10),
            Err(Ok(StarTokenError::Paused))
        );
    }

    // ── TIER 1 ──────────────────────────────────────────────────────────────

    // T1.1: after admin rotation the OLD admin must lose mint power. Before the
    // fix, Minter(old)=true persisted and the old key could still mint via
    // mint_from_minter — a privilege-escalation. This test fails pre-fix.
    #[test]
    fn set_admin_revokes_old_admin_mint_power() {
        let (env, client, admin, alice, _bob) = setup();
        let new_admin = Address::generate(&env);

        // sanity: old admin can mint before rotation
        client.mint_from_minter(&admin, &alice, &10);

        client.set_admin(&new_admin);

        // new admin has mint power
        client.mint_from_minter(&new_admin, &alice, &10);

        // OLD admin must NOT: it is no longer a minter AND is frozen.
        assert!(!client.is_minter(&admin));
        assert_eq!(
            client.try_mint_from_minter(&admin, &alice, &10),
            Err(Ok(StarTokenError::AccountNotAuthorized))
        );
    }

    // T1.1 companion: rotating to self must not lock the admin out.
    #[test]
    fn set_admin_to_self_keeps_powers() {
        let (_env, client, admin, alice, _bob) = setup();
        client.set_admin(&admin);
        assert!(client.is_minter(&admin));
        client.mint_from_minter(&admin, &alice, &5);
    }

    // T1.2 (posture): default authorization is TRUE (freeze-list, not allowlist).
    #[test]
    fn default_authorization_posture_is_true() {
        let (env, client, _admin, _alice, _bob) = setup();
        let never_touched = Address::generate(&env);
        assert!(client.authorized(&never_touched));
    }

    // T1.2 (negative): a frozen address is rejected on both transfer and mint.
    #[test]
    fn frozen_address_rejected_on_transfer_and_mint() {
        let (_env, client, _admin, alice, bob) = setup();
        client.mint(&alice, &100);

        // Freeze bob.
        client.set_authorized(&bob, &false);
        assert!(!client.authorized(&bob));

        // Transfer TO a frozen address is rejected.
        assert_eq!(
            client.try_transfer(&alice, MuxedAddress::from(bob.clone()), &10),
            Err(Ok(StarTokenError::AccountNotAuthorized))
        );
        // Mint TO a frozen address is rejected.
        assert_eq!(
            client.try_mint(&bob, &10),
            Err(Ok(StarTokenError::AccountNotAuthorized))
        );
    }
}
