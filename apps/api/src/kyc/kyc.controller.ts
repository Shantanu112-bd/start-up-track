import { Body, Controller, Post, Get, Headers, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import * as crypto from "crypto";

import { KycService } from "./kyc.service";
import { CurrentUser, type AuthenticatedPrincipal } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ApiMockAuth } from "../common/decorators/api-auth-headers.decorator";

@ApiTags("KYC")
@Controller("kyc")
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post("webhook")
  @ApiOperation({ summary: "KYCAID webhook callback" })
  async handleWebhook(
    @Headers("x-kycaid-signature") signature: string,
    @Body() payload: any
  ) {
    if (!signature) {
      throw new UnauthorizedException("Missing signature");
    }

    const secret = process.env.KYCAID_API_TOKEN;
    if (!secret) {
      throw new UnauthorizedException("KYCAID_API_TOKEN not configured");
    }
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    if (signature !== expectedSignature) {
      throw new UnauthorizedException("Invalid signature");
    }

    return this.kycService.processWebhook(payload);
  }

  @Get("status")
  @UseGuards(JwtAuthGuard)
  @ApiMockAuth()
  @ApiOperation({ summary: "Get current user KYC status" })
  async getStatus(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.kycService.getStatus(user.id);
  }

  @Post("start")
  @UseGuards(JwtAuthGuard)
  @ApiMockAuth()
  @ApiOperation({ summary: "Start KYC verification" })
  async startVerification(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.kycService.createVerification(user.id);
  }
}
