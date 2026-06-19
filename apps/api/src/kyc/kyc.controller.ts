import { Body, Controller, Post, Headers, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import * as crypto from "crypto";

import { KycService } from "./kyc.service";

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

    const secret = process.env.KYCAID_WEBHOOK_SECRET || "fallback_secret";
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    if (signature !== expectedSignature) {
      throw new UnauthorizedException("Invalid signature");
    }

    return this.kycService.processWebhook(payload);
  }
}
