import { ApiClient } from '../core/ApiClient';

export class KycClient {
  constructor(private readonly client: ApiClient) {}

  async start(): Promise<{ verificationUrl: string }> {
    return this.client.post('/kyc/start', {});
  }

  async getStatus(): Promise<{ kycStatus: string; kycReference: string | null; kycVerifiedAt: string | null }> {
    return this.client.get('/kyc/status');
  }
}
