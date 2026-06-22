import {
  Body,
  Controller,
  Delete,
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
import { CreateWalletDto } from "./dto/create-wallet.dto";
import { ListWalletsDto } from "./dto/list-wallets.dto";
import { UpdateWalletDto } from "./dto/update-wallet.dto";
import { WalletsService } from "./wallets.service";

@ApiTags("Wallets")
@ApiMockAuth()
@UseGuards(JwtAuthGuard)
@Controller("wallets")
export class WalletsController {
  constructor(
    @Inject(WalletsService)
    private readonly walletsService: WalletsService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Connect a wallet for the authenticated user." })
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateWalletDto) {
    return this.walletsService.create(principal, dto);
  }

  @Get()
  @ApiOperation({ summary: "List wallets for the authenticated user." })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListWalletsDto) {
    return this.walletsService.list(principal, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a wallet by id." })
  findOne(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.walletsService.findOne(principal, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update wallet label, primary flag, or status." })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id") id: string,
    @Body() dto: UpdateWalletDto,
  ) {
    return this.walletsService.update(principal, id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Disconnect a wallet." })
  disconnect(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.walletsService.disconnect(principal, id);
  }
}
