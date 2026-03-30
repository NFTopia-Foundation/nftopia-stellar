import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  OrderStatus,
  OrderType,
} from '../../modules/order/dto/create-order.dto';
import { PageInfo } from './nft.types';

registerEnumType(OrderType, { name: 'OrderType' });
registerEnumType(OrderStatus, { name: 'OrderStatus' });

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

  @Field()
  price: string;

  @Field()
  currency: string;

  @Field(() => OrderType)
  type: OrderType;

  @Field(() => OrderStatus)
  status: OrderStatus;

  @Field(() => String, { nullable: true })
  transactionHash?: string;

  @Field(() => ID, { nullable: true })
  listingId?: string;

  @Field(() => ID, { nullable: true })
  auctionId?: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;
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
export class GraphqlOrderStats {
  @Field()
  volume: string;

  @Field(() => Int)
  count: number;

  @Field()
  averagePrice: string;
}
