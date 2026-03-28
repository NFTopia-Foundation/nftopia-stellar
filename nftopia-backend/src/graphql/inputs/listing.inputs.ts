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
import { ListingStatus } from '../../modules/listing/interfaces/listing.interface';

@InputType()
export class ListingFilterInput {
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

  @Field(() => ListingStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}

@InputType()
export class CreateListingInput {
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
  price: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  currency?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}
