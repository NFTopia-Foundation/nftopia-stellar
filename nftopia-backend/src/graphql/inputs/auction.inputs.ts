import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Min, IsPositive } from 'class-validator';

/**
 * Input type for placing a bid on an auction
 * Used by the placeBid mutation
 */
@InputType()
export class CreateBidInput {
  /**
   * The ID of the auction to place a bid on
   */
  @Field(() => ID)
  @IsUUID(4, { message: 'auctionId must be a valid UUID' })
  auctionId: string;

  /**
   * The bid amount in XLM (minimum 0.0000001 XLM)
   */
  @Field(() => Float)
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 7 },
    { message: 'Amount must have at most 7 decimal places' },
  )
  @Min(0.0000001, { message: 'Minimum bid amount is 0.0000001 XLM' })
  @IsPositive({ message: 'Amount must be positive' })
  amount: number;
}
