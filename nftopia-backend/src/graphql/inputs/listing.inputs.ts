import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ListingStatus } from '../types/listing.types';

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
export class CreateListingInput {
  @Field(() => ID)
  @IsString()
  nftId: string;

  @Field(() => Float)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(0.0000001)
  price: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  currency?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
