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
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CampaignStatus } from "../generated/prisma";
import { CampaignsService } from "./campaigns.service";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { ListCampaignsDto } from "./dto/list-campaigns.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";

@ApiTags("Campaigns")
@ApiMockAuth()
@UseGuards(JwtAuthGuard)
@Controller("campaigns")
export class CampaignsController {
  constructor(
    @Inject(CampaignsService)
    private readonly campaignsService: CampaignsService,
  ) {}

  @Post("brands")
  @ApiOperation({ summary: "Create a brand account for campaign funding." })
  createBrand(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateBrandDto) {
    return this.campaignsService.createBrand(principal, dto);
  }

  @Get("brands")
  @ApiOperation({ summary: "List brand accounts visible to the current user." })
  listBrands(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.campaignsService.listBrands(principal);
  }

  @Post()
  @ApiOperation({ summary: "Create a brand-funded STAR campaign." })
  createCampaign(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.createCampaign(principal, dto);
  }

  @Get()
  @ApiOperation({ summary: "List campaigns with filters." })
  listCampaigns(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ListCampaignsDto,
  ) {
    return this.campaignsService.listCampaigns(principal, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get campaign details and merchant links." })
  findCampaign(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.campaignsService.findCampaign(principal, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a campaign." })
  updateCampaign(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id") id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.updateCampaign(principal, id, dto);
  }

  @Post(":id/activate")
  @ApiOperation({ summary: "Activate a campaign." })
  activate(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.campaignsService.setStatus(principal, id, CampaignStatus.ACTIVE);
  }

  @Post(":id/pause")
  @ApiOperation({ summary: "Pause a campaign." })
  pause(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.campaignsService.setStatus(principal, id, CampaignStatus.PAUSED);
  }

  @Post(":id/complete")
  @ApiOperation({ summary: "Complete a campaign." })
  complete(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.campaignsService.setStatus(principal, id, CampaignStatus.COMPLETED);
  }

  @Post(":id/merchants/:merchantId")
  @ApiOperation({ summary: "Link a merchant to a campaign." })
  addMerchant(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id") id: string,
    @Param("merchantId") merchantId: string,
  ) {
    return this.campaignsService.addMerchant(principal, id, merchantId);
  }

  @Get(":id/analytics")
  @ApiOperation({ summary: "Return campaign spend and reward analytics." })
  analytics(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.campaignsService.analytics(principal, id);
  }
}
