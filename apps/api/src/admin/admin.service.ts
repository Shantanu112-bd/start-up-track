import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { jsonObject } from "../common/utils/json";
import { toPagination } from "../common/utils/pagination";
import { MerchantStatus, RewardStatus, TransactionStatus, type Prisma } from "../generated/prisma";
import type { AuthenticatedPrincipal } from "../common/decorators/current-user.decorator";
import type { ReviewMerchantDto } from "./dto/review-merchant.dto";
import type { ListAdminLogsDto } from "./dto/list-admin-logs.dto";
import type { ListUsersDto } from "../users/dto/list-users.dto";
import type { ListTransactionsDto } from "../transactions/dto/list-transactions.dto";
import type { ListRewardsDto } from "../rewards/dto/list-rewards.dto";
import type { UpdateUserStatusDto } from "./dto/update-user-status.dto";

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async overview() {
    const [
      users,
      merchants,
      completedTransactions,
      failedTransactions,
      mintedRewards,
      pendingRewards,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.merchant.count(),
      this.prisma.transaction.count({
        where: { status: TransactionStatus.COMPLETED },
      }),
      this.prisma.transaction.count({
        where: { status: TransactionStatus.FAILED },
      }),
      this.prisma.reward.aggregate({
        _sum: { starAmount: true },
        where: { status: RewardStatus.MINTED },
      }),
      this.prisma.reward.count({
        where: { status: RewardStatus.PENDING },
      }),
    ]);

    return {
      completedTransactions,
      failedTransactions,
      merchants,
      mintedRewardsStar: mintedRewards._sum.starAmount ?? 0,
      pendingRewards,
      users,
    };
  }

  async listUsers(query: ListUsersDto) {
    const { skip, take } = toPagination(query);
    const where: Prisma.UserWhereInput = {
      ...(query.role === undefined ? {} : { role: query.role }),
      ...(query.status === undefined ? {} : { status: query.status }),
      deletedAt: null,
      ...(query.search === undefined
        ? {}
        : {
            OR: [
              { displayName: { contains: query.search, mode: "insensitive" } },
              { emailNormalized: { contains: query.search, mode: "insensitive" } },
              { phoneE164: { contains: query.search } },
            ],
          }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ orderBy: { createdAt: "desc" }, skip, take, where }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  async updateUserStatus(actor: AuthenticatedPrincipal, userId: string, dto: UpdateUserStatusDto) {
    const before = await this.prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } });
    const after = await this.prisma.user.update({
      data: { status: dto.status },
      where: { id: userId },
    });
    await this.log(actor, "user.status.update", "user", userId, before, after);

    return after;
  }

  listPendingMerchants() {
    return this.prisma.merchant.findMany({
      orderBy: { createdAt: "asc" },
      where: { status: MerchantStatus.PENDING },
    });
  }

  async approveMerchant(actor: AuthenticatedPrincipal, merchantId: string, dto: ReviewMerchantDto) {
    const before = await this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
    });
    const after = await this.prisma.merchant.update({
      data: {
        approvedAt: new Date(),
        approvedByAdminId: actor.id,
        ...(dto.metadata === undefined ? {} : { metadata: jsonObject(dto.metadata) }),
        ...(dto.riskLevel === undefined ? {} : { riskLevel: dto.riskLevel }),
        status: MerchantStatus.APPROVED,
      },
      where: { id: merchantId },
    });
    await this.log(actor, "merchant.approve", "merchant", merchantId, before, after);

    return after;
  }

  async rejectMerchant(actor: AuthenticatedPrincipal, merchantId: string, dto: ReviewMerchantDto) {
    const before = await this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
    });
    const after = await this.prisma.merchant.update({
      data: {
        ...(dto.metadata === undefined ? {} : { metadata: jsonObject(dto.metadata) }),
        ...(dto.riskLevel === undefined ? {} : { riskLevel: dto.riskLevel }),
        status: MerchantStatus.REJECTED,
      },
      where: { id: merchantId },
    });
    await this.log(actor, "merchant.reject", "merchant", merchantId, before, after);

    return after;
  }

  async suspendMerchant(actor: AuthenticatedPrincipal, merchantId: string, dto: ReviewMerchantDto) {
    const before = await this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
    });
    const after = await this.prisma.merchant.update({
      data: {
        ...(dto.metadata === undefined ? {} : { metadata: jsonObject(dto.metadata) }),
        ...(dto.riskLevel === undefined ? {} : { riskLevel: dto.riskLevel }),
        status: MerchantStatus.SUSPENDED,
      },
      where: { id: merchantId },
    });
    await this.log(actor, "merchant.suspend", "merchant", merchantId, before, after);

    return after;
  }

  async listTransactions(query: ListTransactionsDto) {
    const { skip, take } = toPagination(query);
    const where: Prisma.TransactionWhereInput = {
      ...(query.assetIn === undefined ? {} : { assetIn: query.assetIn }),
      ...(query.campaignId === undefined ? {} : { campaignId: query.campaignId }),
      ...(query.merchantId === undefined ? {} : { merchantId: query.merchantId }),
      ...(query.status === undefined ? {} : { status: query.status }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        include: { merchant: true, rewards: true, user: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { items, total };
  }

  async listRewards(query: ListRewardsDto) {
    const { skip, take } = toPagination(query);
    const where: Prisma.RewardWhereInput = {
      ...(query.reason === undefined ? {} : { reason: query.reason }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.userId === undefined ? {} : { userId: query.userId }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reward.findMany({
        include: { campaign: true, referral: true, transaction: true, user: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where,
      }),
      this.prisma.reward.count({ where }),
    ]);

    return { items, total };
  }

  async listLogs(query: ListAdminLogsDto) {
    const { skip, take } = toPagination(query);
    const where: Prisma.AdminLogWhereInput = {
      ...(query.action === undefined ? {} : { action: query.action }),
      ...(query.actorUserId === undefined ? {} : { actorUserId: query.actorUserId }),
      ...(query.targetType === undefined ? {} : { targetType: query.targetType }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminLog.findMany({
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where,
      }),
      this.prisma.adminLog.count({ where }),
    ]);

    return { items, total };
  }

  private log(
    actor: AuthenticatedPrincipal,
    action: string,
    targetType: string,
    targetId: string,
    before: unknown,
    after: unknown,
  ) {
    return this.prisma.adminLog.create({
      data: {
        action,
        actorUserId: actor.id,
        after: after as Prisma.InputJsonValue,
        before: before as Prisma.InputJsonValue,
        targetId,
        targetType,
      },
    });
  }
}
