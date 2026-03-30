import { Field, Float, ID, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuctionStatus } from '../../modules/auction/interfaces/auction.interface';

@InputType()
export class AuctionFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  nftContractId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  nftTokenId?: string;

  @Field(() => AuctionStatus, { nullable: true })
  @IsOptional()
  @IsEnum(AuctionStatus)
  status?: AuctionStatus;
}

@InputType()
export class CreateAuctionInput {
  @Field()
  @IsString()
  nftContractId: string;

  @Field()
  @IsString()
  nftTokenId: string;

  @Field(() => Float)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(0.0000001)
  startPrice: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(0.0000001)
  reservePrice?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  startTime?: string;

  @Field()
  @IsString()
  endTime: string;
}

@InputType()
export class PlaceBidInput {
  @Field(() => Float)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(0.0000001)
  amount: number;
}
