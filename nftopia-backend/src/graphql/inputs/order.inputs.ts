import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  OrderStatus,
  OrderType,
} from '../../modules/order/dto/create-order.dto';

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
