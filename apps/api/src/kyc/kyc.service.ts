import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { KycStatus } from "../generated/prisma";

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(private readonly prisma: PrismaService) {}

  async processWebhook(payload: any) {
    this.logger.log(`Received KYCAID webhook: ${JSON.stringify(payload)}`);

    const { applicant_id, status } = payload;

    if (!applicant_id || !status) {
      this.logger.warn("Invalid webhook payload structure");
      return { success: false };
    }

    const user = await this.prisma.user.findFirst({
      where: { kycReference: applicant_id },
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
          actorUserId: user.id,
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
}
