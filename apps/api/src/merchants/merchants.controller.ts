import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ApiMockAuth } from "../common/decorators/api-auth-headers.decorator";
import {
  CurrentUser,
  type AuthenticatedPrincipal,
} from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { UserRole } from "../generated/prisma";
import { CreateMerchantQrDto } from "./dto/create-merchant-qr.dto";
import { CreateMerchantDto } from "./dto/create-merchant.dto";
import { ListMerchantsDto } from "./dto/list-merchants.dto";
import { UpdateMerchantDto } from "./dto/update-merchant.dto";
import { MerchantsService } from "./merchants.service";

@ApiTags("Merchants")
@ApiMockAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT_OPERATOR, UserRole.ADMIN)
@Controller("merchants")
export class MerchantsController {
  constructor(
    @Inject(MerchantsService)
    private readonly merchantsService: MerchantsService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Register a merchant for approval." })
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateMerchantDto) {
    return this.merchantsService.create(principal, dto);
  }

  @Get()
  @ApiOperation({ summary: "List merchants visible to the current user." })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListMerchantsDto) {
    return this.merchantsService.list(principal, query);
  }

  @Get("by-vpa/:vpa")
  @Roles(UserRole.CONSUMER, UserRole.MERCHANT_OPERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: "Get merchant details by UPI VPA." })
  findByUpiVpa(@CurrentUser() principal: AuthenticatedPrincipal, @Param("vpa") vpa: string) {
    return this.merchantsService.findByUpiVpa(vpa);
  }

  @Get("mine")
  @ApiOperation({ summary: "Get my merchant profile." })
  async getMyMerchant(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.merchantsService.findByOwner(user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get merchant details and QR codes." })
  findOne(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.merchantsService.findOne(principal, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update merchant profile fields." })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id") id: string,
    @Body() dto: UpdateMerchantDto,
  ) {
    return this.merchantsService.update(principal, id, dto);
  }

  @Post(":id/approve")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Approve a pending merchant." })
  approve(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.merchantsService.approve(principal, id);
  }

  @Post(":id/reject")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Reject a merchant." })
  reject(@Param("id") id: string) {
    return this.merchantsService.reject(id);
  }

  @Post(":id/suspend")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Suspend a merchant." })
  suspend(@Param("id") id: string) {
    return this.merchantsService.suspend(id);
  }

  @Post(":id/qrs")
  @ApiOperation({ summary: "Create a mocked UPI QR for a merchant." })
  createQr(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id") id: string,
    @Body() dto: CreateMerchantQrDto,
  ) {
    return this.merchantsService.createQr(principal, id, dto);
  }

  @Get(":id/analytics")
  @ApiOperation({ summary: "Return merchant revenue and reward metrics." })
  analytics(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.merchantsService.analytics(principal, id);
  }
}
