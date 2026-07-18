import { Injectable, Logger } from '@nestjs/common';

export interface AmlScreeningResult {
  address: string;
  network: string;
  riskScore: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: AmlFlag[];
  screenedAt: Date;
  provider: string;
  referenceId: string;
}

export interface AmlFlag {
  type: string;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  description: string;
  metadata?: Record<string, unknown>;
}

export interface AmlProviderConfig {
  provider: 'mock' | 'chainalysis' | 'trm' | 'custom';
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
}

interface ChainalysisConfig {
  apiKey: string;
  baseUrl: string;
}

interface TRMConfig {
  apiKey: string;
  baseUrl: string;
}

@Injectable()
export class AmlService {
  private readonly logger = new Logger(AmlService.name);
  private readonly chainalysisConfig: ChainalysisConfig;
  private readonly trmConfig: TRMConfig;
  private readonly defaultProvider: 'chainalysis' | 'trm' | 'mock';

  constructor() {
    this.chainalysisConfig = {
      apiKey: process.env.CHAINALYSIS_API_KEY || '',
      baseUrl: process.env.CHAINALYSIS_BASE_URL || 'https://api.chainalysis.com',
    };
    this.trmConfig = {
      apiKey: process.env.TRM_API_KEY || '',
      baseUrl: process.env.TRM_BASE_URL || 'https://api.trmlabs.com',
    };
    this.defaultProvider = (process.env.AML_PROVIDER as 'chainalysis' | 'trm' | 'mock') || 'mock';
  }

  /**
   * Screen a wallet address for AML risk
   * @param address The wallet address to screen
   * @param network The blockchain network (default: 'stellar')
   * @returns AML screening result with risk score and flags
   */
  async screenWallet(address: string, network: string = 'stellar'): Promise<AmlScreeningResult> {
    this.logger.log(`Screening wallet ${address} on ${network} using ${this.defaultProvider}`);

    const referenceId = `AML_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if real provider is configured
    if (this.defaultProvider === 'chainalysis' && this.chainalysisConfig.apiKey) {
      return this.screenWithChainalysis(address, network, referenceId);
    }
    if (this.defaultProvider === 'trm' && this.trmConfig.apiKey) {
      return this.screenWithTRM(address, network, referenceId);
    }

    // Fallback to mock screening
    return this.mockScreening(address, network, referenceId);
  }

  /**
   * Batch screen multiple wallet addresses
   */
  async screenWallets(addresses: string[], network: string = 'stellar'): Promise<AmlScreeningResult[]> {
    const results = await Promise.all(
      addresses.map(addr => this.screenWallet(addr, network))
    );
    return results;
  }

  /**
   * Check if an address is on a sanctions list (mock implementation)
   */
  async isSanctioned(address: string, network: string = 'stellar'): Promise<boolean> {
    const result = await this.screenWallet(address, network);
    return result.flags.some(f => f.type === 'SANCTIONS' && f.severity === 'CRITICAL');
  }

  /**
   * Get risk level description for a score
   */
  private getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Mock AML screening for development/testing
   */
  private mockScreening(address: string, network: string, referenceId: string): AmlScreeningResult {
    // Deterministic risk score based on address hash
    const hash = this.simpleHash(address);
    const riskScore = hash % 100;

    const flags: AmlFlag[] = [];

    // Add some deterministic flags based on address characteristics
    if (address.startsWith('GB') || address.startsWith('GC')) {
      // Stellar addresses - check for known patterns
      if (hash % 10 === 0) {
        flags.push({
          type: 'HIGH_RISK_JURISDICTION',
          severity: 'WARNING',
          description: 'Address associated with high-risk jurisdiction',
          metadata: { jurisdiction: 'XX' },
        });
      }
    }

    // Simulate sanctions hit for specific test addresses
    if (address.toLowerCase().includes('sanction') || hash % 50 === 0) {
      flags.push({
        type: 'SANCTIONS',
        severity: 'CRITICAL',
        description: 'Address matches sanctions list',
        metadata: { list: 'OFAC SDN', matchConfidence: 0.95 },
      });
    }

    // Simulate mixer/tumbler usage
    if (hash % 20 === 0) {
      flags.push({
        type: 'MIXER_USAGE',
        severity: 'WARNING',
        description: 'Address has interacted with known mixing services',
        metadata: { mixer: 'Tornado Cash', lastInteraction: new Date(Date.now() - 86400000 * 30).toISOString() },
      });
    }

    // Simulate darknet market interaction
    if (hash % 30 === 0) {
      flags.push({
        type: 'DARKNET_MARKET',
        severity: 'HIGH',
        description: 'Address has interacted with darknet marketplace',
        metadata: { marketplace: 'Hydra', lastInteraction: new Date(Date.now() - 86400000 * 7).toISOString() },
      });
    }

    return {
      address,
      network,
      riskScore,
      riskLevel: this.getRiskLevel(riskScore),
      flags,
      screenedAt: new Date(),
      provider: 'mock',
      referenceId,
    };
  }

  /**
   * Screen using Chainalysis API
   */
  private async screenWithChainalysis(address: string, network: string, referenceId: string): Promise<AmlScreeningResult> {
    try {
      const response = await fetch(`${this.chainalysisConfig.baseUrl}/v1/address/${network}/${address}/screen`, {
        headers: {
          'Authorization': `Bearer ${this.chainalysisConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Chainalysis API error: ${response.status}`);
      }

      const data = await response.json();
      return this.mapChainalysisResponse(address, network, data, referenceId);
    } catch (error) {
      this.logger.error(`Chainalysis screening failed: ${error}`);
      // Fallback to mock
      return this.mockScreening(address, network, referenceId);
    }
  }

  /**
   * Screen using TRM Labs API
   */
  private async screenWithTRM(address: string, network: string, referenceId: string): Promise<AmlScreeningResult> {
    try {
      const response = await fetch(`${this.trmConfig.baseUrl}/v1/screen/address`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.trmConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, chain: network }),
      });

      if (!response.ok) {
        throw new Error(`TRM API error: ${response.status}`);
      }

      const data = await response.json();
      return this.mapTRMResponse(address, network, data, referenceId);
    } catch (error) {
      this.logger.error(`TRM screening failed: ${error}`);
      // Fallback to mock
      return this.mockScreening(address, network, referenceId);
    }
  }

  /**
   * Map Chainalysis response to our format
   */
  private mapChainalysisResponse(address: string, network: string, data: any, referenceId: string): AmlScreeningResult {
    const flags: AmlFlag[] = [];

    if (data.sanctions?.matches?.length > 0) {
      flags.push({
        type: 'SANCTIONS',
        severity: 'CRITICAL',
        description: 'Address matches sanctions list',
        metadata: { matches: data.sanctions.matches },
      });
    }

    if (data.riskFactors?.mixer) {
      flags.push({
        type: 'MIXER_USAGE',
        severity: 'WARNING',
        description: 'Address has interacted with mixing services',
        metadata: data.riskFactors.mixer,
      });
    }

    if (data.riskFactors?.darknet) {
      flags.push({
        type: 'DARKNET_MARKET',
        severity: 'HIGH',
        description: 'Address has interacted with darknet markets',
        metadata: data.riskFactors.darknet,
      });
    }

    return {
      address,
      network,
      riskScore: data.riskScore || 0,
      riskLevel: this.getRiskLevel(data.riskScore || 0),
      flags,
      screenedAt: new Date(),
      provider: 'chainalysis',
      referenceId,
    };
  }

  /**
   * Map TRM Labs response to our format
   */
  private mapTRMResponse(address: string, network: string, data: any, referenceId: string): AmlScreeningResult {
    const flags: AmlFlag[] = [];

    if (data.sanctions?.hits?.length > 0) {
      flags.push({
        type: 'SANCTIONS',
        severity: 'CRITICAL',
        description: 'Address matches sanctions list',
        metadata: { hits: data.sanctions.hits },
      });
    }

    if (data.counterparties?.mixers?.length > 0) {
      flags.push({
        type: 'MIXER_USAGE',
        severity: 'WARNING',
        description: 'Address has interacted with mixing services',
        metadata: { mixers: data.counterparties.mixers },
      });
    }

    if (data.counterparties?.darknetMarkets?.length > 0) {
      flags.push({
        type: 'DARKNET_MARKET',
        severity: 'HIGH',
        description: 'Address has interacted with darknet markets',
        metadata: { markets: data.counterparties.darknetMarkets },
      });
    }

    return {
      address,
      network,
      riskScore: data.riskScore || 0,
      riskLevel: this.getRiskLevel(data.riskScore || 0),
      flags,
      screenedAt: new Date(),
      provider: 'trm',
      referenceId,
    };
  }

  /**
   * Simple hash function for deterministic mock results
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}