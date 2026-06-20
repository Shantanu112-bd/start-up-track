import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ApiMockAuth } from "../common/decorators/api-auth-headers.decorator";
import {
  CurrentUser,
  type AuthenticatedPrincipal,
} from "../common/decorators/current-user.decorator";
import { MockAuthGuard } from "../common/guards/mock-auth.guard";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { FailTransactionDto } from "./dto/fail-transaction.dto";
import { ListTransactionsDto } from "./dto/list-transactions.dto";
import { QuoteTransactionDto } from "./dto/quote-transaction.dto";
import { SimulateTransactionDto } from "./dto/simulate-transaction.dto";
import { TransactionsService } from "./transactions.service";

@ApiTags("Transactions")
@ApiMockAuth()
@UseGuards(MockAuthGuard)
@Controller("transactions")
export class TransactionsController {
  constructor(
    @Inject(TransactionsService)
    private readonly transactionsService: TransactionsService,
  ) {}

  @Post("quote")
  @ApiOperation({ summary: "Return a mocked crypto-to-INR quote." })
  quote(@Body() dto: QuoteTransactionDto) {
    return this.transactionsService.quote(dto);
  }

  @Post()
  @ApiOperation({ summary: "Create a mocked UPI crypto payment." })
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(principal, dto);
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
