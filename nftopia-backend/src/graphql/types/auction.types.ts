import {
  Field,
  Float,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { AuctionStatus } from '../../modules/auction/interfaces/auction.interface';
import { PageInfo } from './nft.types';

registerEnumType(AuctionStatus, { name: 'AuctionStatus' });

@ObjectType('Auction')
export class GraphqlAuction {
  @Field(() => ID)
  id: string;

  @Field()
  nftContractId: string;

  @Field()
  nftTokenId: string;

  @Field(() => ID)
  sellerId: string;

  @Field(() => Float)
  startPrice: number;

  @Field(() => Float)
  currentPrice: number;

  @Field(() => Float, { nullable: true })
  reservePrice?: number;

  @Field(() => GraphQLISODateTime)
  startTime: Date;

  @Field(() => GraphQLISODateTime)
  endTime: Date;

  @Field(() => AuctionStatus)
  status: AuctionStatus;

  @Field(() => ID, { nullable: true })
  winnerId?: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
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
