import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionService } from './transaction.service';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { ExecuteTransactionDto } from './dto/execute-transaction.dto';
import { CancelTransactionDto } from './dto/cancel-transaction.dto';
import { RecoverTransactionDto } from './dto/recover-transaction.dto';
import { SignTransactionDto } from './dto/sign-transaction.dto';
import { BatchCreateTransactionsDto } from './dto/batch-create-transactions.dto';
import { BatchExecuteTransactionsDto } from './dto/batch-execute-transactions.dto';
import type { Request as ExpressRequest } from 'express';

type AuthRequest = ExpressRequest & { user?: { userId?: string } };

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  async createAndExecute(
    @Body() dto: CreateTransactionDto,
    @Req() req: AuthRequest,
  ) {
    const buyerId = req.user?.userId as string;
    return this.transactionService.createAndExecutePurchase(buyerId, dto);
  }

  @Get()
  async getMine(@Req() req: AuthRequest, @Query() query: TransactionQueryDto) {
    const userId = req.user?.userId as string;
    return this.transactionService.getTransactionsForUser(userId, query);
  }

  @Post('batch')
  async batchCreate(
    @Body() dto: BatchCreateTransactionsDto,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.userId as string;
    return this.transactionService.batchCreate(userId, dto);
  }

  @Post('batch/execute')
  async batchExecute(
    @Body() dto: BatchExecuteTransactionsDto,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.userId as string;
    return this.transactionService.batchExecute(userId, dto);
  }

  @Get('nft/:nftId')
  async nftHistory(@Param('nftId') nftId: string) {
    return this.transactionService.getByNft(nftId);
  }

  @Get('user/:userId')
  async userHistory(@Param('userId') userId: string) {
    return this.transactionService.getByUser(userId);
  }

  @Get('status/:id')
  async quickStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.userId;
    return this.transactionService.getQuickStatus(id, userId);
  }

  @Get(':id')
  async getDetails(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.userId as string;
    return this.transactionService.findById(id, userId);
  }

  @Post(':id/execute')
  async execute(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExecuteTransactionDto,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.userId as string;
    return this.transactionService.execute(id, userId, dto);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelTransactionDto,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.userId as string;
    return this.transactionService.cancel(id, userId, dto);
  }

  @Post(':id/recover')
  async recover(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecoverTransactionDto,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.userId as string;
    return this.transactionService.recover(id, userId, dto);
  }

  @Get(':id/gas')
  async estimateGas(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.userId as string;
    return this.transactionService.estimateGas(id, userId);
  }

  @Post(':id/sign')
  async sign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SignTransactionDto,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.userId as string;
    return this.transactionService.addSignature(id, userId, dto.signature);
  }
}
