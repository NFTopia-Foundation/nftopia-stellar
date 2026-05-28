import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { AuctionStatus as AuctionStatusValue } from '../../modules/auction/interfaces/auction.interface';
import { PageInfo } from './common.types';
import { GraphqlNft } from './nft.types';
import { GraphqlUserType } from './user.types';

export enum AuctionStatus {
  ACTIVE = AuctionStatusValue.ACTIVE,
  COMPLETED = AuctionStatusValue.COMPLETED,
  CANCELLED = AuctionStatusValue.CANCELLED,
  SETTLED = AuctionStatusValue.SETTLED,
}

registerEnumType(AuctionStatus, {
  name: 'AuctionStatus',
  description: 'Current state of an NFT auction',
});

@ObjectType('Bid')
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

  @Field(() => GraphqlAuction, { nullable: true })
  auction?: GraphqlAuction | null;

  @Field(() => GraphqlUserType, { nullable: true })
  bidder?: GraphqlUserType | null;
}

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

  @Field(() => String, { nullable: true })
  reservePrice?: string | null;

  @Field(() => GraphQLISODateTime)
  startTime: Date;

  @Field(() => GraphQLISODateTime)
  endTime: Date;

  @Field(() => AuctionStatus)
  status: AuctionStatus;

  @Field(() => ID, { nullable: true })
  winnerId?: string | null;

  @Field(() => [GraphqlBid], { nullable: true })
  bids?: GraphqlBid[];

  @Field(() => GraphqlNft, { nullable: true })
  nft?: GraphqlNft | null;

  @Field(() => GraphqlUserType, { nullable: true })
  seller?: GraphqlUserType | null;

  @Field(() => GraphqlBid, { nullable: true })
  highestBid?: GraphqlBid | null;

  @Field(() => GraphqlUserType, { nullable: true })
  winner?: GraphqlUserType | null;
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
