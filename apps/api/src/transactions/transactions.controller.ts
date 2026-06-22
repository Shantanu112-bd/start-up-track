import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards, Headers } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ApiMockAuth } from "../common/decorators/api-auth-headers.decorator";
import {
  CurrentUser,
  type AuthenticatedPrincipal,
} from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { FailTransactionDto } from "./dto/fail-transaction.dto";
import { ListTransactionsDto } from "./dto/list-transactions.dto";
import { QuoteTransactionDto } from "./dto/quote-transaction.dto";
import { SimulateTransactionDto } from "./dto/simulate-transaction.dto";
import { TransactionsService } from "./transactions.service";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("Transactions")
@ApiMockAuth()
@UseGuards(JwtAuthGuard)
@Controller("transactions")
export class TransactionsController {
  constructor(
    @Inject(TransactionsService)
    private readonly transactionsService: TransactionsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Post("quote")
  @ApiOperation({ summary: "Return a mocked crypto-to-INR quote." })
  quote(@Body() dto: QuoteTransactionDto) {
    return this.transactionsService.quote(dto);
  }

  @Post()
  @ApiOperation({ summary: "Create a mocked UPI crypto payment." })
  async create(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Body() dto: CreateTransactionDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existing = await this.prisma.apiIdempotencyKey.findUnique({
        where: { scope_key: { scope: 'transaction.create', key: idempotencyKey } },
      })

      if (existing?.responseBody) {
        return existing.responseBody
      }
    }

    const result = await this.transactionsService.create(user, dto)

    if (idempotencyKey) {
      await this.prisma.apiIdempotencyKey.upsert({
        where: { scope_key: { scope: 'transaction.create', key: idempotencyKey } },
        create: {
          scope: 'transaction.create',
          key: idempotencyKey,
          requestHash: idempotencyKey,
          responseStatus: 201,
          responseBody: result as any,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          userId: user.id,
        },
        update: {},
      })
    }

    return result
  }

  @Get()
  @ApiOperation({ summary: "List visible transactions." })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListTransactionsDto) {
    return this.transactionsService.list(principal, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a transaction with events and settlement data." })
  findOne(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.transactionsService.findOne(principal, id);
  }



  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel a created transaction." })
  cancel(@CurrentUser() principal: AuthenticatedPrincipal, @Param("id") id: string) {
    return this.transactionsService.cancel(principal, id);
  }

  @Post(":id/fail")
  @ApiOperation({ summary: "Mark a transaction as failed in the mock flow." })
  fail(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param("id") id: string,
    @Body() dto: FailTransactionDto,
  ) {
    return this.transactionsService.fail(principal, id, dto);
  }
}
