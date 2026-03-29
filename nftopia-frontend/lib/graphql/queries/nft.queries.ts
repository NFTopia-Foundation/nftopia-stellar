import { gql } from "@apollo/client";
import { NFT_FIELDS_FRAGMENT } from "../fragments";

export const GATEWAY_HEALTH_QUERY = gql`
  query GatewayHealth {
    __typename
  }
`;

export const GET_NFTS_QUERY = gql`
  query GetNfts($page: Int, $limit: Int, $collectionId: ID, $ownerId: ID) {
    nfts(
      page: $page
      limit: $limit
      collectionId: $collectionId
      ownerId: $ownerId
    ) {
      ...NftFields
    }
  }
  ${NFT_FIELDS_FRAGMENT}
`;

export const GET_NFT_BY_ID_QUERY = gql`
  query GetNftById($id: ID!) {
    nft(id: $id) {
      ...NftFields
    }
  }
  ${NFT_FIELDS_FRAGMENT}
`;
