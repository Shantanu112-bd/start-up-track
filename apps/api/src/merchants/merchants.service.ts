import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { createReadableId, sha256Hex } from "../common/utils/ids";
import { jsonObject } from "../common/utils/json";
import { normalizeUpiVpa } from "../common/utils/normalizers";
import { toPagination } from "../common/utils/pagination";
import { MerchantStatus, UserRole, type Merchant, type Prisma } from "../generated/prisma";
import type { AuthenticatedPrincipal } from "../common/decorators/current-user.decorator";
import type { CreateMerchantQrDto } from "./dto/create-merchant-qr.dto";
import type { CreateMerchantDto } from "./dto/create-merchant.dto";
import type { ListMerchantsDto } from "./dto/list-merchants.dto";
import type { UpdateMerchantDto } from "./dto/update-merchant.dto";

@Injectable()
export class MerchantsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(owner: AuthenticatedPrincipal, dto: CreateMerchantDto) {
    const ownerUserId = owner.role === UserRole.ADMIN ? (dto.ownerUserId ?? owner.id) : owner.id;

    return this.prisma.merchant.create({
      data: {
        category: dto.category ?? null,
        city: dto.city ?? null,
        country: dto.country ?? "IN",
        defaultUpiVpa: dto.defaultUpiVpa === undefined ? null : normalizeUpiVpa(dto.defaultUpiVpa),
        displayName: dto.displayName,
        gstin: dto.gstin ?? null,
        legalName: dto.legalName,
        merchantCode: createReadableId("MER"),
        metadata: jsonObject(dto.metadata),
        mockKycReference: createReadableId("MOCK_KYC"),
        ownerUserId,
        postalCode: dto.postalCode ?? null,
        state: dto.state ?? null,
      },
    });
  }

  async list(owner: AuthenticatedPrincipal, query: ListMerchantsDto) {
    const { skip, take } = toPagination(query);
    const where: Prisma.MerchantWhereInput = {
      ...(owner.role === UserRole.ADMIN ? {} : { ownerUserId: owner.id }),
      ...(query.city === undefined ? {} : { city: query.city }),
      ...(query.riskLevel === undefined ? {} : { riskLevel: query.riskLevel }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.search === undefined
        ? {}
        : {
            OR: [
              { displayName: { contains: query.search, mode: "insensitive" } },
              { legalName: { contains: query.search, mode: "insensitive" } },
              { merchantCode: { contains: query.search, mode: "insensitive" } },
            ],
          }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.merchant.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where,
      }),
      this.prisma.merchant.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(owner: AuthenticatedPrincipal, id: string) {
    const merchant = await this.prisma.merchant.findUnique({
      include: {
        owner: true,
        qrCodes: true,
      },
      where: { id },
    });

    if (merchant === null) {
      throw new NotFoundException("Merchant not found");
    }

    this.assertMerchantAccess(owner, merchant);

    return merchant;
  }

  async update(owner: AuthenticatedPrincipal, id: string, dto: UpdateMerchantDto) {
    await this.findOne(owner, id);

    return this.prisma.merchant.update({
      data: {
        ...(dto.category === undefined ? {} : { category: dto.category }),
        ...(dto.city === undefined ? {} : { city: dto.city }),
        ...(dto.country === undefined ? {} : { country: dto.country }),
        ...(dto.defaultUpiVpa === undefined
          ? {}
          : { defaultUpiVpa: normalizeUpiVpa(dto.defaultUpiVpa) }),
        ...(dto.displayName === undefined ? {} : { displayName: dto.displayName }),
        ...(dto.metadata === undefined ? {} : { metadata: jsonObject(dto.metadata) }),
        ...(dto.postalCode === undefined ? {} : { postalCode: dto.postalCode }),
        ...(dto.riskLevel === undefined ? {} : { riskLevel: dto.riskLevel }),
        ...(dto.state === undefined ? {} : { state: dto.state }),
        ...(owner.role === UserRole.ADMIN && dto.status !== undefined
          ? {
              status: dto.status,
            }
          : {}),
        ...(owner.role === UserRole.ADMIN && dto.status === MerchantStatus.APPROVED
          ? {
              approvedAt: new Date(),
              approvedByAdmin: { connect: { id: owner.id } },
            }
          : {}),
      },
      where: { id },
    });
  }

  approve(admin: AuthenticatedPrincipal, id: string) {
    return this.prisma.merchant.update({
      data: {
        approvedAt: new Date(),
        approvedByAdmin: { connect: { id: admin.id } },
        status: MerchantStatus.APPROVED,
      },
      where: { id },
    });
  }

  reject(id: string) {
    return this.prisma.merchant.update({
      data: { status: MerchantStatus.REJECTED },
      where: { id },
    });
  }

  suspend(id: string) {
    return this.prisma.merchant.update({
      data: { status: MerchantStatus.SUSPENDED },
      where: { id },
    });
  }

  async createQr(owner: AuthenticatedPrincipal, merchantId: string, dto: CreateMerchantQrDto) {
    const merchant = await this.findOne(owner, merchantId);
    const upiVpa = normalizeUpiVpa(dto.upiVpa);
    const qrPayload =
      dto.qrPayload ??
      this.createMockUpiPayload(upiVpa, merchant.displayName, dto.defaultAmountPaise);

    return this.prisma.merchantQrCode.create({
      data: {
        defaultAmountPaise:
          dto.defaultAmountPaise === undefined ? null : BigInt(dto.defaultAmountPaise),
        merchantId,
        metadata: jsonObject(dto.metadata),
        qrPayload,
        qrPayloadHash: sha256Hex(qrPayload),
        upiVpa,
      },
    });
  }

  async analytics(owner: AuthenticatedPrincipal, merchantId: string) {
    await this.findOne(owner, merchantId);

    const [transactionStats, rewards, campaignParticipation] = await this.prisma.$transaction([
      this.prisma.transaction.aggregate({
        _avg: { amountInPaise: true },
        _count: { _all: true },
        _sum: { amountInPaise: true },
        where: { merchantId },
      }),
      this.prisma.reward.aggregate({
        _sum: { starAmount: true },
        where: {
          transaction: { merchantId },
        },
      }),
      this.prisma.campaignMerchant.count({
        where: { merchantId, isActive: true },
      }),
    ]);

    return {
      averageTicketSizePaise: transactionStats._avg.amountInPaise ?? 0,
      campaignParticipation,
      revenuePaise: transactionStats._sum.amountInPaise ?? 0,
      rewardsIssuedStar: rewards._sum.starAmount ?? 0,
      transactions: transactionStats._count._all,
    };
  }

  async findByUpiVpa(upiVpa: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        OR: [
          { defaultUpiVpa: upiVpa },
          { qrCodes: { some: { upiVpa } } }
        ],
        status: MerchantStatus.APPROVED
      },
      include: { qrCodes: { where: { isActive: true }, take: 1 } }
    });
    return merchant;
  }

  async findByOwner(ownerUserId: string) {
    return this.prisma.merchant.findFirst({
      where: {
        ownerUserId,
        status: MerchantStatus.APPROVED,
      },
    });
  }

  private assertMerchantAccess(owner: AuthenticatedPrincipal, merchant: Merchant) {
    if (owner.role === UserRole.ADMIN || merchant.ownerUserId === owner.id) {
      return;
    }

    throw new ForbiddenException("Merchant belongs to another user");
  }

  private createMockUpiPayload(
    upiVpa: string,
    payeeName: string,
    amountPaise: string | undefined,
  ): string {
    const params = new URLSearchParams({
      cu: "INR",
      pa: upiVpa,
      pn: payeeName,
    });

    if (amountPaise !== undefined) {
      params.set("am", (Number(amountPaise) / 100).toFixed(2));
    }

    return `upi://pay?${params.toString()}`;
  }
}
