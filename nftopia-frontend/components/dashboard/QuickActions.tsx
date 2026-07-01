"use client";

import React from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useLocalizedRoute } from "@/lib/routing";

interface QuickActionsProps {
  onCreateCollectionClick?: () => void;
}

export function QuickActions({ onCreateCollectionClick }: QuickActionsProps) {
  const { t } = useTranslation();
  const localizedRoute = useLocalizedRoute();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-xl p-6 backdrop-blur-md flex flex-col justify-between hover:border-border/80 transition-all duration-300">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-card-foreground">
              {t("creatorDashboard.mintNewNFT") || "Mint New NFT"}
            </h3>
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
              <Plus className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-6">
            {t("creatorDashboard.singleOrBatch") || "Upload dynamic illustrative artworks and mint immediately to collection."}
          </p>
        </div>
        <Link
          href={localizedRoute("/creator-dashboard/mint-nft")}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors mt-auto w-fit"
        >
          {t("creatorDashboard.goToMint") || "Go to Mint"}
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 backdrop-blur-md flex flex-col justify-between hover:border-border/80 transition-all duration-300">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-card-foreground">
              {t("creatorDashboard.createCollection") || "Create Collection"}
            </h3>
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-6">
            {t("creatorDashboard.collectionDescription") || "Configure smart contract properties and deployment options for collections."}
          </p>
        </div>
        <Link
          href={localizedRoute("/creator-dashboard/create-your-collection")}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors mt-auto w-fit"
          onClick={onCreateCollectionClick}
        >
          {t("createCollection.createCollection") || "Create Collection"}
        </Link>
      </div>
    </div>
  );
}
