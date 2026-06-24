import { gql } from "@apollo/client";
import { LISTING_FIELDS_FRAGMENT } from "../fragments";

export const GET_LISTINGS_QUERY = gql`
  query GetListings($pagination: PaginationInput, $filter: ListingFilterInput) {
    listings(pagination: $pagination, filter: $filter) {
      edges {
        node {
          ...ListingFields
          nft {
            id
            name
            image
            tokenId
          }
          seller {
            id
            username
            walletAddress
          }
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
  ${LISTING_FIELDS_FRAGMENT}
`;

export const GET_LISTING_BY_ID_QUERY = gql`
  query GetListingById($id: ID!) {
    listing(id: $id) {
      ...ListingFields
      nft {
        id
        name
        description
        image
        tokenId
        ownerId
        creatorId
        lastPrice
      }
      seller {
        id
        username
        walletAddress
      }
    }
  }
  ${LISTING_FIELDS_FRAGMENT}
`;

export const CREATE_LISTING_MUTATION = gql`
  mutation CreateListing($input: CreateListingInput!) {
    createListing(input: $input) {
      ...ListingFields
      nft {
        id
        name
        image
      }
    }
  }
  ${LISTING_FIELDS_FRAGMENT}
`;

export const CANCEL_LISTING_MUTATION = gql`
  mutation CancelListing($id: ID!) {
    cancelListing(id: $id)
  }
`;

export const BUY_NFT_MUTATION = gql`
  mutation BuyNFT($listingId: ID!) {
    buyNFT(listingId: $listingId) {
      success
      listingId
      buyerId
    }
  }
`;