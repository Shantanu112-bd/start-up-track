import { Injectable, Logger } from '@nestjs/common'
import {
  rpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Address,
  Keypair,
  scValToNative,
} from '@stellar/stellar-sdk'

@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name)
  private readonly rpcServer: rpc.Server
  private readonly platformKeypair: Keypair
  private readonly networkPassphrase = Networks.TESTNET
  private readonly rewardEngineId: string
  private readonly starTokenId: string

  constructor() {
    this.rpcServer = new rpc.Server(
      process.env.STELLAR_SOROBAN_RPC_URL ||
      'https://soroban-testnet.stellar.org'
    )
    this.platformKeypair = Keypair.fromSecret(
      process.env.PLATFORM_STELLAR_SECRET_KEY!
    )
    this.rewardEngineId =
      process.env.REWARD_ENGINE_CONTRACT_ADDRESS!
    this.starTokenId =
      process.env.STAR_CONTRACT_ADDRESS!
  }

  async issueStarReward(params: {
    rewardId: string
    userId: string
    userWalletAddress: string
    starAmount: bigint
  }): Promise<{ hash: string }> {
    this.logger.log(
      `Minting ${params.starAmount} STAR on-chain ` +
      `to ${params.userWalletAddress.substring(0, 8)}...`
    )

    const account = await this.rpcServer.getAccount(
      this.platformKeypair.publicKey()
    )

    const contract = new Contract(this.rewardEngineId)

    const rewardIdBytes = this.uuidToBytes32(params.rewardId)
    const userIdBytes = this.uuidToBytes32(params.userId)

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'issue_spend_reward',
          nativeToScVal(rewardIdBytes, { type: 'bytes' }),
          nativeToScVal(userIdBytes, { type: 'bytes' }),
          new Address(params.userWalletAddress).toScVal(),
          nativeToScVal(params.starAmount, { type: 'i128' }),
        )
      )
      .setTimeout(30)
      .build()

    // Simulate first to catch errors before submitting
    const sim = await this.rpcServer.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(
        `Soroban simulation failed: ${sim.error}`
      )
    }

    // Assemble with simulation results and sign
    const assembled = rpc.assembleTransaction(
      tx, sim
    ).build()
    assembled.sign(this.platformKeypair)

    // Submit to network
    const result = await this.rpcServer.sendTransaction(
      assembled
    )
    if (result.status === 'ERROR') {
      throw new Error(
        `Soroban submit failed: ${JSON.stringify(result.errorResult)}`
      )
    }

    // Poll for confirmation (max 40 seconds)
    const hash = result.hash
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const txResult = await this.rpcServer.getTransaction(
        hash
      )
      if (
        txResult.status ===
        rpc.Api.GetTransactionStatus.SUCCESS
      ) {
        this.logger.log(
          `STAR minted on-chain ✓ hash: ${hash}`
        )
        return { hash }
      }
      if (
        txResult.status ===
        rpc.Api.GetTransactionStatus.FAILED
      ) {
        throw new Error(`STAR mint failed on-chain: ${hash}`)
      }
    }

    throw new Error(`STAR mint timed out: ${hash}`)
  }

  async getStarBalance(walletAddress: string): Promise<bigint> {
    try {
      const account = await this.rpcServer.getAccount(
        this.platformKeypair.publicKey()
      )
      const contract = new Contract(this.starTokenId)

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'balance',
            new Address(walletAddress).toScVal()
          )
        )
        .setTimeout(30)
        .build()

      const sim = await this.rpcServer.simulateTransaction(tx)
      if (
        rpc.Api.isSimulationSuccess(sim) &&
        sim.result
      ) {
        const native = scValToNative(sim.result.retval)
        return BigInt(native.toString())
      }
      return BigInt(0)
    } catch (e) {
      this.logger.warn(
        `getStarBalance failed for ${walletAddress}: ${e}`
      )
      return BigInt(0)
    }
  }

  private uuidToBytes32(uuid: string): Buffer {
    const clean = uuid.replace(/-/g, '')
    const buf = Buffer.alloc(32, 0)
    const hex = clean.padStart(64, '0').slice(-64)
    Buffer.from(hex, 'hex').copy(buf)
    return buf
  }
}
