import { IsUUID, IsNumber, Min } from 'class-validator';

export class CreateBidDto {
  @IsUUID()
  auctionId: string;

  @IsNumber()
  @Min(0)
  amount: number;
}