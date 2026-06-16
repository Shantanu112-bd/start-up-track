import { Horizon, rpc, Contract } from "@stellar/stellar-sdk";
import { signTransaction, setAllowed } from "@stellar/freighter-api";

// Use Stellar Testnet
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";

export const server = new Horizon.Server(HORIZON_URL);
export const rpcServer = new rpc.Server(SOROBAN_RPC_URL);

export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

// Mock Contract IDs since they aren't deployed yet for the demo
export const CONTRACTS = {
  paymentEngine: "CCY2RUZ2F3O7YZVOWEWYR6H5335O2SQU6O3ZTYGMFK6X2X2YFTDOPM4I",
  starToken: "CD7LZ3UFV7Z6RMFJZT3G24HNDGB2D7F3H7YOTM35OIMDBIHF7XY3O6A4",
  usdc: "CBXYZ...", // Native USDC token address on testnet
};

export interface BalanceMap {
  XLM: string;
  USDC: string;
  STAR: string;
}

export async function fetchBalances(publicKey: string): Promise<BalanceMap> {
  const balances: BalanceMap = { XLM: "0.00", USDC: "0.00", STAR: "0.00" };
  try {
    const account = await server.loadAccount(publicKey);
    account.balances.forEach((balance) => {
      if (balance.asset_type === "native") {
        balances.XLM = parseFloat(balance.balance).toFixed(2);
      } else if ("asset_code" in balance) {
        if (balance.asset_code === "USDC") {
          balances.USDC = parseFloat(balance.balance).toFixed(2);
        } else if (balance.asset_code === "STAR") {
          balances.STAR = parseFloat(balance.balance).toFixed(2);
        }
      }
    });
  } catch (e) {
    console.error("Error fetching balances for account", publicKey, e);
  }
  return balances;
}

/**
 * Example invocation for a Soroban Contract (Read-only)
 */
export async function getStarBalanceFromContract(publicKey: string): Promise<string> {
  try {
    const contract = new Contract(CONTRACTS.starToken);
    // In a real scenario, we'd build the XDR transaction, simulate it, and parse the result
    console.log("Mock read from Soroban contract", contract.contractId());
    return "5000"; // Mock response
  } catch (e) {
    console.error("Error invoking contract", e);
    return "0";
  }
}
