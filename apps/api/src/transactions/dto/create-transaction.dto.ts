import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

import { IsPositiveBigIntString } from "../../common/validators/is-bigint-string.validator";
import { IsUpiVpa } from "../../common/validators/is-upi-vpa.validator";
import { AssetCode } from "../../generated/prisma";

export class CreateTransactionDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  walletId?: string;

  @ApiProperty({ format: "uuid" })
  @IsString()
  merchantId!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  merchantQrCodeId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiProperty({ enum: AssetCode, example: AssetCode.USDC })
  @IsEnum(AssetCode)
  assetIn!: AssetCode;

  @ApiProperty({ example: "50000" })
  @IsPositiveBigIntString()
  amountInPaise!: string;

  @ApiPropertyOptional({ example: "raofresh@upi" })
  @IsOptional()
  @IsUpiVpa()
  @MaxLength(120)
  merchantUpiVpa?: string;

  @ApiPropertyOptional({
    description: "Raw scanned UPI QR payload. Stored as a hash.",
    example: "upi://pay?pa=raofresh@upi&pn=Rao%20Fresh%20Mart&am=500",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  qrPayload?: string;
}
