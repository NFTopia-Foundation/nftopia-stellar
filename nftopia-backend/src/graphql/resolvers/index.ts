import { BaseResolver } from './base.resolver';
import { CollectionResolver } from './collection.resolver';
import { NftResolver } from './nft.resolver';
import { JsonScalar } from '../types/nft.types';

export const graphqlResolvers = [
  BaseResolver,
  NftResolver,
  CollectionResolver,
] as const;

export const graphqlScalarClasses = [JsonScalar] as const;

export { BaseResolver };
export { CollectionResolver };
export { NftResolver };
export { JsonScalar };
