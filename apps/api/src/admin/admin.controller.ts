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
import { ListRewardsDto } from "../rewards/dto/list-rewards.dto";
import { ListTransactionsDto } from "../transactions/dto/list-transactions.dto";
import { ListUsersDto } from "../users/dto/list-users.dto";
import { UserRole } from "../generated/prisma";
import { AdminService } from "./admin.service";
import { ListAdminLogsDto } from "./dto/list-admin-logs.dto";
import { ReviewMerchantDto } from "./dto/review-merchant.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";

@ApiTags("Admin")
@ApiMockAuth()
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("admin")
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get("overview")
  @ApiOperation({ summary: "Return admin monitoring totals." })
  overview() {
    return this.adminService.overview();
  }

  @Get("users")
  @ApiOperation({ summary: "Admin user management list." })
  listUsers(@Query() query: ListUsersDto) {
    return this.adminService.listUsers(query);
  }

  @Patch("users/:id/status")
  @ApiOperation({ summary: "Admin update user status." })
  updateUserStatus(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id") id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(principal, id, dto);
  }

  @Get("merchants/pending")
  @ApiOperation({ summary: "List merchants waiting for approval." })
  listPendingMerchants() {
    return this.adminService.listPendingMerchants();
  }

  @Post("merchants/:id/approve")
  @ApiOperation({ summary: "Approve a merchant and audit the action." })
  approveMerchant(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id") id: string,
    @Body() dto: ReviewMerchantDto,
  ) {
    return this.adminService.approveMerchant(principal, id, dto);
  }

  @Post("merchants/:id/reject")
  @ApiOperation({ summary: "Reject a merchant and audit the action." })
  rejectMerchant(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id") id: string,
    @Body() dto: ReviewMerchantDto,
  ) {
    return this.adminService.rejectMerchant(principal, id, dto);
  }

  @Post("merchants/:id/suspend")
  @ApiOperation({ summary: "Suspend a merchant and audit the action." })
  suspendMerchant(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id") id: string,
    @Body() dto: ReviewMerchantDto,
  ) {
    return this.adminService.suspendMerchant(principal, id, dto);
  }

  @Get("transactions")
  @ApiOperation({ summary: "Admin transaction monitoring list." })
  listTransactions(@Query() query: ListTransactionsDto) {
    return this.adminService.listTransactions(query);
  }

  @Get("rewards")
  @ApiOperation({ summary: "Admin reward monitoring list." })
  listRewards(@Query() query: ListRewardsDto) {
    return this.adminService.listRewards(query);
  }

  @Get("logs")
  @ApiOperation({ summary: "List admin audit logs." })
  listLogs(@Query() query: ListAdminLogsDto) {
    return this.adminService.listLogs(query);
  }
}
