import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
  IsPositive,
} from 'class-validator';

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

/**
 * Input type for creating a new auction
 * Used by the createAuction mutation
 */
@InputType()
export class CreateAuctionInput {
  @Field(() => ID)
  @IsUUID(4, { message: 'nftId must be a valid UUID' })
  @IsNotEmpty({ message: 'nftId is required' })
  nftId: string;

  @Field()
  @IsNotEmpty({ message: 'Start price is required' })
  @IsString({ message: 'Start price must be a string' })
  startPrice: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'Reserve price must be a string' })
  reservePrice?: string;

  @Field()
  @IsNotEmpty({ message: 'End time is required' })
  endTime: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;
}

/**
 * Input type for pagination of auctions
 * Used by the activeAuctions query
 */
@InputType()
export class AuctionPaginationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  first?: number = 20;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;
}

// Re-export for backward compatibility if needed
export { CreateBidInput as PlaceBidInput };
