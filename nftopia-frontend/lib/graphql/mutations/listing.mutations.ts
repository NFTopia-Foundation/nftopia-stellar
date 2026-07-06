import { gql } from "@apollo/client";

export const BUY_NFT_MUTATION = gql`
  mutation BuyNFT($listingId: ID!) {
    buyNFT(listingId: $listingId) {
      success
      listingId
      buyerId
    }
  }
`;
