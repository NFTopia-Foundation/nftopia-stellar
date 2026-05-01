import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { PageInfo } from './common.types';
import { GraphqlUserType } from './user.types';
import { GraphqlNft } from './nft.types';

export enum OrderType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
}
registerEnumType(OrderType, {
  name: 'OrderType',
  description: 'Type of order: SALE or PURCHASE',
});

export enum OrderStatus {
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}
registerEnumType(OrderStatus, {
  name: 'OrderStatus',
  description: 'Status of the order',
});

@ObjectType('Order')
export class GraphqlOrder {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  nftId: string;

  @Field(() => ID)
  buyerId: string;

  @Field(() => ID)
  sellerId: string;

  @Field(() => String)
  price: string;

  @Field(() => String)
  currency: string;

  @Field(() => OrderType)
  type: OrderType;

  @Field(() => OrderStatus)
  status: OrderStatus;

  @Field(() => String, { nullable: true })
  transactionHash?: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphqlUserType, { nullable: true })
  buyer?: GraphqlUserType | null;

  @Field(() => GraphqlUserType, { nullable: true })
  seller?: GraphqlUserType | null;

  @Field(() => GraphqlNft, { nullable: true })
  nft?: GraphqlNft | null;
}

@ObjectType()
export class OrderEdge {
  @Field(() => GraphqlOrder)
  node: GraphqlOrder;

  @Field()
  cursor: string;
}

@ObjectType()
export class OrderConnection {
  @Field(() => [OrderEdge])
  edges: OrderEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ObjectType()
export class SalesAnalytics {
  @Field(() => String)
  totalVolume: string;

  @Field(() => Int)
  totalSales: number;

  @Field(() => String)
  averagePrice: string;

  @Field(() => GraphQLISODateTime)
  periodStart: Date;

  @Field(() => GraphQLISODateTime)
  periodEnd: Date;
}
