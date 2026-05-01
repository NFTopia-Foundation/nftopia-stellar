import DataLoader from 'dataloader';
import type { User } from '../../users/user.entity';
import type { Nft } from '../../modules/nft/entities/nft.entity';
import type { Collection } from '../../modules/collection/entities/collection.entity';
import type { Listing } from '../../modules/listing/entities/listing.entity';
import type { Auction } from '../../modules/auction/entities/auction.entity';
import type { Bid } from '../../modules/auction/entities/bid.entity';
import type { OrderInterface } from '../../modules/order/interfaces/order.interface';
import { UsersService } from '../../users/users.service';
import { NftService } from '../../modules/nft/nft.service';
import { CollectionService } from '../../modules/collection/collection.service';
import { ListingService } from '../../modules/listing/listing.service';
import { AuctionService } from '../../modules/auction/auction.service';
import { BidService } from '../../modules/bid/bid.service';
import { OrderService } from '../../modules/order/order.service';
import { createUserLoader } from './user.loader';
import { createNftLoader } from './nft.loader';
import { createCollectionLoader } from './collection.loader';
import { createListingLoader } from './listing.loader';
import { createAuctionLoader } from './auction.loader';
import { createBidLoader } from './bid.loader';
import { createOrderLoader } from './order.loader';

export type GraphqlLoaders = {
  userById: DataLoader<string, User | null>;
  nftById: DataLoader<string, Nft | null>;
  collectionById: DataLoader<string, Collection | null>;
  listingByNftId: DataLoader<string, Listing | null>;
  auctionByNftId: DataLoader<string, Auction | null>;
  bidsByAuctionId: DataLoader<string, Bid[]>;
  ordersByNftId: DataLoader<string, OrderInterface[]>;
};

type CreateGraphqlLoadersDependencies = {
  usersService: UsersService;
  nftService: NftService;
  collectionService: CollectionService;
  listingService: ListingService;
  auctionService: AuctionService;
  bidService: BidService;
  orderService: OrderService;
};

export function createGraphqlLoaders(
  dependencies: CreateGraphqlLoadersDependencies,
): GraphqlLoaders {
  return {
    userById: createUserLoader(dependencies.usersService),
    nftById: createNftLoader(dependencies.nftService),
    collectionById: createCollectionLoader(dependencies.collectionService),
    listingByNftId: createListingLoader(
      dependencies.listingService,
      dependencies.nftService,
    ),
    auctionByNftId: createAuctionLoader(
      dependencies.auctionService,
      dependencies.nftService,
    ),
    bidsByAuctionId: createBidLoader(dependencies.bidService),
    ordersByNftId: createOrderLoader(dependencies.orderService),
  };
}

export { createUserLoader } from './user.loader';
export { createNftLoader } from './nft.loader';
export { createCollectionLoader } from './collection.loader';
export { createListingLoader } from './listing.loader';
export { createAuctionLoader } from './auction.loader';
export { createBidLoader } from './bid.loader';
export { createOrderLoader } from './order.loader';
