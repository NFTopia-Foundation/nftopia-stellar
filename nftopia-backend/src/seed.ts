import 'dotenv/config';
import { DataSource, DataSourceOptions, In } from 'typeorm';
import { User } from './users/user.entity';
import { UserWallet } from './auth/entities/user-wallet.entity';
import { WalletSession } from './auth/entities/wallet-session.entity';
import { Collection } from './modules/collection/entities/collection.entity';
import { Nft } from './modules/nft/entities/nft.entity';
import { Transaction } from './modules/transaction/entities/transaction.entity';
import { Listing } from './modules/listing/entities/listing.entity';
import { Auction } from './modules/auction/entities/auction.entity';
import { Bid } from './modules/auction/entities/bid.entity';
import { NftMetadata } from './modules/nft/entities/nft-metadata.entity';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { TransactionState } from './modules/transaction/enums/transaction-state.enum';
import { AuctionStatus } from './modules/auction/interfaces/auction.interface';
import { BidSorobanStatus } from './modules/auction/entities/bid.entity';
import { createMigrationDataSourceOptions } from './database/typeorm.config';

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

const CREATOR_ID = 'c1234567-89ab-4def-8123-456789abcdef';
const BUYER_ID = 'b1234567-89ab-4def-8123-456789abcdef';

const COLLECTION_1_ID = 'd1234567-89ab-4def-8123-456789abcdef';
const COLLECTION_2_ID = 'e1234567-89ab-4def-8123-456789abcdef';
const COLLECTION_3_ID = 'f1234567-89ab-4def-8123-456789abcdef';

// Beautiful abstract high-contrast Unsplash image URLs
const IMAGES = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005198143-e528346d9a9c?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005198140-5e580e0c8b66?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1604871000636-074fa5117945?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1549490349-8643362247b5?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
];

async function bootstrap() {
  console.log('Connecting directly to database via TypeORM DataSource...');

  const dbUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5433/nftopia';

  const dataSourceOptions = {
    ...createMigrationDataSourceOptions(),
    url: dbUrl,
    entities: [
      User,
      UserWallet,
      WalletSession,
      Collection,
      Nft,
      NftMetadata,
      Transaction,
      Listing,
      Auction,
      Bid,
    ],
  } as DataSourceOptions;

  const dataSource = new DataSource(dataSourceOptions);

  await dataSource.initialize();
  console.log('Database connection initialized successfully!');

  const userRepo = dataSource.getRepository(User);
  const collectionRepo = dataSource.getRepository(Collection);
  const nftRepo = dataSource.getRepository(Nft);
  const txRepo = dataSource.getRepository(Transaction);
  const listingRepo = dataSource.getRepository(Listing);
  const auctionRepo = dataSource.getRepository(Auction);
  const bidRepo = dataSource.getRepository(Bid);

  console.log('Cleaning up existing demo data to ensure idempotency...');
  await bidRepo.delete({ bidderId: In([CREATOR_ID, BUYER_ID]) });
  await auctionRepo.delete({ sellerId: In([CREATOR_ID, BUYER_ID]) });
  await listingRepo.delete({ sellerId: In([CREATOR_ID, BUYER_ID]) });
  await txRepo.delete({ sellerId: In([CREATOR_ID, BUYER_ID]) });
  await txRepo.delete({ buyerId: In([CREATOR_ID, BUYER_ID]) });
  await nftRepo.delete({ creatorId: In([CREATOR_ID, BUYER_ID]) });
  await collectionRepo.delete({ creatorId: In([CREATOR_ID, BUYER_ID]) });
  await userRepo.delete({ id: In([CREATOR_ID, BUYER_ID]) });

  console.log('Seeding creator and buyer accounts...');
  const passHash = await hashPassword('Password123!');

  const creator = userRepo.create({
    id: CREATOR_ID,
    email: 'creator@nftopia.com',
    username: 'StellarCreator',
    passwordHash: passHash,
    isEmailVerified: true,
    address: 'GB5W6V4B7V3YF5XN7U6C6T6L7K8R8P9Q9W0X1Y2Z3A4B5C6D7E8F9G0',
    walletAddress: 'GB5W6V4B7V3YF5XN7U6C6T6L7K8R8P9Q9W0X1Y2Z3A4B5C6D7E8F9G0',
    walletPublicKey: 'GB5W6V4B7V3YF5XN7U6C6T6L7K8R8P9Q9W0X1Y2Z3A4B5C6D7E8F9G0',
    walletProvider: 'freighter',
    walletConnectedAt: new Date(),
    bio: 'Pioneering abstract NFT artist mapping stellar frequencies onto digital canvases.',
    avatarUrl: IMAGES[0],
    bannerUrl: IMAGES[1],
  });
  await userRepo.save(creator);

  const buyer = userRepo.create({
    id: BUYER_ID,
    email: 'buyer@nftopia.com',
    username: 'StellarBuyer',
    passwordHash: passHash,
    isEmailVerified: true,
    address: 'GABUYER4B7V3YF5XN7U6C6T6L7K8R8P9Q9W0X1Y2Z3A4B5C6D7E8F9G0',
    walletAddress: 'GABUYER4B7V3YF5XN7U6C6T6L7K8R8P9Q9W0X1Y2Z3A4B5C6D7E8F9G0',
    walletPublicKey: 'GABUYER4B7V3YF5XN7U6C6T6L7K8R8P9Q9W0X1Y2Z3A4B5C6D7E8F9G0',
    walletProvider: 'freighter',
    walletConnectedAt: new Date(),
    bio: 'Avid abstract NFT collector and digital art connoisseur.',
    avatarUrl: IMAGES[2],
    bannerUrl: IMAGES[3],
  });
  await userRepo.save(buyer);

  console.log('Seeding collections...');
  const collections = [
    collectionRepo.create({
      id: COLLECTION_1_ID,
      contractAddress:
        'CC111111111111111111111111111111111111111111111111111111',
      name: 'Cosmic Horizons',
      symbol: 'COSMIC',
      description:
        'Abstract artistic interpretation of stellar anomalies and intergalactic landscapes.',
      imageUrl: IMAGES[0],
      bannerImageUrl: IMAGES[1],
      creatorId: CREATOR_ID,
      totalSupply: 4,
      totalVolume: '25.5000000',
      floorPrice: '5.2000000',
      isVerified: true,
    }),
    collectionRepo.create({
      id: COLLECTION_2_ID,
      contractAddress:
        'CC222222222222222222222222222222222222222222222222222222',
      name: 'Cybernetic Oasis',
      symbol: 'CYBER',
      description:
        'Futuristic geometric mesh artwork reflecting cyberpunk architectures.',
      imageUrl: IMAGES[4],
      bannerImageUrl: IMAGES[5],
      creatorId: CREATOR_ID,
      totalSupply: 4,
      totalVolume: '18.9000000',
      floorPrice: '4.5000000',
      isVerified: true,
    }),
    collectionRepo.create({
      id: COLLECTION_3_ID,
      contractAddress:
        'CC333333333333333333333333333333333333333333333333333333',
      name: 'Abstract Waves',
      symbol: 'WAVES',
      description:
        'Dynamic fluid simulations transformed into bright aesthetic gradient digital pieces.',
      imageUrl: IMAGES[8],
      bannerImageUrl: IMAGES[9],
      creatorId: CREATOR_ID,
      totalSupply: 4,
      totalVolume: '32.1000000',
      floorPrice: '7.8000000',
      isVerified: false,
    }),
  ];
  await collectionRepo.save(collections);

  console.log('Seeding NFTs...');
  const nfts: Nft[] = [];
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Helper to generate varying dates
  const daysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  };

  // 12 NFTs, distributed 4 per collection
  for (let i = 0; i < 12; i++) {
    let colId = COLLECTION_1_ID;
    let colAddress = collections[0].contractAddress ?? '';
    let nftName = `Cosmic Horizon #${i + 1}`;
    if (i >= 4 && i < 8) {
      colId = COLLECTION_2_ID;
      colAddress = collections[1].contractAddress ?? '';
      nftName = `Cyber Oasis #${i - 3}`;
    } else if (i >= 8) {
      colId = COLLECTION_3_ID;
      colAddress = collections[2].contractAddress ?? '';
      nftName = `Abstract Wave #${i - 7}`;
    }

    const mintedDate = daysAgo(14 - i); // Varied timestamps over 2 weeks

    const nft = nftRepo.create({
      tokenId: `TOKEN-${1000 + i}`,
      contractAddress: colAddress,
      name: nftName,
      description: `Premium abstract illustrative masterpiece with a high-contrast premium palette. Created deterministically.`,
      imageUrl: IMAGES[i],
      ownerId: CREATOR_ID,
      creatorId: CREATOR_ID,
      collectionId: colId,
      mintedAt: mintedDate,
      createdAt: mintedDate,
      updatedAt: mintedDate,
      isBurned: false,
      lastPrice: '0.0000000',
    });

    nfts.push(nft);
  }
  await nftRepo.save(nfts);

  console.log(
    'Seeding marketplace events (Transactions, Listings, Auctions)...',
  );

  // Completed transactions
  const txs = [
    txRepo.create({
      contractTxId: '1000000000001',
      buyerId: BUYER_ID,
      sellerId: CREATOR_ID,
      nftId: nfts[0].id,
      nftContractId: collections[0].contractAddress ?? '',
      nftTokenId: nfts[0].tokenId,
      amount: '5.5000000',
      currency: 'STRK',
      state: TransactionState.COMPLETED,
      createdAt: daysAgo(10).getTime(),
      executedAt: daysAgo(10).getTime(),
      completedAt: daysAgo(10).getTime(),
    }),
    txRepo.create({
      contractTxId: '1000000000002',
      buyerId: BUYER_ID,
      sellerId: CREATOR_ID,
      nftId: nfts[4].id,
      nftContractId: collections[1].contractAddress ?? '',
      nftTokenId: nfts[4].tokenId,
      amount: '4.5000000',
      currency: 'STRK',
      state: TransactionState.COMPLETED,
      createdAt: daysAgo(6).getTime(),
      executedAt: daysAgo(6).getTime(),
      completedAt: daysAgo(6).getTime(),
    }),
    txRepo.create({
      contractTxId: '1000000000003',
      buyerId: BUYER_ID,
      sellerId: CREATOR_ID,
      nftId: nfts[8].id,
      nftContractId: collections[2].contractAddress ?? '',
      nftTokenId: nfts[8].tokenId,
      amount: '7.8000000',
      currency: 'STRK',
      state: TransactionState.COMPLETED,
      createdAt: daysAgo(2).getTime(),
      executedAt: daysAgo(2).getTime(),
      completedAt: daysAgo(2).getTime(),
    }),
  ];
  await txRepo.save(txs);

  // Update NFT ownership for the sold NFTs
  nfts[0].ownerId = BUYER_ID;
  nfts[0].lastPrice = '5.5000000';
  nfts[4].ownerId = BUYER_ID;
  nfts[4].lastPrice = '4.5000000';
  nfts[8].ownerId = BUYER_ID;
  nfts[8].lastPrice = '7.8000000';
  await nftRepo.save([nfts[0], nfts[4], nfts[8]]);

  // Seed Listings
  const listings = [
    listingRepo.create({
      nftContractId: collections[0].contractAddress ?? '',
      nftTokenId: nfts[1].tokenId,
      sellerId: CREATOR_ID,
      price: 6.2,
      currency: 'STRK',
      status: 'ACTIVE',
      expiresAt: daysAgo(-7),
      createdAt: daysAgo(4),
    }),
    listingRepo.create({
      nftContractId: collections[1].contractAddress ?? '',
      nftTokenId: nfts[5].tokenId,
      sellerId: CREATOR_ID,
      price: 5.0,
      currency: 'STRK',
      status: 'ACTIVE',
      expiresAt: daysAgo(-5),
      createdAt: daysAgo(3),
    }),
  ];
  await listingRepo.save(listings);

  // Seed Auctions & Bids
  const auction = auctionRepo.create({
    nftContractId: collections[2].contractAddress ?? '',
    nftTokenId: nfts[9].tokenId,
    sellerId: CREATOR_ID,
    startPrice: 8.0,
    currentPrice: 9.5,
    reservePrice: 10.0,
    startTime: daysAgo(3),
    endTime: daysAgo(-4),
    status: AuctionStatus.ACTIVE,
    createdAt: daysAgo(3),
  });
  await auctionRepo.save(auction);

  const bids = [
    bidRepo.create({
      auctionId: auction.id,
      bidderId: BUYER_ID,
      amount: 9.5,
      amountXlm: '9.5',
      txHash: 'hash_bid_1234567890abcdef',
      ledgerSequence: 100240,
      sorobanStatus: BidSorobanStatus.CONFIRMED,
      createdAt: daysAgo(1),
    }),
  ];
  await bidRepo.save(bids);

  console.log('Seeding completed successfully!');
  await dataSource.destroy();
}

bootstrap().catch((err) => {
  console.error('Error during database seeding execution:', err);
  process.exit(1);
});
