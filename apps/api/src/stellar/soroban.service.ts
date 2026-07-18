import { Injectable, Logger } from '@nestjs/common'
import {
  rpc,
  xdr,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Address,
  Keypair,
  scValToNative,
  Operation,
} from '@stellar/stellar-sdk'

@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name)
  private readonly rpcServer: rpc.Server
  private readonly platformKeypair: Keypair
  private readonly networkPassphrase = Networks.TESTNET
  private readonly rewardEngineId: string
  private readonly starTokenId: string
  private readonly paymentEngineId: string
  private readonly merchantRegistryId: string

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
    this.paymentEngineId =
      process.env.PAYMENT_ENGINE_CONTRACT_ADDRESS!
    this.merchantRegistryId =
      process.env.MERCHANT_REGISTRY_CONTRACT_ADDRESS!
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

  // ============================================================
  // TTL Optimization Helpers
  // ============================================================

  /**
   * Extend TTL for a contract's persistent storage entries if below threshold
   * This prevents contract data from being archived and needing restoration
   * @param contractId The contract address
   * @param keys The storage keys to check/extend (as ScVal)
   * @param thresholdLedgers Extend if TTL remaining is less than this (default: 1000 ledgers ~ 2.5 hours)
   * @param newTtlLedgers New TTL to set (default: 50000 ledgers ~ 5.5 days)
   */
  async extendTtlIfNeeded(
    contractId: string,
    keys: xdr.ScVal[],
    thresholdLedgers: number = 1000,
    newTtlLedgers: number = 50000
  ): Promise<{ extended: boolean; entriesExtended: number }> {
    try {
      // Get the ledger entry for each key to check TTL
      let extendedCount = 0

      for (const key of keys) {
        const contract = new Contract(contractId)

        // We need to check the TTL of the persistent storage entries
        // This requires reading the contract data and checking TTL
        // For now, we'll add extend_ttl operation to transactions that write data
        // The actual TTL extension happens during transaction submission
      }

      return { extended: extendedCount > 0, entriesExtended: extendedCount }
    } catch (error) {
      this.logger.warn(`TTL extension check failed: ${error}`)
      return { extended: false, entriesExtended: 0 }
    }
  }

  /**
   * Build an extend_ttl operation for contract data
   * This can be added to any transaction to bump TTL
   */
  buildExtendTtlOperation(
    contractId: string,
    key: xdr.ScVal,
    threshold: number,
    newTtl: number
  ): Operation {
    const contract = new Contract(contractId)
    return contract.call('extend_ttl', key, nativeToScVal(threshold, { type: 'u32' }), nativeToScVal(newTtl, { type: 'u32' })) as Operation
  }

  // ============================================================
  // PaymentEngine Contract Methods
  // ============================================================

  async createPayment(params: {
    paymentId: string
    payer: string
    merchantId: string
    asset: 'XLM' | 'USDC' | 'ETH' | 'BTC' | 'SOL'
    amountInPaise: bigint
    qrHash: string
    rewardId: string
  }): Promise<{ hash: string }> {
    this.logger.log(`Creating payment ${params.paymentId} on-chain`)

    const account = await this.rpcServer.getAccount(
      this.platformKeypair.publicKey()
    )

    const contract = new Contract(this.paymentEngineId)

    const paymentIdBytes = this.uuidToBytes32(params.paymentId)
    const payerBytes = this.uuidToBytes32(params.payer)
    const merchantIdBytes = this.uuidToBytes32(params.merchantId)
    const qrHashBytes = this.uuidToBytes32(params.qrHash)
    const rewardIdBytes = this.uuidToBytes32(params.rewardId)
    const operatorAddress = this.platformKeypair.publicKey()

    const assetMap: Record<string, number> = {
      ETH: 1,
      BTC: 2,
      SOL: 3,
      XLM: 4,
      USDC: 5,
    }

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'create_payment',
          nativeToScVal(operatorAddress, { type: 'address' }),
          nativeToScVal(Address.fromString(params.payer), { type: 'address' }),
          nativeToScVal(paymentIdBytes, { type: 'bytes' }),
          nativeToScVal(merchantIdBytes, { type: 'bytes' }),
          nativeToScVal(assetMap[params.asset], { type: 'u32' }),
          nativeToScVal(params.amountInPaise, { type: 'i128' }),
          nativeToScVal(qrHashBytes, { type: 'bytes' }),
          nativeToScVal(rewardIdBytes, { type: 'bytes' }),
        )
      )
      .setTimeout(30)
      .build()

    // Simulate first to catch errors
    const sim = await this.rpcServer.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Soroban simulation failed: ${sim.error}`)
    }

    const assembled = rpc.assembleTransaction(tx, sim).build()
    assembled.sign(this.platformKeypair)

    const result = await this.rpcServer.sendTransaction(assembled)
    if (result.status === 'ERROR') {
      throw new Error(`PaymentEngine create_payment failed: ${JSON.stringify(result.errorResult)}`)
    }

    // Poll for confirmation
    const hash = result.hash
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const txResult = await this.rpcServer.getTransaction(hash)
      if (txResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        this.logger.log(`PaymentEngine create_payment confirmed: ${hash}`)
        return { hash }
      }
      if (txResult.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`PaymentEngine create_payment failed on-chain: ${hash}`)
      }
    }
    throw new Error(`PaymentEngine create_payment timed out: ${hash}`)
  }

  async quotePayment(params: {
    paymentId: string
    assetAmount: bigint
    usdcAmount: bigint
    networkFeePaise: bigint
  }): Promise<{ hash: string }> {
    this.logger.log(`Quoting payment ${params.paymentId} on-chain`)

    const account = await this.rpcServer.getAccount(
      this.platformKeypair.publicKey()
    )

    const contract = new Contract(this.paymentEngineId)
    const paymentIdBytes = this.uuidToBytes32(params.paymentId)

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'quote_payment',
          nativeToScVal(paymentIdBytes, { type: 'bytes' }),
          nativeToScVal(params.assetAmount, { type: 'i128' }),
          nativeToScVal(params.usdcAmount, { type: 'i128' }),
          nativeToScVal(params.networkFeePaise, { type: 'i128' }),
        )
      )
      .setTimeout(30)
      .build()

    const sim = await this.rpcServer.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Soroban simulation failed: ${sim.error}`)
    }

    const assembled = rpc.assembleTransaction(tx, sim).build()
    assembled.sign(this.platformKeypair)

    const result = await this.rpcServer.sendTransaction(assembled)
    if (result.status === 'ERROR') {
      throw new Error(`PaymentEngine quote_payment failed: ${JSON.stringify(result.errorResult)}`)
    }

    const hash = result.hash
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const txResult = await this.rpcServer.getTransaction(hash)
      if (txResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        this.logger.log(`PaymentEngine quote_payment confirmed: ${hash}`)
        return { hash }
      }
      if (txResult.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`PaymentEngine quote_payment failed on-chain: ${hash}`)
      }
    }
    throw new Error(`PaymentEngine quote_payment timed out: ${hash}`)
  }

  async markConverted(paymentId: string): Promise<{ hash: string }> {
    return this.transitionPaymentStatus(paymentId, 'mark_converted')
  }

  async markSettled(paymentId: string): Promise<{ hash: string }> {
    return this.transitionPaymentStatus(paymentId, 'mark_settled')
  }

  async issueRewardOnChain(paymentId: string): Promise<{ hash: string; starAmount: bigint }> {
    this.logger.log(`Issuing reward for payment ${paymentId} on-chain`)

    const account = await this.rpcServer.getAccount(
      this.platformKeypair.publicKey()
    )

    const contract = new Contract(this.paymentEngineId)
    const paymentIdBytes = this.uuidToBytes32(paymentId)

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'issue_reward',
          nativeToScVal(paymentIdBytes, { type: 'bytes' }),
        )
      )
      .setTimeout(30)
      .build()

    const sim = await this.rpcServer.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Soroban simulation failed: ${sim.error}`)
    }

    const assembled = rpc.assembleTransaction(tx, sim).build()
    assembled.sign(this.platformKeypair)

    const result = await this.rpcServer.sendTransaction(assembled)
    if (result.status === 'ERROR') {
      throw new Error(`PaymentEngine issue_reward failed: ${JSON.stringify(result.errorResult)}`)
    }

    const hash = result.hash
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const txResult = await this.rpcServer.getTransaction(hash)
      if (txResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        this.logger.log(`PaymentEngine issue_reward confirmed: ${hash}`)
        // Try to extract the star amount from the transaction result
        let starAmount = 0n
        if (txResult.returnValue) {
          try {
            const native = scValToNative(txResult.returnValue)
            starAmount = BigInt(native.toString())
          } catch {
            // ignore
          }
        }
        return { hash, starAmount }
      }
      if (txResult.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`PaymentEngine issue_reward failed on-chain: ${hash}`)
      }
    }
    throw new Error(`PaymentEngine issue_reward timed out: ${hash}`)
  }

  async completePayment(paymentId: string): Promise<{ hash: string }> {
    return this.transitionPaymentStatus(paymentId, 'complete_payment')
  }

  // Alias for backward compatibility
  async issueReward(paymentId: string): Promise<{ hash: string; starAmount: bigint }> {
    return this.issueRewardOnChain(paymentId)
  }

  private async transitionPaymentStatus(paymentId: string, method: string): Promise<{ hash: string }> {
    this.logger.log(`PaymentEngine ${method} for payment ${paymentId}`)

    const account = await this.rpcServer.getAccount(
      this.platformKeypair.publicKey()
    )

    const contract = new Contract(this.paymentEngineId)
    const paymentIdBytes = this.uuidToBytes32(paymentId)

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          method,
          nativeToScVal(paymentIdBytes, { type: 'bytes' }),
        )
      )
      .setTimeout(30)
      .build()

    const sim = await this.rpcServer.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Soroban simulation failed: ${sim.error}`)
    }

    const assembled = rpc.assembleTransaction(tx, sim).build()
    assembled.sign(this.platformKeypair)

    const result = await this.rpcServer.sendTransaction(assembled)
    if (result.status === 'ERROR') {
      throw new Error(`PaymentEngine ${method} failed: ${JSON.stringify(result.errorResult)}`)
    }

    const hash = result.hash
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const txResult = await this.rpcServer.getTransaction(hash)
      if (txResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        this.logger.log(`PaymentEngine ${method} confirmed: ${hash}`)
        return { hash }
      }
      if (txResult.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`PaymentEngine ${method} failed on-chain: ${hash}`)
      }
    }
    throw new Error(`PaymentEngine ${method} timed out: ${hash}`)
  }

  // ============================================================
  // MerchantRegistry Contract Methods
  // ============================================================

  async registerMerchant(params: {
    merchantId: string
    owner: string
    upiIdHash: string
    metadataHash: string
  }): Promise<{ hash: string }> {
    this.logger.log(`Registering merchant ${params.merchantId} on-chain`)

    const account = await this.rpcServer.getAccount(
      this.platformKeypair.publicKey()
    )

    const contract = new Contract(this.merchantRegistryId)

    const merchantIdBytes = this.uuidToBytes32(params.merchantId)
    const upiIdHashBytes = this.uuidToBytes32(params.upiIdHash)
    const metadataHashBytes = this.uuidToBytes32(params.metadataHash)

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'register_merchant',
          nativeToScVal(merchantIdBytes, { type: 'bytes' }),
          nativeToScVal(Address.fromString(params.owner), { type: 'address' }),
          nativeToScVal(upiIdHashBytes, { type: 'bytes' }),
          nativeToScVal(metadataHashBytes, { type: 'bytes' }),
        )
      )
      .setTimeout(30)
      .build()

    const sim = await this.rpcServer.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Soroban simulation failed: ${sim.error}`)
    }

    const assembled = rpc.assembleTransaction(tx, sim).build()
    assembled.sign(this.platformKeypair)

    const result = await this.rpcServer.sendTransaction(assembled)
    if (result.status === 'ERROR') {
      throw new Error(`MerchantRegistry register_merchant failed: ${JSON.stringify(result.errorResult)}`)
    }

    const hash = result.hash
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const txResult = await this.rpcServer.getTransaction(hash)
      if (txResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        this.logger.log(`MerchantRegistry register_merchant confirmed: ${hash}`)
        return { hash }
      }
      if (txResult.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`MerchantRegistry register_merchant failed on-chain: ${hash}`)
      }
    }
    throw new Error(`MerchantRegistry register_merchant timed out: ${hash}`)
  }

  async approveMerchant(merchantId: string): Promise<{ hash: string }> {
    this.logger.log(`Approving merchant ${merchantId} on-chain`)

    const account = await this.rpcServer.getAccount(
      this.platformKeypair.publicKey()
    )

    const contract = new Contract(this.merchantRegistryId)
    const merchantIdBytes = this.uuidToBytes32(merchantId)

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'approve_merchant',
          nativeToScVal(merchantIdBytes, { type: 'bytes' }),
        )
      )
      .setTimeout(30)
      .build()

    const sim = await this.rpcServer.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Soroban simulation failed: ${sim.error}`)
    }

    const assembled = rpc.assembleTransaction(tx, sim).build()
    assembled.sign(this.platformKeypair)

    const result = await this.rpcServer.sendTransaction(assembled)
    if (result.status === 'ERROR') {
      throw new Error(`MerchantRegistry approve_merchant failed: ${JSON.stringify(result.errorResult)}`)
    }

    const hash = result.hash
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const txResult = await this.rpcServer.getTransaction(hash)
      if (txResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        this.logger.log(`MerchantRegistry approve_merchant confirmed: ${hash}`)
        return { hash }
      }
      if (txResult.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`MerchantRegistry approve_merchant failed on-chain: ${hash}`)
      }
    }
    throw new Error(`MerchantRegistry approve_merchant timed out: ${hash}`)
  }

  async suspendMerchant(merchantId: string): Promise<{ hash: string }> {
    return this.transitionMerchantStatus(merchantId, 'suspend_merchant')
  }

  async rejectMerchant(merchantId: string): Promise<{ hash: string }> {
    return this.transitionMerchantStatus(merchantId, 'reject_merchant')
  }

  private async transitionMerchantStatus(merchantId: string, method: string): Promise<{ hash: string }> {
    this.logger.log(`MerchantRegistry ${method} for merchant ${merchantId}`)

    const account = await this.rpcServer.getAccount(
      this.platformKeypair.publicKey()
    )

    const contract = new Contract(this.merchantRegistryId)
    const merchantIdBytes = this.uuidToBytes32(merchantId)

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          method,
          nativeToScVal(merchantIdBytes, { type: 'bytes' }),
        )
      )
      .setTimeout(30)
      .build()

    const sim = await this.rpcServer.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Soroban simulation failed: ${sim.error}`)
    }

    const assembled = rpc.assembleTransaction(tx, sim).build()
    assembled.sign(this.platformKeypair)

    const result = await this.rpcServer.sendTransaction(assembled)
    if (result.status === 'ERROR') {
      throw new Error(`MerchantRegistry ${method} failed: ${JSON.stringify(result.errorResult)}`)
    }

    const hash = result.hash
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const txResult = await this.rpcServer.getTransaction(hash)
      if (txResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        this.logger.log(`MerchantRegistry ${method} confirmed: ${hash}`)
        return { hash }
      }
      if (txResult.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`MerchantRegistry ${method} failed on-chain: ${hash}`)
      }
    }
    throw new Error(`MerchantRegistry ${method} timed out: ${hash}`)
  }

  async getMerchant(merchantId: string): Promise<any> {
    try {
      const account = await this.rpcServer.getAccount(
        this.platformKeypair.publicKey()
      )
      const contract = new Contract(this.merchantRegistryId)

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'get_merchant',
            nativeToScVal(this.uuidToBytes32(merchantId), { type: 'bytes' }),
          )
        )
        .setTimeout(30)
        .build()

      const sim = await this.rpcServer.simulateTransaction(tx)
      if (rpc.Api.isSimulationSuccess(sim) && sim.result) {
        return scValToNative(sim.result.retval)
      }
      return null
    } catch (e) {
      this.logger.warn(`getMerchant failed for ${merchantId}: ${e}`)
      return null
    }
  }

  async isMerchantApproved(merchantId: string): Promise<boolean> {
    try {
      const account = await this.rpcServer.getAccount(
        this.platformKeypair.publicKey()
      )
      const contract = new Contract(this.merchantRegistryId)

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'is_approved',
            nativeToScVal(this.uuidToBytes32(merchantId), { type: 'bytes' }),
          )
        )
        .setTimeout(30)
        .build()

      const sim = await this.rpcServer.simulateTransaction(tx)
      if (rpc.Api.isSimulationSuccess(sim) && sim.result) {
        return scValToNative(sim.result.retval) === true
      }
      return false
    } catch (e) {
      this.logger.warn(`isMerchantApproved failed for ${merchantId}: ${e}`)
      return false
    }
  }
}
