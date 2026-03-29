import { gql } from "@apollo/client";
import { LISTING_FIELDS_FRAGMENT } from "../fragments";

export const GET_LISTINGS_QUERY = gql`
  query GetListings($page: Int, $limit: Int) {
    listings(page: $page, limit: $limit) {
      ...ListingFields
    }
  }
  ${LISTING_FIELDS_FRAGMENT}
`;

export const GET_LISTING_BY_ID_QUERY = gql`
  query GetListingById($id: ID!) {
    listing(id: $id) {
      ...ListingFields
    }
  }
  ${LISTING_FIELDS_FRAGMENT}
`;

export const CREATE_LISTING_MUTATION = gql`
  mutation CreateListing($input: CreateListingInput!) {
    createListing(input: $input) {
      ...ListingFields
    }
  }
  ${LISTING_FIELDS_FRAGMENT}
`;
