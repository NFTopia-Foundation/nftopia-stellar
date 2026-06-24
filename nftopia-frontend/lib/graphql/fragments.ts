import { gql } from "@apollo/client";

export const USER_FIELDS_FRAGMENT = gql`
  fragment UserFields on User {
    id
    walletAddress
    username
    avatar
  }
`;

export const COLLECTION_FIELDS_FRAGMENT = gql`
  fragment CollectionFields on Collection {
    id
    name
    description
    image
    creatorId
    createdAt
  }
`;

export const NFT_FIELDS_FRAGMENT = gql`
  fragment NftFields on NFT {
    id
    tokenId
    name
    description
    image
    ownerId
    collectionId
    mintedAt
  }
`;

export const LISTING_FIELDS_FRAGMENT = gql`
  fragment ListingFields on Listing {
    id
    nftId
    sellerId
    price
    currency
    status
    createdAt
    expiresAt
  }
`;

export const AUCTION_FIELDS_FRAGMENT = gql`
  fragment AuctionFields on Auction {
    id
    nftId
    sellerId
    startPrice
    currentPrice
    reservePrice
    startTime
    endTime
    status
    winnerId
  }
`;

export const TRANSFER_EVENT_FIELDS_FRAGMENT = gql`
  fragment TransferEventFields on TransferEvent {
    id
    fromAddress
    toAddress
    transactionHash
    eventType
    price
    currency
    timestamp
    fromAddressTruncated
    toAddressTruncated
    blockExplorerUrl
  }
`;