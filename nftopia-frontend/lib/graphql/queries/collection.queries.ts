import { gql } from "@apollo/client";
import { COLLECTION_FIELDS_FRAGMENT } from "../fragments";

export const GET_COLLECTIONS_QUERY = gql`
  query GetCollections($pagination: PaginationInput, $filter: CollectionFilterInput) {
    collections(pagination: $pagination, filter: $filter) {
      edges {
        node {
          ...CollectionFields
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
  ${COLLECTION_FIELDS_FRAGMENT}
`;

export const GET_COLLECTION_BY_ID_QUERY = gql`
  query GetCollectionById($id: ID!) {
    collection(id: $id) {
      ...CollectionFields
      totalVolume
      floorPrice
      totalSupply
      creator {
        id
        username
        walletAddress
      }
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
    }
  }
  ${COLLECTION_FIELDS_FRAGMENT}
`;

export const GET_TOP_COLLECTIONS_QUERY = gql`
  query GetTopCollections($limit: Int) {
    topCollections(limit: $limit) {
      ...CollectionFields
      totalVolume
      floorPrice
      totalSupply
    }
  }
  ${COLLECTION_FIELDS_FRAGMENT}
`;

export const GET_COLLECTION_STATS_QUERY = gql`
  query GetCollectionStats($collectionId: ID!) {
    collectionStats(collectionId: $collectionId) {
      totalVolume
      floorPrice
      totalSupply
      ownerCount
    }
  }
`;