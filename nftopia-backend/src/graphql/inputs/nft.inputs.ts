import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

@InputType()
export class NFTAttributeInput {
  @Field()
  @IsString()
  @Length(1, 100)
  traitType: string;

  @Field()
  @IsString()
  @Length(1, 255)
  value: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  displayType?: string;
}

@InputType()
export class PaginationInput {
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;
}

@InputType()
export class NFTFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeBurned?: boolean;
}

@InputType()
export class MintNFTInput {
  @Field()
  @IsString()
  @Length(1, 100)
  tokenId: string;

  @Field()
  @IsString()
  @Length(56, 56)
  contractAddress: string;

  @Field()
  @IsString()
  @Length(1, 255)
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  image?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  animationUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  externalUrl?: string;

  @Field(() => ID)
  @IsUUID()
  ownerId: string;

  @Field(() => ID)
  @IsUUID()
  creatorId: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(0)
  lastPrice?: number;

  @Field(() => [NFTAttributeInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NFTAttributeInput)
  attributes?: NFTAttributeInput[];
}

@InputType()
export class UpdateNFTMetadataInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  image?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  animationUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  externalUrl?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(0)
  lastPrice?: number;

  @Field(() => [NFTAttributeInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NFTAttributeInput)
  attributes?: NFTAttributeInput[];
}
