import { BaseResolver } from './base.resolver';
import { CollectionResolver } from './collection.resolver';
import { NftResolver } from './nft.resolver';
import { ListingResolver } from './listing.resolver';
import { AuctionResolver } from './auction.resolver';
import { OrderResolver } from './order.resolver';
import { UserResolver } from './user.resolver';
import { JsonScalar } from '../types/nft.types';

export const graphqlResolvers = [
  BaseResolver,
  NftResolver,
  CollectionResolver,
  ListingResolver,
  AuctionResolver,
  OrderResolver,
  UserResolver,
] as const;

export const graphqlScalarClasses = [JsonScalar] as const;

export { BaseResolver };
export { CollectionResolver };
export { NftResolver };
export { ListingResolver };
export { AuctionResolver };
export { OrderResolver };
export { UserResolver };
export { JsonScalar };
