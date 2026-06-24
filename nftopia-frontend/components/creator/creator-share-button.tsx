"use client";

import { useEffect, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { shareCreatorProfile } from "@/lib/utils/share-profile";
import { Button } from "@/components/ui/button";

type CreatorShareButtonProps = {
  profileUrl: string;
  title: string;
  text?: string;
  imageUrl?: string | null;
};

export function CreatorShareButton({
  profileUrl,
  title,
  text,
  imageUrl,
}: CreatorShareButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(profileUrl);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}${profileUrl}`);
    }
  }, [profileUrl]);

  const handleShare = async () => {
    const result = await shareCreatorProfile({
      url: shareUrl,
      title,
      text,
      imageUrl,
    });

    if (result.method === "clipboard") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleShare}
      className="border-gray-700 bg-transparent text-gray-200 hover:bg-gray-800/60"
      aria-label={t("common.share")}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-400" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      <span className="ml-2">{copied ? t("common.copied") : t("common.share")}</span>
    </Button>
  );
}
