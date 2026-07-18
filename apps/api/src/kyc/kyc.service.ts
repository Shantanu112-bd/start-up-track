import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { KycStatus } from "../generated/prisma";
import { CircuitBreakerService } from "../common/circuit-breaker/circuit-breaker.service";

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async processWebhook(payload: any) {
    this.logger.log(`Received KYCAID webhook: ${JSON.stringify(payload)}`);

    const { applicant_id, status } = payload;

    if (!applicant_id || !status) {
      this.logger.warn("Invalid webhook payload structure");
      return { success: false };
    }

    const user = await this.prisma.user.findFirst({
      where: { kycReference: applicant_id, deletedAt: null },
    });

    if (!user) {
      this.logger.warn(`User not found for KYC reference: ${applicant_id}`);
      return { success: false };
    }

    let kycStatus: KycStatus = KycStatus.PENDING;
    if (status === "completed") {
      kycStatus = KycStatus.VERIFIED;
    } else if (status === "declined" || status === "rejected") {
      kycStatus = KycStatus.REJECTED;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          kycStatus,
          ...(kycStatus === KycStatus.VERIFIED ? { kycVerifiedAt: new Date() } : {}),
        },
      });

      await tx.adminLog.create({
        data: {
          actorUserId: null,
          action: "KYC_STATUS_UPDATED",
          targetType: "USER",
          targetId: user.id,
          metadata: { previousStatus: user.kycStatus, newStatus: kycStatus, provider: "KYCAID" } as any,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: "USER",
          aggregateId: user.id,
          eventType: "USER_KYC_UPDATED",
          payload: { userId: user.id, kycStatus },
        },
      });
    });

    return { success: true };
  }

  async getStatus(userId: string): Promise<{ kycStatus: KycStatus; kycReference: string | null; kycVerifiedAt: Date | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, kycReference: true, kycVerifiedAt: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      kycStatus: user.kycStatus,
      kycReference: user.kycReference,
      kycVerifiedAt: user.kycVerifiedAt,
    };
  }

  async createVerification(userId: string): Promise<{ verificationUrl: string }> {
    const apiToken = process.env.KYCAID_API_TOKEN;
    const formId = process.env.KYCAID_FORM_ID;

    if (!apiToken || !formId) {
      throw new Error('KYCAID not configured');
    }

    const policy = this.circuitBreaker.getPolicy('KYCAID');
    const response = (await policy.execute(() => fetch('https://api.kycaid.com/applicants', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'PERSON', form_id: formId }),
    }))) as Response;

    if (!response.ok) {
      throw new Error(`KYCAID error: ${response.statusText}`);
    }

    const data = await response.json() as { applicant_id: string; form_url: string };

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycReference: data.applicant_id,
        kycStatus: KycStatus.PENDING,
      },
    });

    await this.prisma.adminLog.create({
      data: {
        actorUserId: userId,
        action: 'KYC_VERIFICATION_STARTED',
        targetType: 'USER',
        targetId: userId,
        metadata: { applicantId: data.applicant_id } as any,
      },
    });

    return { verificationUrl: data.form_url };
  }
}
