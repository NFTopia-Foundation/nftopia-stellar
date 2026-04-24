export interface NftAttribute {
    traitType: string;
    value: string;
    rarity?: number;
}

export interface Nft {
    id: string;
    tokenId: string;
    contractAddress: string;

    name: string;
    description?: string;

    imageUrl?: string;
    animationUrl?: string;
    externalUrl?: string;

    ownerId: string;
    creatorId: string;
    collectionId?: string;

    mintedAt: string;
    createdAt: string;
    updatedAt: string;

    lastPrice?: string;
    isBurned: boolean;

    attributes: NftAttribute[];
}
