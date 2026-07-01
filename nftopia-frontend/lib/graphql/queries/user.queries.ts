import { gql } from "@apollo/client";
import { USER_FIELDS_FRAGMENT } from "../fragments";

export const GET_CURRENT_USER_QUERY = gql`
  query GetCurrentUser {
    me {
      ...UserFields
      nfts(pagination: { first: 20 }) {
        edges {
          node {
            id
            name
            image
            tokenId
            lastPrice
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
      ownedNFTs(pagination: { first: 20 }) {
        edges {
          node {
            id
            name
            image
            tokenId
            lastPrice
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
      listings(pagination: { first: 20 }) {
        edges {
          node {
            id
            nftId
            price
            currency
            status
            createdAt
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
      auctions(pagination: { first: 20 }) {
        edges {
          node {
            id
            nftId
            currentPrice
            status
            endTime
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
      purchases(pagination: { first: 20 }) {
        edges {
          node {
            id
            nftId
            price
            currency
            status
            createdAt
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
      sales(pagination: { first: 20 }) {
        edges {
          node {
            id
            nftId
            price
            currency
            status
            createdAt
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  }
  ${USER_FIELDS_FRAGMENT}
`;

export const GET_USER_BY_ID_QUERY = gql`
  query GetUserById($id: ID!) {
    user(id: $id) {
      ...UserFields
      nfts(pagination: { first: 20 }) {
        edges {
          node {
            id
            name
            image
            tokenId
            lastPrice
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
      ownedNFTs(pagination: { first: 20 }) {
        edges {
          node {
            id
            name
            image
            tokenId
            lastPrice
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
      listings(pagination: { first: 20 }) {
        edges {
          node {
            id
            nftId
            price
            currency
            status
            createdAt
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
      purchases(pagination: { first: 20 }) {
        edges {
          node {
            id
            nftId
            price
            currency
            status
            createdAt
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
      sales(pagination: { first: 20 }) {
        edges {
          node {
            id
            nftId
            price
            currency
            status
            createdAt
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  }
  ${USER_FIELDS_FRAGMENT}
`;

export const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats {
    dashboardStats {
      nftsCreated
      totalSales
      totalViews
      followers
    }
  }
`;
export const GET_USER_BY_ADDRESS_QUERY = gql`
  query GetUserByAddress($address: String!) {
    userByAddress(address: $address) {
      ...UserFields
      nfts(pagination: { first: 20 }) {
        edges {
          node {
            id
            name
            image
            tokenId
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  }
  ${USER_FIELDS_FRAGMENT}
`;
