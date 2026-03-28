import { gql } from "@apollo/client";

export const USER_FIELDS_FRAGMENT = gql`
  fragment UserFields on User {
    id
    walletAddress
    username
    profileImage
    createdAt
    updatedAt
  }
`;

export const COLLECTION_FIELDS_FRAGMENT = gql`
  fragment CollectionFields on Collection {
    id
    name
    description
    imageUrl
    creatorId
    createdAt
    updatedAt
  }
`;

export const NFT_FIELDS_FRAGMENT = gql`
  fragment NftFields on NFT {
    id
    tokenId
    name
    description
    imageUrl
    ownerId
    collectionId
    createdAt
    updatedAt
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
    updatedAt
  }
`;

export const AUCTION_FIELDS_FRAGMENT = gql`
  fragment AuctionFields on Auction {
    id
    nftId
    sellerId
    reservePrice
    highestBid
    endTime
    status
    createdAt
    updatedAt
  }
`;
