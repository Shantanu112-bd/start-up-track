#![cfg_attr(target_family = "wasm", no_std)]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short, Address,
    BytesN, Env, Symbol,
};

#[contract]
pub struct MerchantRegistry;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum MerchantRegistryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Paused = 3,
    MerchantAlreadyExists = 4,
    MerchantNotFound = 5,
    InvalidStatus = 6,
    Unauthorized = 7,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum MerchantStatus {
    Pending = 1,
    Approved = 2,
    Suspended = 3,
    Rejected = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MerchantRecord {
    pub merchant_id: BytesN<32>,
    pub owner: Address,
    pub upi_id_hash: BytesN<32>,
    pub metadata_hash: BytesN<32>,
    pub status: MerchantStatus,
    pub created_ledger: u32,
    pub updated_ledger: u32,
}

#[contractevent(topics = ["merchant"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MerchantEvent {
    #[topic]
    pub action: Symbol,
    #[topic]
    pub merchant_id: BytesN<32>,
    pub account: Address,
    pub status: MerchantStatus,
    pub flag: bool,
}

#[contractevent(topics = ["merchant_cfg"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RegistryConfigEvent {
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
    Merchant(BytesN<32>),
    Paused,
}

#[contractimpl]
impl MerchantRegistry {
    pub fn initialize(env: Env, admin: Address) -> Result<(), MerchantRegistryError> {
        if is_initialized(&env) {
            return Err(MerchantRegistryError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        RegistryConfigEvent {
            action: symbol_short!("init"),
            account: admin.clone(),
            counterparty: admin,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn admin(env: Env) -> Result<Address, MerchantRegistryError> {
        require_initialized(&env)?;
        Ok(read_admin(&env))
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), MerchantRegistryError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        RegistryConfigEvent {
            action: symbol_short!("admin"),
            account: admin,
            counterparty: new_admin,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn pause(env: Env) -> Result<(), MerchantRegistryError> {
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        RegistryConfigEvent {
            action: symbol_short!("pause"),
            account: admin.clone(),
            counterparty: admin,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), MerchantRegistryError> {
        let admin = read_admin(&env);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        RegistryConfigEvent {
            action: symbol_short!("unpause"),
            account: admin.clone(),
            counterparty: admin,
            flag: false,
        }
        .publish(&env);
        Ok(())
    }

    pub fn paused(env: Env) -> Result<bool, MerchantRegistryError> {
        require_initialized(&env)?;
        Ok(is_paused(&env))
    }

    pub fn register_merchant(
        env: Env,
        merchant_id: BytesN<32>,
        owner: Address,
        upi_id_hash: BytesN<32>,
        metadata_hash: BytesN<32>,
    ) -> Result<(), MerchantRegistryError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        if has_merchant(&env, &merchant_id) {
            return Err(MerchantRegistryError::MerchantAlreadyExists);
        }

        let ledger = env.ledger().sequence();
        let record = MerchantRecord {
            merchant_id: merchant_id.clone(),
            owner,
            upi_id_hash,
            metadata_hash,
            status: MerchantStatus::Pending,
            created_ledger: ledger,
            updated_ledger: ledger,
        };
        write_merchant(&env, &record);
        MerchantEvent {
            action: symbol_short!("reg_merch"),
            merchant_id,
            account: record.owner,
            status: record.status,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn approve_merchant(
        env: Env,
        merchant_id: BytesN<32>,
    ) -> Result<(), MerchantRegistryError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        let mut record = read_merchant(&env, &merchant_id)?;
        if record.status == MerchantStatus::Rejected {
            return Err(MerchantRegistryError::InvalidStatus);
        }
        record.status = MerchantStatus::Approved;
        record.updated_ledger = env.ledger().sequence();
        write_merchant(&env, &record);
        MerchantEvent {
            action: symbol_short!("approve"),
            merchant_id,
            account: record.owner,
            status: record.status,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn suspend_merchant(
        env: Env,
        merchant_id: BytesN<32>,
    ) -> Result<(), MerchantRegistryError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        let mut record = read_merchant(&env, &merchant_id)?;
        if record.status != MerchantStatus::Approved {
            return Err(MerchantRegistryError::InvalidStatus);
        }
        record.status = MerchantStatus::Suspended;
        record.updated_ledger = env.ledger().sequence();
        write_merchant(&env, &record);
        MerchantEvent {
            action: symbol_short!("suspend"),
            merchant_id,
            account: record.owner,
            status: record.status,
            flag: false,
        }
        .publish(&env);
        Ok(())
    }

    pub fn reject_merchant(env: Env, merchant_id: BytesN<32>) -> Result<(), MerchantRegistryError> {
        require_not_paused(&env)?;
        let admin = read_admin(&env);
        admin.require_auth();
        let mut record = read_merchant(&env, &merchant_id)?;
        if record.status != MerchantStatus::Pending {
            return Err(MerchantRegistryError::InvalidStatus);
        }
        record.status = MerchantStatus::Rejected;
        record.updated_ledger = env.ledger().sequence();
        write_merchant(&env, &record);
        MerchantEvent {
            action: symbol_short!("reject"),
            merchant_id,
            account: record.owner,
            status: record.status,
            flag: false,
        }
        .publish(&env);
        Ok(())
    }

    pub fn update_metadata(
        env: Env,
        merchant_id: BytesN<32>,
        metadata_hash: BytesN<32>,
    ) -> Result<(), MerchantRegistryError> {
        require_not_paused(&env)?;
        let mut record = read_merchant(&env, &merchant_id)?;
        record.owner.require_auth();
        record.metadata_hash = metadata_hash;
        record.updated_ledger = env.ledger().sequence();
        write_merchant(&env, &record);
        MerchantEvent {
            action: symbol_short!("metadata"),
            merchant_id,
            account: record.owner,
            status: record.status,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn transfer_owner(
        env: Env,
        merchant_id: BytesN<32>,
        new_owner: Address,
    ) -> Result<(), MerchantRegistryError> {
        require_not_paused(&env)?;
        let mut record = read_merchant(&env, &merchant_id)?;
        record.owner.require_auth();
        record.owner = new_owner;
        record.updated_ledger = env.ledger().sequence();
        write_merchant(&env, &record);
        MerchantEvent {
            action: symbol_short!("owner"),
            merchant_id,
            account: record.owner,
            status: record.status,
            flag: true,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_merchant(
        env: Env,
        merchant_id: BytesN<32>,
    ) -> Result<MerchantRecord, MerchantRegistryError> {
        require_initialized(&env)?;
        read_merchant(&env, &merchant_id)
    }

    pub fn is_approved(env: Env, merchant_id: BytesN<32>) -> Result<bool, MerchantRegistryError> {
        require_initialized(&env)?;
        Ok(read_merchant(&env, &merchant_id)?.status == MerchantStatus::Approved)
    }
}

fn is_initialized(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Initialized)
        .unwrap_or(false)
}

fn require_initialized(env: &Env) -> Result<(), MerchantRegistryError> {
    if !is_initialized(env) {
        return Err(MerchantRegistryError::NotInitialized);
    }
    Ok(())
}

fn require_not_paused(env: &Env) -> Result<(), MerchantRegistryError> {
    require_initialized(env)?;
    if is_paused(env) {
        return Err(MerchantRegistryError::Paused);
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
        .unwrap_or_else(|| panic!("merchant registry not initialized"))
}

fn has_merchant(env: &Env, merchant_id: &BytesN<32>) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Merchant(merchant_id.clone()))
}

fn read_merchant(
    env: &Env,
    merchant_id: &BytesN<32>,
) -> Result<MerchantRecord, MerchantRegistryError> {
    env.storage()
        .persistent()
        .get(&DataKey::Merchant(merchant_id.clone()))
        .ok_or(MerchantRegistryError::MerchantNotFound)
}

fn write_merchant(env: &Env, record: &MerchantRecord) {
    let key = DataKey::Merchant(record.merchant_id.clone());
    env.storage().persistent().set(&key, record);
    env.storage().persistent().extend_ttl(&key, 100, 518400);
}

#[cfg(test)]
mod test {
    extern crate std;

    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

    fn bytes(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn setup() -> (
        Env,
        MerchantRegistryClient<'static>,
        Address,
        Address,
        BytesN<32>,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(MerchantRegistry, ());
        let client = MerchantRegistryClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let owner = Address::generate(&env);
        let merchant_id = bytes(&env, 1);
        client.initialize(&admin);
        (env, client, admin, owner, merchant_id)
    }

    #[test]
    fn registers_and_approves_merchant() {
        let (env, client, _admin, owner, merchant_id) = setup();

        client.register_merchant(&merchant_id, &owner, &bytes(&env, 2), &bytes(&env, 3));
        assert_eq!(
            client.get_merchant(&merchant_id).status,
            MerchantStatus::Pending
        );

        client.approve_merchant(&merchant_id);
        assert!(client.is_approved(&merchant_id));
    }

    #[test]
    fn rejects_duplicate_merchants() {
        let (env, client, _admin, owner, merchant_id) = setup();

        client.register_merchant(&merchant_id, &owner, &bytes(&env, 2), &bytes(&env, 3));

        assert_eq!(
            client.try_register_merchant(&merchant_id, &owner, &bytes(&env, 2), &bytes(&env, 3)),
            Err(Ok(MerchantRegistryError::MerchantAlreadyExists))
        );
    }

    #[test]
    fn owner_can_update_metadata() {
        let (env, client, _admin, owner, merchant_id) = setup();

        client.register_merchant(&merchant_id, &owner, &bytes(&env, 2), &bytes(&env, 3));
        client.update_metadata(&merchant_id, &bytes(&env, 9));

        assert_eq!(
            client.get_merchant(&merchant_id).metadata_hash,
            bytes(&env, 9)
        );
    }

    #[test]
    fn suspend_requires_approved_status() {
        let (env, client, _admin, owner, merchant_id) = setup();

        client.register_merchant(&merchant_id, &owner, &bytes(&env, 2), &bytes(&env, 3));

        assert_eq!(
            client.try_suspend_merchant(&merchant_id),
            Err(Ok(MerchantRegistryError::InvalidStatus))
        );
    }

    #[test]
    fn pause_blocks_registration() {
        let (env, client, _admin, owner, merchant_id) = setup();

        client.pause();

        assert_eq!(
            client.try_register_merchant(&merchant_id, &owner, &bytes(&env, 2), &bytes(&env, 3)),
            Err(Ok(MerchantRegistryError::Paused))
        );
    }
}
