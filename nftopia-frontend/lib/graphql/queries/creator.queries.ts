import { gql } from "@apollo/client";
import { NFT_FIELDS_FRAGMENT, COLLECTION_FIELDS_FRAGMENT } from "../fragments";

export const PUBLIC_CREATOR_FIELDS_FRAGMENT = gql`
  fragment PublicCreatorFields on PublicCreator {
    id
    username
    bio
    avatarUrl
    bannerUrl
    website
    twitterHandle
    instagramHandle
    isVerified
    followerCount
    followingCount
    totalNftsCreated
    totalSalesVolume
    createdAt
    isFollowing
  }
`;

export const GET_PUBLIC_CREATOR_QUERY = gql`
  query GetPublicCreator(
    $identifier: String!
    $nftFirst: Int = 12
    $nftAfter: String
    $nftSort: CreatorNftSort
    $collectionFirst: Int = 12
    $collectionAfter: String
    $activityFirst: Int = 10
    $activityAfter: String
  ) {
    publicCreator(identifier: $identifier) {
      ...PublicCreatorFields
      nfts(pagination: { first: $nftFirst, after: $nftAfter }, sortBy: $nftSort) {
        edges {
          node {
            ...NftFields
            lastPrice
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
      collections(pagination: { first: $collectionFirst, after: $collectionAfter }) {
        edges {
          node {
            ...CollectionFields
            floorPrice
            totalSupply
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
      activity(pagination: { first: $activityFirst, after: $activityAfter }) {
        edges {
          node {
            type
            occurredAt
            nftId
            price
            currency
          }
          cursor
        }
        totalCount
      }
    }
  }
  ${PUBLIC_CREATOR_FIELDS_FRAGMENT}
  ${NFT_FIELDS_FRAGMENT}
  ${COLLECTION_FIELDS_FRAGMENT}
`;

export const GET_PUBLIC_CREATOR_META_QUERY = gql`
  query GetPublicCreatorMeta($identifier: String!) {
    publicCreator(identifier: $identifier) {
      id
      username
      bio
      avatarUrl
      bannerUrl
    }
  }
`;

export const FOLLOW_CREATOR_MUTATION = gql`
  mutation FollowCreator($creatorId: ID!) {
    followCreator(creatorId: $creatorId) {
      success
      followerCount
      isFollowing
    }
  }
`;

export const UNFOLLOW_CREATOR_MUTATION = gql`
  mutation UnfollowCreator($creatorId: ID!) {
    unfollowCreator(creatorId: $creatorId) {
      success
      followerCount
      isFollowing
    }
  }
`;
