import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

@InputType()
export class CreateAuctionInput {
  @Field(() => ID)
  @IsString()
  nftId: string;

  @Field(() => String)
  @IsNumberString()
  startPrice: string;

  @Field(() => String)
  @IsDateString()
  endTime: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsNumberString()
  reservePrice?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  startTime?: string;
}

@InputType()
export class PlaceBidInput {
  @Field(() => String)
  @IsNumberString()
  amount: string;
}
