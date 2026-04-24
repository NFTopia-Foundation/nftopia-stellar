import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { AuctionStatus as AuctionStatusValue } from '../../modules/auction/interfaces/auction.interface';
import { PageInfo } from './nft.types';
import { TransactionResult } from './listing.types';

export enum AuctionStatus {
  ACTIVE = AuctionStatusValue.ACTIVE,
  COMPLETED = AuctionStatusValue.COMPLETED,
  CANCELLED = AuctionStatusValue.CANCELLED,
  SETTLED = AuctionStatusValue.SETTLED,
}

registerEnumType(AuctionStatus, {
  name: 'AuctionStatus',
  description: 'Current state of an auction',
});

@ObjectType('Auction')
export class GraphqlAuction {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  nftId: string;

  @Field(() => ID)
  sellerId: string;

  @Field(() => String)
  startPrice: string;

  @Field(() => String)
  currentPrice: string;

  @Field(() => GraphQLISODateTime)
  startTime: Date;

  @Field(() => GraphQLISODateTime)
  endTime: Date;

  @Field(() => AuctionStatus)
  status: AuctionStatus;

  @Field(() => String, { nullable: true })
  reservePrice?: string | null;

  @Field(() => ID, { nullable: true })
  winnerId?: string | null;
}

@ObjectType()
export class GraphqlBid {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  auctionId: string;

  @Field(() => ID)
  bidderId: string;

  @Field(() => String)
  amount: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;
}

@ObjectType()
export class AuctionEdge {
  @Field(() => GraphqlAuction)
  node: GraphqlAuction;

  @Field()
  cursor: string;
}

@ObjectType()
export class AuctionConnection {
  @Field(() => [AuctionEdge])
  edges: AuctionEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

export { TransactionResult };
