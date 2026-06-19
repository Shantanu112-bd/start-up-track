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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type AuthenticatedPrincipal,
} from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { UserRole } from "../generated/prisma";
import { CreateUserDto } from "./dto/create-user.dto";
import { ListUsersDto } from "./dto/list-users.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get("me/audit-log")
  @ApiOperation({ summary: "Get audit log for the authenticated user." })
  getAuditLog(@CurrentUser() principal: AuthenticatedPrincipal, @Query('skip') skip?: number, @Query('take') take?: number) {
    return this.usersService.getAuditLog(principal.id, skip, take);
  }

  @Get("me/export")
  @ApiOperation({ summary: "Export all user data." })
  exportData(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.usersService.exportData(principal.id);
  }

  @Delete("me")
  @ApiOperation({ summary: "Soft delete the authenticated user account." })
  deleteMe(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.usersService.softDelete(principal.id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Create a user." })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "List users with pagination and filters." })
  list(@Query() query: ListUsersDto) {
    return this.usersService.list(query);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Get a user profile and linked entities." })
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Update a user." })
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post(":id/activate")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Activate a user." })
  activate(@Param("id") id: string) {
    return this.usersService.activate(id);
  }

  @Post(":id/suspend")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Suspend a user." })
  suspend(@Param("id") id: string) {
    return this.usersService.suspend(id);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Soft-delete a user." })
  softDelete(@Param("id") id: string) {
    return this.usersService.softDelete(id);
  }
}
