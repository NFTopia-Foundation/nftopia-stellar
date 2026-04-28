import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { ListingStatus as ListingStatusValue } from '../../modules/listing/interfaces/listing.interface';
import { PageInfo } from './nft.types';

export enum ListingStatus {
  ACTIVE = ListingStatusValue.ACTIVE,
  SOLD = ListingStatusValue.SOLD,
  CANCELLED = ListingStatusValue.CANCELLED,
  EXPIRED = ListingStatusValue.EXPIRED,
}

registerEnumType(ListingStatus, {
  name: 'ListingStatus',
  description: 'Current state of a marketplace listing',
});

@ObjectType('Listing')
export class GraphqlListing {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  nftId: string;

  @Field(() => ID)
  sellerId: string;

  @Field(() => String)
  price: string;

  @Field(() => String)
  currency: string;

  @Field(() => ListingStatus)
  status: ListingStatus;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  expiresAt?: Date | null;
}

@ObjectType()
export class ListingEdge {
  @Field(() => GraphqlListing)
  node: GraphqlListing;

  @Field()
  cursor: string;
}

@ObjectType()
export class ListingConnection {
  @Field(() => [ListingEdge])
  edges: ListingEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ObjectType()
export class TransactionResult {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => ID)
  listingId: string;

  @Field(() => ID, { nullable: true })
  buyerId?: string;
}
