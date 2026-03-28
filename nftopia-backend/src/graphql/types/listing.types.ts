import {
  Field,
  Float,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { ListingStatus } from '../../modules/listing/interfaces/listing.interface';
import { PageInfo } from './nft.types';

registerEnumType(ListingStatus, { name: 'ListingStatus' });

@ObjectType('Listing')
export class GraphqlListing {
  @Field(() => ID)
  id: string;

  @Field()
  nftContractId: string;

  @Field()
  nftTokenId: string;

  @Field(() => ID)
  sellerId: string;

  @Field(() => Float)
  price: number;

  @Field()
  currency: string;

  @Field(() => ListingStatus)
  status: ListingStatus;

  @Field(() => GraphQLISODateTime, { nullable: true })
  expiresAt?: Date;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
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
