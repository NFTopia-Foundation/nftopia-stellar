export interface NFTMetadata {
    name: string;
    description: string;
    image: string; // You can rename imageUrl to just `image` (standard in most NFT specs)
    attributes?: Array<{
      trait_type: string;
      value: string | number | boolean;
    }>;
  }
  