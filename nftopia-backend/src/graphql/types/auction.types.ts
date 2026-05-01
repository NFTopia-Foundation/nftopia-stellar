import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { AuctionStatus as AuctionStatusValue } from '../../modules/auction/interfaces/auction.interface';

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
}
