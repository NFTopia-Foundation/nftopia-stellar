import type DataLoader from 'dataloader';
import type { DataSource } from 'typeorm';
import type { User } from '../../users/user.entity';
import type { Nft } from '../../modules/nft/entities/nft.entity';
import type { Collection } from '../../modules/collection/entities/collection.entity';
import type { Listing } from '../../modules/listing/entities/listing.entity';
import type { Auction } from '../../modules/auction/entities/auction.entity';
import type { Bid } from '../../modules/auction/entities/bid.entity';
import type { Order } from '../../modules/order/entities/order.entity';
import { createUserLoader } from './user.loader';
import { createNftLoader } from './nft.loader';
import { createCollectionLoader } from './collection.loader';
import { createListingByNftLoader } from './listing.loader';
import { createAuctionByNftLoader } from './auction.loader';
import { createBidByAuctionLoader } from './bid.loader';
import { createOrderByNftLoader } from './order.loader';

export interface DataLoaders {
  userLoader: DataLoader<string, User | null>;
  nftLoader: DataLoader<string, Nft | null>;
  collectionLoader: DataLoader<string, Collection | null>;
  listingByNftLoader: DataLoader<string, Listing[]>;
  auctionByNftLoader: DataLoader<string, Auction[]>;
  bidByAuctionLoader: DataLoader<string, Bid[]>;
  orderByNftLoader: DataLoader<string, Order[]>;
}

export function createLoaders(dataSource: DataSource): DataLoaders {
  return {
    userLoader: createUserLoader(dataSource),
    nftLoader: createNftLoader(dataSource),
    collectionLoader: createCollectionLoader(dataSource),
    listingByNftLoader: createListingByNftLoader(dataSource),
    auctionByNftLoader: createAuctionByNftLoader(dataSource),
    bidByAuctionLoader: createBidByAuctionLoader(dataSource),
    orderByNftLoader: createOrderByNftLoader(dataSource),
  };
}
