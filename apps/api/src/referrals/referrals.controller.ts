import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ApiMockAuth } from "../common/decorators/api-auth-headers.decorator";
import {
  CurrentUser,
  type AuthenticatedPrincipal,
} from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AcceptReferralDto } from "./dto/accept-referral.dto";
import { CreateReferralDto } from "./dto/create-referral.dto";
import { ListReferralsDto } from "./dto/list-referrals.dto";
import { QualifyReferralDto } from "./dto/qualify-referral.dto";
import { ReferralsService } from "./referrals.service";

@ApiTags("Referrals")
@ApiMockAuth()
@UseGuards(JwtAuthGuard)
@Controller("referrals")
export class ReferralsController {
  constructor(
    @Inject(ReferralsService)
    private readonly referralsService: ReferralsService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create an invite referral code." })
  createInvite(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateReferralDto) {
    return this.referralsService.createInvite(principal, dto);
  }

  @Post("accept")
  @ApiOperation({ summary: "Accept a referral code as the invited user." })
  accept(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: AcceptReferralDto) {
    return this.referralsService.accept(principal, dto);
  }

  @Get()
  @ApiOperation({ summary: "List visible referrals." })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListReferralsDto) {
    return this.referralsService.list(principal, query);
  }

  @Post(":id/qualify")
  @ApiOperation({ summary: "Qualify a referral with the invited first payment." })
  qualify(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id") id: string,
    @Body() dto: QualifyReferralDto,
  ) {
    return this.referralsService.qualify(principal, id, dto);
  }

  @Post(":id/reward")
  @ApiOperation({ summary: "Issue the 100 STAR referral reward." })
  reward(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.referralsService.reward(principal, id);
  }
}
