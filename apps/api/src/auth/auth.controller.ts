import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type AuthenticatedPrincipal,
} from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { MockLoginDto } from "./dto/mock-login.dto";
import { WalletChallengeDto } from "./dto/wallet-challenge.dto";
import { WalletLoginDto } from "./dto/wallet-login.dto";
import { RefreshDto } from "./dto/refresh.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("mock-login")
  @ApiOperation({
    summary: "Create or reuse a demo user and return a JWT.",
  })
  mockLogin(@Body() dto: MockLoginDto) {
    return this.authService.mockLogin(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("wallet/challenge")
  @ApiOperation({ summary: "Generate a mock wallet login challenge." })
  walletChallenge(@Body() dto: WalletChallengeDto) {
    return this.authService.issueWalletChallenge(dto);
  }

  @Post("wallet/login")
  @ApiOperation({
    summary: "Create or reuse a user from a wallet login simulation.",
  })
  walletLogin(@Body() dto: WalletLoginDto) {
    return this.authService.walletLogin(dto);
  }

  @Post("refresh")
  @ApiOperation({
    summary: "Refresh JWT token.",
  })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refreshToken(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Return the active authenticated user." })
  me(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.authService.me(principal);
  }
}
