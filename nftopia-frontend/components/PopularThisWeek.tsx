import Image from "next/image";
import { Button } from "@/components/ui/button";

export interface NFTItem {
  id: string;
  image: string;
  name: string;
  price: string;
  desc: string;
}

export default function NFTCard({ id, image, name, price, desc }: NFTItem) {
  return (
    <div className="relative w-full max-w-[600px] h-auto min-h-[200px] rounded-xl overflow-hidden group">
      {/* Futuristic glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#00c6fb] to-[#005bea] opacity-20 group-hover:opacity-30 transition-all duration-300" />

      {/* Card content */}
      <div className="relative flex flex-col h-full bg-gradient-to-b from-[#0d0f1a] via-[#1a1d33] to-[#0d0f1a] backdrop-blur-sm rounded-xl z-10 border border-[#ffffff10]">
        {/* NFT Image with futuristic frame */}
        <div className="relative w-[290px] h-[240px] p-2">
          <div className="absolute inset-0 rounded-t-xl bg-[#ffffff05] border-b border-[#00c6fb30]" />
          <Image
            src={image}
            fill
            className="object-cover rounded-t-xl"
            alt={name}
          />
        </div>

        {/* NFT Details */}
        <div className="flex-1 p-5 flex flex-col">
          <div className="mb-3">
            <h3 className="text-xl font-medium text-[#e2e3ff] text-[clamp(1rem,2vw,1.25rem)]">
              {name}
            </h3>
            <p className="text-sm text-[#8a8cff] text-[clamp(0.9rem,2vw,1.05rem)]">
              By {desc}
            </p>
          </div>

          {/* Price and Bid Button */}
          <div className="mt-auto flex items-center justify-between">
            <Button className="bg-[#000a2e] text-[#00c6fb] rounded-full border border-[#00c6fb50] px-4 py-1 text-sm font-mono min-h-[48px] min-w-[48px] text-[clamp(0.9rem,2vw,1.05rem)]">
              {price}
            </Button>
            <Button className="bg-[#005bea] hover:bg-[#0078ff] text-white rounded-full border border-[#00c6fb] hover:border-[#00e1ff] transition-all min-h-[48px] min-w-[48px] text-[clamp(1rem,2vw,1.1rem)]">
              Bid
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
