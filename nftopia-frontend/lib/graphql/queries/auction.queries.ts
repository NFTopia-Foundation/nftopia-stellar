import { gql } from "@apollo/client";
import { AUCTION_FIELDS_FRAGMENT } from "../fragments";

export const GET_AUCTIONS_QUERY = gql`
  query GetAuctions($page: Int, $limit: Int) {
    auctions(page: $page, limit: $limit) {
      ...AuctionFields
    }
  }
  ${AUCTION_FIELDS_FRAGMENT}
`;

export const GET_AUCTION_BY_ID_QUERY = gql`
  query GetAuctionById($id: ID!) {
    auction(id: $id) {
      ...AuctionFields
    }
  }
  ${AUCTION_FIELDS_FRAGMENT}
`;

export const PLACE_BID_MUTATION = gql`
  mutation PlaceBid($input: PlaceBidInput!) {
    placeBid(input: $input) {
      ...AuctionFields
    }
  }
  ${AUCTION_FIELDS_FRAGMENT}
`;
