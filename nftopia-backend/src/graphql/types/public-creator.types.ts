import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { NFTConnection } from './nft.types';
import { ListingConnection } from './listing.types';
import { OrderConnection } from './order.types';
import { CollectionConnection } from './collection.types';

export enum CreatorNftSort {
  NEWEST = 'NEWEST',
  PRICE = 'PRICE',
}

registerEnumType(CreatorNftSort, { name: 'CreatorNftSort' });

export enum CreatorActivityKind {
  MINT = 'MINT',
  SALE = 'SALE',
  LISTING = 'LISTING',
}

registerEnumType(CreatorActivityKind, { name: 'CreatorActivityType' });

@ObjectType('CreatorActivityItem')
export class CreatorActivityItem {
  @Field(() => CreatorActivityKind)
  type: CreatorActivityKind;

  @Field(() => Date)
  occurredAt: Date;

  @Field(() => ID, { nullable: true })
  nftId?: string | null;

  @Field(() => String, { nullable: true })
  price?: string | null;

  @Field(() => String, { nullable: true })
  currency?: string | null;
}

@ObjectType('CreatorActivityEdge')
export class CreatorActivityEdge {
  @Field(() => CreatorActivityItem)
  node: CreatorActivityItem;

  @Field(() => String)
  cursor: string;
}

@ObjectType('CreatorActivityConnection')
export class CreatorActivityConnection {
  @Field(() => [CreatorActivityEdge])
  edges: CreatorActivityEdge[];

  @Field(() => Int)
  totalCount: number;
}

@ObjectType('PublicCreator')
export class PublicCreatorType {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  username?: string | null;

  @Field(() => String, { nullable: true })
  bio?: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;

  @Field(() => String, { nullable: true })
  bannerUrl?: string | null;

  @Field(() => String, { nullable: true })
  website?: string | null;

  @Field(() => String, { nullable: true })
  twitterHandle?: string | null;

  @Field(() => String, { nullable: true })
  instagramHandle?: string | null;

  @Field(() => Boolean)
  isVerified: boolean;

  @Field(() => Int)
  followerCount: number;

  @Field(() => Int)
  followingCount: number;

  @Field(() => Int)
  totalNftsCreated: number;

  @Field(() => String)
  totalSalesVolume: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Boolean, { nullable: true })
  isFollowing?: boolean | null;

  @Field(() => NFTConnection, { nullable: true })
  nfts?: NFTConnection;

  @Field(() => CollectionConnection, { nullable: true })
  collections?: CollectionConnection;

  @Field(() => CreatorActivityConnection, { nullable: true })
  activity?: CreatorActivityConnection;

  @Field(() => ListingConnection, { nullable: true })
  listings?: ListingConnection;

  @Field(() => OrderConnection, { nullable: true })
  sales?: OrderConnection;
}

@ObjectType('FollowResult')
export class FollowResultType {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => Int)
  followerCount: number;

  @Field(() => Boolean)
  isFollowing: boolean;
}
