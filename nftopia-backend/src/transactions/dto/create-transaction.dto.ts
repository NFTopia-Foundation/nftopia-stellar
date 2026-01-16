// transaction/dto/create-transaction.dto.ts
import { IsUUID, IsNumber } from 'class-validator';

export class CreateTransactionDto {
  @IsUUID()
  auctionId: string;

  @IsUUID()
  buyerId: string;

  @IsUUID()
  sellerId: string;

  @IsUUID()
  nftId: string;

  @IsNumber()
  amount: number;
}

// transaction/dto/transaction-response.dto.ts
export class TransactionResponseDto {
    id: string;
    auctionId: string;
    nftId: string;
    buyerId: string;
    sellerId: string;
    amount: number;
    createdAt: string;
  }
  