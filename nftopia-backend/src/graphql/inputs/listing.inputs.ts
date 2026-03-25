import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ListingStatus } from '../types/listing.types';

@InputType()
export class CreateListingInput {
  @Field(() => ID)
  @IsString()
  nftId: string;

  @Field(() => String)
  @IsNumberString()
  price: string;

  @Field(() => String, { defaultValue: 'XLM' })
  @IsString()
  currency: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

@InputType()
export class ListingFilterInput {
  @Field(() => ListingStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  nftId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  sellerId?: string;
}

@InputType()
export class PaginationInput {
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @Min(0)
  offset?: number;
}
