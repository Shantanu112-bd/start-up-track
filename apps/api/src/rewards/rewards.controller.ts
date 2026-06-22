import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
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
import { CalculateSpendRewardDto } from "./dto/calculate-spend-reward.dto";
import { CreateRewardDto } from "./dto/create-reward.dto";
import { ListRewardsDto } from "./dto/list-rewards.dto";
import { RewardsService } from "./rewards.service";

@ApiTags("Rewards")
@ApiMockAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("rewards")
export class RewardsController {
  constructor(
    @Inject(RewardsService)
    private readonly rewardsService: RewardsService,
  ) {}

  @Post("calculate/spend")
  @ApiOperation({ summary: "Calculate STAR for the PRD spend formula." })
  calculateSpendReward(@Body() dto: CalculateSpendRewardDto) {
    return this.rewardsService.calculateSpendReward(dto);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Create a manual/admin reward record." })
  create(@Body() dto: CreateRewardDto) {
    return this.rewardsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List visible rewards." })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListRewardsDto) {
    return this.rewardsService.list(principal, query);
  }

  @Get("balance")
  @ApiOperation({ summary: "Get STAR reward balance for current or target user." })
  balance(@CurrentUser() principal: AuthenticatedPrincipal, @Query("userId") userId?: string) {
    return this.rewardsService.balance(principal, userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get reward details." })
  findOne(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.rewardsService.findOne(principal, id);
  }

  @Post(":id/mint")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Mark a pending reward as minted." })
  mint(@Param("id") id: string) {
    return this.rewardsService.mint(id);
  }

  @Post(":id/reverse")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Reverse a reward." })
  reverse(@Param("id") id: string) {
    return this.rewardsService.reverse(id);
  }
}
