import { Nft } from "@/types/nft";

const randomId = () => Math.random().toString(36).slice(2);

export const generateMockNft = (overrides?: Partial<Nft>): Nft => {
    const now = new Date();

    return {
        id: `nft-${randomId()}`,
        tokenId: Math.floor(Math.random() * 1_000_000).toString(),
        contractAddress: "CDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",

        name: "Cosmic Ape",
        description: "A rare NFT from the cosmic collection",

        imageUrl: `https://picsum.photos/seed/${randomId()}/400/400`,
        animationUrl: undefined,
        externalUrl: "https://example.com",

        ownerId: `user-${Math.floor(Math.random() * 100)}`,
        creatorId: `user-${Math.floor(Math.random() * 100)}`,
        collectionId:
            Math.random() > 0.6
                ? `collection-${Math.floor(Math.random() * 10)}`
                : undefined,

        mintedAt: new Date(now.getTime() - Math.random() * 1e9).toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),

        lastPrice:
            Math.random() > 0.5 ? (Math.random() * 1000).toFixed(7) : undefined,

        isBurned: false,

        attributes: [
            { traitType: "Background", value: "Purple", rarity: 12 },
            { traitType: "Eyes", value: "Laser", rarity: 5 },
            { traitType: "Hat", value: "Crown", rarity: 2 },
            { traitType: "Aura", value: "Fire", rarity: 8 },
        ],

        ...overrides,
    };
};
