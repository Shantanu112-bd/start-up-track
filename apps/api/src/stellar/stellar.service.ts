import { Injectable, Logger } from '@nestjs/common';
import {
  Horizon,
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Asset,
  Operation,
  Memo,
} from '@stellar/stellar-sdk';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private readonly server: Horizon.Server;
  private readonly platformKeypair: Keypair;
  private readonly networkPassphrase: string;

  constructor() {
    const secretKey = process.env.PLATFORM_STELLAR_SECRET_KEY;
    if (!secretKey) {
      throw new Error('PLATFORM_STELLAR_SECRET_KEY is not defined in environment variables');
    }
    this.platformKeypair = Keypair.fromSecret(secretKey);

    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    this.server = new Horizon.Server(horizonUrl);

    const network = process.env.STELLAR_NETWORK || 'testnet';
    this.networkPassphrase = network === 'public' ? Networks.PUBLIC : Networks.TESTNET;
  }

  async submitPayment(params: {
    transactionPublicId: string;
    assetCode: string;
    amountCrypto: string;
  }): Promise<{ hash: string; ledger: number }> {
    try {
      this.logger.debug(`Submitting real transaction on Stellar for ${params.transactionPublicId}`);
      
      const account = await this.server.loadAccount(this.platformKeypair.publicKey());
      
      const asset = params.assetCode === 'XLM'
        ? Asset.native()
        : new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
      
      // Minimum viable amount for testnet proof
      const amount = parseFloat(params.amountCrypto) > 0
        ? Math.max(parseFloat(params.amountCrypto), 0.0000001).toFixed(7)
        : '0.0000001';

      const txBuilder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(Operation.payment({
          destination: this.platformKeypair.publicKey(),
          asset,
          amount,
        }))
        .addMemo(Memo.text(params.transactionPublicId.substring(0, 28)))
        .setTimeout(30);

      const tx = txBuilder.build();
      tx.sign(this.platformKeypair);

      const result = await this.server.submitTransaction(tx);
      
      return { hash: result.hash, ledger: result.ledger };
    } catch (error) {
      this.logger.error('Failed to submit transaction to Stellar network', error);
      throw error;
    }
  }

  async getTransactionStatus(hash: string): Promise<boolean> {
    try {
      const tx = await this.server.transactions().transaction(hash).call();
      return tx.successful;
    } catch (error) {
      this.logger.error(`Failed to get transaction status for hash ${hash}`, error);
      return false;
    }
  }
}
