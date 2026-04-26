import Image from "next/image";
import { Nft } from "@/types/nft";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

interface Props {
    nft: Nft;
}

export const NftCard = ({ nft }: Props) => {
    const [imgError, setImgError] = useState(false);

    const price = nft.lastPrice
        ? `${parseFloat(nft.lastPrice).toFixed(7)} XLM`
        : "Not for sale";

    const mintedAgo = formatDistanceToNow(new Date(nft.mintedAt), {
        addSuffix: true,
    });

    return (
        <div className="group rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="relative aspect-square">
                <Image
                    src={
                        imgError
                            ? "/fallback.png"
                            : nft.imageUrl || "/fallback.png"
                    }
                    alt={nft.name}
                    fill
                    className="object-cover group-hover:scale-105 transition"
                    onError={() => setImgError(true)}
                />

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <button className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium">
                        View Details
                    </button>
                </div>

                {nft.collectionId && (
                    <span className="absolute top-2 left-2 bg-purple-600 text-xs px-2 py-1 rounded-md">
                        Collection
                    </span>
                )}

                {!nft.isBurned && (
                    <span className="absolute top-2 right-2 bg-green-600 text-xs px-2 py-1 rounded-md">
                        ✔ Minted
                    </span>
                )}
            </div>

            <div className="p-4 space-y-3">
                <h3 className="font-semibold text-white truncate">
                    {nft.name}
                </h3>

                <div className="text-xs text-gray-400">
                    <p>Creator: {truncate(nft.creatorId)}</p>
                    <p>Owner: {truncate(nft.ownerId)}</p>
                </div>

                <div className="flex flex-wrap gap-1">
                    {nft.attributes.slice(0, 4).map((attr, i) => (
                        <span
                            key={i}
                            className="text-[10px] bg-white/10 px-2 py-1 rounded"
                            title={`Rarity: ${attr.rarity ?? "N/A"}`}
                        >
                            {attr.traitType}: {attr.value}
                        </span>
                    ))}
                </div>

                <div className="flex justify-between items-center text-sm">
                    <span className="text-green-400 font-medium">{price}</span>
                    <span className="text-gray-500 text-xs">{mintedAgo}</span>
                </div>
            </div>
        </div>
    );
};

const truncate = (str: string) => str.slice(0, 6) + "..." + str.slice(-4);
