import { Field, ID, InputType } from '@nestjs/graphql';
import { OrderType, OrderStatus } from '../types/order.types';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

@InputType()
export class OrderFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  nftId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @Field(() => OrderType, { nullable: true })
  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  @Field(() => OrderStatus, { nullable: true })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

@InputType()
export class TimeframeInput {
  @Field(() => String)
  @IsString()
  periodStart: string;

  @Field(() => String)
  @IsString()
  periodEnd: string;
}
