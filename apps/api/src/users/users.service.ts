import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { createReferralCode } from "../common/utils/ids";
import { jsonObject } from "../common/utils/json";
import { normalizeEmail, normalizePhone } from "../common/utils/normalizers";
import { toPagination } from "../common/utils/pagination";
import { UserRole, UserStatus, type Prisma } from "../generated/prisma";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { ListUsersDto } from "./dto/list-users.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    if (dto.email === undefined && dto.phoneE164 === undefined) {
      throw new BadRequestException("Either email or phoneE164 is required");
    }

    return this.prisma.user.create({
      data: {
        displayName: dto.displayName ?? null,
        email: dto.email ?? null,
        emailNormalized: normalizeEmail(dto.email) ?? null,
        metadata: jsonObject(dto.metadata),
        phoneE164: normalizePhone(dto.phoneE164) ?? null,
        referralCode: createReferralCode(),
        role: dto.role ?? UserRole.CONSUMER,
        status: dto.status ?? UserStatus.ACTIVE,
      },
    });
  }

  async list(query: ListUsersDto) {
    const { skip, take } = toPagination(query);
    const where: Prisma.UserWhereInput = {
      ...(query.role === undefined ? {} : { role: query.role }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.search === undefined
        ? {}
        : {
            OR: [
              { displayName: { contains: query.search, mode: "insensitive" } },
              {
                emailNormalized: {
                  contains: query.search.toLowerCase(),
                  mode: "insensitive",
                },
              },
              { phoneE164: { contains: query.search } },
            ],
          }),
      deletedAt: null,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
        where,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  findOne(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      include: {
        ownedBrands: true,
        ownedMerchants: true,
        wallets: true,
      },
      where: { id },
    });
  }

  update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      data: {
        ...(dto.displayName === undefined ? {} : { displayName: dto.displayName }),
        ...(dto.email === undefined
          ? {}
          : {
              email: dto.email,
              emailNormalized: normalizeEmail(dto.email) ?? null,
            }),
        ...(dto.metadata === undefined ? {} : { metadata: jsonObject(dto.metadata) }),
        ...(dto.phoneE164 === undefined
          ? {}
          : { phoneE164: normalizePhone(dto.phoneE164) ?? null }),
        ...(dto.role === undefined ? {} : { role: dto.role }),
        ...(dto.status === undefined ? {} : { status: dto.status }),
      },
      where: { id },
    });
  }

  suspend(id: string) {
    return this.prisma.user.update({
      data: { status: UserStatus.SUSPENDED },
      where: { id },
    });
  }

  activate(id: string) {
    return this.prisma.user.update({
      data: { status: UserStatus.ACTIVE },
      where: { id },
    });
  }

  softDelete(id: string) {
    return this.prisma.user.update({
      data: {
        deletedAt: new Date(),
        status: UserStatus.DELETED,
      },
      where: { id },
    });
  }

  async getAuditLog(userId: string, skip = 0, take = 50) {
    const items = await this.prisma.adminLog.findMany({
      where: { actorUserId: userId },
      orderBy: { createdAt: "desc" },
      skip: Number(skip) || 0,
      take: Number(take) || 50,
    });
    const total = await this.prisma.adminLog.count({
      where: { actorUserId: userId },
    });
    return { items, total };
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedBrands: true,
        ownedMerchants: true,
        wallets: true,
      },
    });
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
    });
    const auditLogs = await this.prisma.adminLog.findMany({
      where: { actorUserId: userId },
    });
    return {
      user,
      transactions,
      auditLogs,
      exportedAt: new Date(),
    };
  }
}
