// transactions.controller.ts
import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RequestWithUser } from '../types/RequestWithUser';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly txService: TransactionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async record(
    @Body() body: { nftId: string; price: number },
    @Req() req: RequestWithUser,
  ) {
    const buyerId = req.user.sub;
    const tx = await this.txService.recordTransaction(buyerId, body.nftId, body.price);
    return { message: 'Transaction recorded', tx };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserTransactions(@Req() req: RequestWithUser) {
    const userId = req.user.sub;
    const transactions = await this.txService.getTransactionsByUser(userId);
    return { transactions };
  }
}
