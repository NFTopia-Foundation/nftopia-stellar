import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Matches,
} from 'class-validator';

@InputType()
export class CollectionFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  verifiedOnly?: boolean;
}

@InputType()
export class CreateCollectionInput {
  @Field()
  @IsString()
  @Length(56, 56)
  @Matches(/^[A-Z2-7]{56}$/)
  contractAddress: string;

  @Field()
  @IsString()
  @Length(1, 255)
  name: string;

  @Field()
  @IsString()
  @Length(1, 50)
  symbol: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field()
  @IsUrl()
  @Length(1, 500)
  image: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  @Length(1, 500)
  bannerImage?: string;
}
