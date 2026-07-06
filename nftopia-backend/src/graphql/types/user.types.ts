import { Field, ID, ObjectType, Int } from '@nestjs/graphql';
import { NFTConnection } from './nft.types';
import { ListingConnection } from './listing.types';
import { AuctionConnection } from './auction.types';
import { OrderConnection } from './order.types';

@ObjectType('User')
export class GraphqlUserType {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  username?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  walletAddress?: string | null;

  @Field(() => String, { nullable: true })
  stellarAddress?: string | null;

  @Field(() => String, { nullable: true })
  avatar?: string | null;

  @Field(() => NFTConnection, { nullable: true })
  nfts?: NFTConnection;

  @Field(() => NFTConnection, { nullable: true })
  ownedNFTs?: NFTConnection;

  @Field(() => ListingConnection, { nullable: true })
  listings?: ListingConnection;

  @Field(() => AuctionConnection, { nullable: true })
  auctions?: AuctionConnection;

  @Field(() => OrderConnection, { nullable: true })
  purchases?: OrderConnection;

  @Field(() => OrderConnection, { nullable: true })
  sales?: OrderConnection;
}

@ObjectType('DashboardStats')
export class DashboardStats {
  @Field(() => Int)
  nftsCreated: number;

  @Field(() => Int)
  totalSales: number;

  @Field(() => Int)
  totalViews: number;

  @Field(() => Int)
  followers: number;
}
