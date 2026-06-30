import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { Keypair } from "@stellar/stellar-sdk";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";

import { UserRole, UserStatus, WalletStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { createReadableId, createReferralCode } from "../common/utils/ids";
import {
  normalizeEmail,
  normalizePhone,
  normalizeWalletAddress,
} from "../common/utils/normalizers";
import type { AuthenticatedPrincipal } from "../common/decorators/current-user.decorator";
import type { MockLoginDto } from "./dto/mock-login.dto";
import type { WalletChallengeDto } from "./dto/wallet-challenge.dto";
import type { WalletLoginDto } from "./dto/wallet-login.dto";
import type { RefreshDto } from "./dto/refresh.dto";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly jwtService: JwtService,
  ) {}

  async mockLogin(dto: MockLoginDto) {
    if (process.env.NODE_ENV === "production") {
      throw new BadRequestException("Mock login is disabled in production");
    }
    const emailNormalized = normalizeEmail(dto.email);
    const phoneE164 = normalizePhone(dto.phoneE164);

    if (emailNormalized === undefined && phoneE164 === undefined) {
      throw new BadRequestException("Either email or phoneE164 is required");
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(emailNormalized === undefined ? [] : [{ emailNormalized }]),
          ...(phoneE164 === undefined ? [] : [{ phoneE164 }]),
        ],
      },
    });

    const user =
      existingUser === null
        ? await this.prisma.user.create({
            data: {
              displayName: dto.displayName ?? null,
              email: dto.email ?? null,
              emailNormalized: emailNormalized ?? null,
              phoneE164: phoneE164 ?? null,
              referralCode: createReferralCode(),
              role: dto.role ?? UserRole.CONSUMER,
              status: UserStatus.ACTIVE,
            },
          })
        : await this.prisma.user.update({
            data: {
              ...(dto.displayName === undefined ? {} : { displayName: dto.displayName }),
              lastLoginAt: new Date(),
              ...(existingUser.status === UserStatus.PENDING_ONBOARDING
                ? { status: UserStatus.ACTIVE }
                : {}),
            },
            where: { id: existingUser.id },
          });

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.role);

    if (process.env.NODE_ENV !== 'production') {
      await this.prisma.adminLog.create({
        data: {
          actorUserId: user.id,
          action: 'USER_LOGIN_MOCK',
          targetType: 'USER',
          targetId: user.id,
          metadata: { method: 'MOCK' } as any,
        },
      })
    }

    return {
      auth: { accessToken, refreshToken },
      user,
    };
  }

  async issueWalletChallenge(dto: WalletChallengeDto) {
    const nonce = createReadableId("NONCE");
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);

    // Store nonce as valid/unused with 5 min TTL
    await this.cacheManager.set(`nonce:${nonce}`, 'issued', 5 * 60 * 1000);

    return {
      expiresAt,
      message: `CryptoPay Network login\nnetwork=${dto.network}\nprovider=${dto.provider}\naddress=${dto.address}\nnonce=${nonce}`,
      nonce,
    };
  }

  async walletLogin(dto: WalletLoginDto) {
    // Verify nonce was issued by us and hasn't been used
    const nonceStatus = await this.cacheManager.get(`nonce:${dto.nonce}`);
    
    if (nonceStatus !== 'issued') {
      throw new UnauthorizedException(`Invalid or expired nonce: ${dto.nonce}, status: ${nonceStatus}`);
    }

    // Immediately invalidate nonce to prevent replay
    await this.cacheManager.del(`nonce:${dto.nonce}`);
    const expectedMessage = `CryptoPay Network login\nnetwork=${dto.network}\nprovider=${dto.provider}\naddress=${dto.address}\nnonce=${dto.nonce}`;

    let isValidSignature = false;
    try {
      const keypair = Keypair.fromPublicKey(dto.address);
      
      // Freighter (SEP-53) signs the SHA-256 hash of the prefixed message
      const prefix = Buffer.from('Stellar Signed Message:\n');
      const messageBytes = Buffer.from(expectedMessage, 'utf-8');
      const payload = Buffer.concat([prefix, messageBytes]);
      
      const crypto = require('crypto');
      const messageHash = crypto.createHash('sha256').update(payload).digest();
      
      const signatureBuffer = Buffer.from(dto.signature, 'base64');
      isValidSignature = keypair.verify(messageHash, signatureBuffer);
      
      if (!isValidSignature) {
        // Fallback: Some clients sign the raw payload directly instead of the hash
        isValidSignature = keypair.verify(payload, signatureBuffer);
      }
      
      if (!isValidSignature) {
        // Fallback 2: Verify without the Stellar Signed Message prefix at all
        isValidSignature = keypair.verify(messageBytes, signatureBuffer);
      }
      
      if (!isValidSignature) {
         console.error(`Signature verification completely failed! Addr: ${dto.address}, sig base64: ${dto.signature}, sig bytes length: ${signatureBuffer.length}`);
      }
    } catch (error: any) {
      throw new UnauthorizedException(`Invalid signature format: ${error.message} | sig length: ${dto.signature?.length}`);
    }

    if (!isValidSignature) {
      throw new UnauthorizedException(`Signature verification failed. Expected msg: ${expectedMessage.replace(/\n/g, '\\n')}`);
    }

    const addressNormalized = normalizeWalletAddress(dto.address);
    const wallet = await this.prisma.wallet.findUnique({
      include: { user: true },
      where: {
        network_addressNormalized: {
          addressNormalized,
          network: dto.network,
        },
      },
    });

    if (wallet !== null) {
      const user = await this.prisma.user.update({
        data: { lastLoginAt: new Date(), status: UserStatus.ACTIVE },
        where: { id: wallet.userId },
      });

      await this.prisma.wallet.update({
        data: {
          lastUsedAt: new Date(),
          status: WalletStatus.ACTIVE,
        },
        where: { id: wallet.id },
      });

      const { accessToken, refreshToken } = await this.generateTokens(user.id, user.role);

      await this.prisma.adminLog.create({
        data: {
          actorUserId: user.id,
          action: 'USER_LOGIN',
          targetType: 'USER',
          targetId: user.id,
          metadata: {
            method: 'WALLET',
            network: dto.network,
            provider: dto.provider,
            address: dto.address.substring(0, 8) + '...',
          } as any,
        },
      })

      return {
        auth: { accessToken, refreshToken },
        user,
        wallet,
      };
    }

    const user = await this.prisma.user.create({
      data: {
        displayName: dto.displayName ?? null,
        referralCode: createReferralCode(),
        role: dto.role ?? UserRole.CONSUMER,
        status: UserStatus.ACTIVE,
        wallets: {
          create: {
            address: dto.address,
            addressNormalized,
            isPrimary: true,
            lastUsedAt: new Date(),
            network: dto.network,
            provider: dto.provider,
            status: WalletStatus.ACTIVE,
            verifiedAt: new Date(),
          },
        },
      },
    });
    const createdWallet = await this.prisma.wallet.findFirstOrThrow({
      where: { userId: user.id },
    });

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.role);

    await this.prisma.adminLog.create({
      data: {
        actorUserId: user.id,
        action: 'USER_LOGIN',
        targetType: 'USER',
        targetId: user.id,
        metadata: {
          method: 'WALLET',
          network: dto.network,
          provider: dto.provider,
          address: dto.address.substring(0, 8) + '...',
        } as any,
      },
    })

    return {
      auth: { accessToken, refreshToken },
      user,
      wallet: createdWallet,
    };
  }

  async refreshToken(dto: RefreshDto) {
    let decoded: any;
    try {
      decoded = this.jwtService.decode(dto.refreshToken);
    } catch {
      throw new BadRequestException("Invalid token format");
    }

    if (!decoded || !decoded.sub) {
      throw new BadRequestException("Invalid token");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: decoded.sub as string, deletedAt: null },
    });

    if (!user || !user.hashedRefreshToken) {
      throw new BadRequestException("Invalid refresh token");
    }

    const isMatch = await bcrypt.compare(dto.refreshToken, user.hashedRefreshToken);
    if (!isMatch) {
      throw new BadRequestException("Invalid refresh token");
    }

    try {
      this.jwtService.verify(dto.refreshToken, { secret: process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret" });
    } catch (err) {
      throw new BadRequestException("Refresh token expired");
    }

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.role);
    return {
      auth: { accessToken, refreshToken },
    };
  }

  async me(principal: AuthenticatedPrincipal) {
    return this.prisma.user.findFirstOrThrow({
      include: {
        wallets: true,
      },
      where: { id: principal.id, deletedAt: null },
    });
  }

  private async generateTokens(userId: string, role: UserRole) {
    const payload = { sub: userId, role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret",
      expiresIn: "30d",
    });

    const salt = await bcrypt.genSalt();
    const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }
}
