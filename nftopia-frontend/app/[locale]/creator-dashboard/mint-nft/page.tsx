"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { FileDropZone } from "@/lib";
import { FileWithMeta } from "@/lib/interfaces";
import { uploadToFirebase } from "@/lib/firebase/uploadtofirebase";
import { getCookie } from "@/lib/CSRFTOKEN";
import { Collection } from "@/lib/interfaces";
import { API_CONFIG } from "@/lib/config";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useTranslation } from "@/hooks/useTranslation";

export default function MintNFTPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("STK");
  const [files, setFiles] = useState<FileWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  // Fetch user's collections when user is available
  useEffect(() => {
    if (user?.sub) {
      fetch(`${API_CONFIG.baseUrl}/collections/user/${user.sub}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data?.data?.collections?.length > 0) {
            setCollections(data.data.data.collections);
            setSelectedCollectionId(data.data.data.collections[0]?.id);
          }
        })
        .catch((err) => console.error("Error fetching collections:", err));
    }
  }, [user?.sub]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.sub) {
      setError(t("mintNFT.errors.userNotAuthenticated"));
      return;
    }
    if (files.length === 0) {
      setError(t("mintNFT.errors.uploadImage"));
      return;
    }
    if (!selectedCollectionId) {
      setError(t("mintNFT.errors.selectCollection"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const csrfToken = await getCookie();
      const firebaseUrl = await uploadToFirebase(files[0].file);

      const mintData = {
        imageUrl: firebaseUrl,
        price,
        currency,
        title,
        description,
        metadata: {
          name: title,
          description,
          image: firebaseUrl,
          attributes: [],
        },
      };

      const res = await fetch(
        `${API_CONFIG.baseUrl}/nfts/mint/${user.sub}/${selectedCollectionId}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify(mintData),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || t("mintNFT.errors.mintingFailed"));
      }

      router.push("/collections");
    } catch (err) {
      console.error("Mint error:", err);
      setError(
        err instanceof Error ? err.message : t("mintNFT.errors.errorMinting")
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-[100svh] mt-32 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-nftopia-card p-8 rounded-2xl shadow-lg w-full max-w-md border border-nftopia-border"
      >
        <h1 className="text-3xl font-bold text-center text-nftopia-text mb-6">
          {t("mintNFT.title")}
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 text-red-300 rounded-lg text-sm">
            {error}
          </div>
        )}

        {collections.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm text-nftopia-subtext mb-1">
              {t("mintNFT.collection")}
            </label>
            <select
              value={selectedCollectionId}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
              className="w-full px-4 py-2 rounded bg-nftopia-background text-nftopia-text border border-nftopia-border focus:outline-none focus:ring-2 focus:ring-nftopia-primary"
              required
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm text-nftopia-subtext mb-1">
            {t("mintNFT.title")}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 rounded bg-nftopia-background text-nftopia-text border border-nftopia-border focus:outline-none focus:ring-2 focus:ring-nftopia-primary"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-nftopia-subtext mb-1">
            {t("mintNFT.description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 rounded bg-nftopia-background text-nftopia-text border border-nftopia-border focus:outline-none focus:ring-2 focus:ring-nftopia-primary"
            required
            rows={4}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-nftopia-subtext mb-1">
              {t("mintNFT.price")}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-4 py-2 rounded bg-nftopia-background text-nftopia-text border border-nftopia-border focus:outline-none focus:ring-2 focus:ring-nftopia-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-nftopia-subtext mb-1">
              {t("mintNFT.currency")}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-2 rounded bg-nftopia-background text-nftopia-text border border-nftopia-border focus:outline-none focus:ring-2 focus:ring-nftopia-primary"
            >
              <option value="STK">STK</option>
              <option value="ETH">ETH</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-nftopia-subtext mb-2">
            {t("mintNFT.nftImage")}
          </label>
          <FileDropZone
            onFilesSelected={setFiles}
            accept={["image/*"]}
            maxSizeMB={10}
            className="border border-nftopia-border rounded-lg bg-nftopia-background hover:border-nftopia-primary transition-colors"
            dropZoneText={t("mintNFT.dragDropText")}
            dropZoneTextClass="text-nftopia-subtext"
          />
          {files.length > 0 && (
            <p className="mt-2 text-xs text-nftopia-primary">
              {t("mintNFT.selected")}: {files[0].file.name} (
              {(files[0].file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={
            loading ||
            !isAuthenticated ||
            files.length === 0 ||
            collections.length === 0
          }
          className="w-full flex items-center justify-center gap-2 bg-nftopia-primary text-nftopia-text py-2 px-4 rounded-lg hover:bg-nftopia-hover transition disabled:opacity-50"
        >
          <UploadCloud size={18} />
          {loading ? t("mintNFT.minting") : t("mintNFT.mintNFT")}
        </button>
      </form>
    </div>
  );
}
