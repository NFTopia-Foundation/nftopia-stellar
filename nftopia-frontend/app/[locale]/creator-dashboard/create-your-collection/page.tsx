"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { API_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/stores";
import { uploadToFirebase } from "@/lib/firebase/uploadtofirebase";
import { getCookie } from "@/lib/CSRFTOKEN";
import { FileDropZone } from "@/lib";
import type { FileWithMeta } from "@/lib/interfaces";
import { useTranslation } from "@/hooks/useTranslation";

interface CreateCollectionForm {
  name: string;
  description: string;
  bannerImage: File | null;
}

interface FormErrors {
  name?: string;
  description?: string;
  bannerImage?: string;
  general?: string;
}

export default function CreateYourCollection() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [form, setForm] = useState<CreateCollectionForm>({
    name: "",
    description: "",
    bannerImage: null,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [success, setSuccess] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileWithMeta[]>([]);

  console.log(form);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.name.trim()) {
      newErrors.name = t("createCollection.errors.nameRequired");
    } else if (form.name.trim().length < 3) {
      newErrors.name = t("createCollection.errors.nameMinLength");
    } else if (form.name.trim().length > 50) {
      newErrors.name = t("createCollection.errors.nameMaxLength");
    }

    if (!form.description.trim()) {
      newErrors.description = t("createCollection.errors.descriptionRequired");
    } else if (form.description.trim().length < 10) {
      newErrors.description = t("createCollection.errors.descriptionMinLength");
    } else if (form.description.trim().length > 500) {
      newErrors.description = t("createCollection.errors.descriptionMaxLength");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    field: keyof CreateCollectionForm,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (isUploadingImage) {
      setErrors({ general: t("createCollection.errors.waitForUpload") });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const csrfToken = await getCookie();
      console.log(csrfToken);
      const res = await uploadToFirebase(selectedFiles[0].file)
        .then((firebaseUrl: string) => {
          return fetch(`${API_CONFIG.baseUrl}/collections/create`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({ ...form, bannerImage: firebaseUrl }),
          });
        })
        .finally(() => {
          setIsUploadingImage(true);
        });

      if (!res.ok) throw new Error(t("createCollection.errors.failedToCreate"));

      setSuccess(true);
      showSuccess(t("createCollection.success"));

      setForm({
        name: "",
        description: "",
        bannerImage: null,
      });
      setImagePreview(null);
      setUploadedImageUrl(null);
      setSelectedFiles([]);

      setTimeout(() => {
        router.push("/creator-dashboard/collections");
      }, 2000);
    } catch (error) {
      console.error("Error creating collection:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("createCollection.errors.failedToCreate");
      setErrors({ general: errorMessage });
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[100vh] bg-nftopia-background flex items-center justify-center ">
        <Card className="w-full max-w-md bg-nftopia-card border border-nftopia-border backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-nftopia-text mb-2">
              {t("createCollection.collectionCreated")}
            </h2>
            <p className="text-nftopia-subtext mb-4">
              {t("createCollection.collectionCreatedMessage")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100vh] mt-10 bg-nftopia-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-nftopia-text mb-4">
            {t("createCollection.title")}
          </h1>
          <p className="text-nftopia-subtext text-lg">
            {t("createCollection.subtitle")}
          </p>
        </div>

        {errors.general && (
          <Alert className="mb-6 border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-200">
              {errors.general}
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-nftopia-card border border-nftopia-border backdrop-blur-sm w-full rounded-lg">
          <CardHeader>
            <CardTitle className="text-nftopia-text text-2xl">
              {t("createCollection.collectionDetails")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Collection Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-nftopia-text font-medium">
                  {t("createCollection.collectionName")} *
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t("createCollection.collectionNamePlaceholder")}
                  value={form.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={cn(
                    "bg-nftopia-background border-nftopia-border text-nftopia-text placeholder-nftopia-subtext",
                    "focus:border-nftopia-primary focus:ring-nftopia-primary/20",
                    errors.name && "border-red-500/70 focus:border-red-400"
                  )}
                  maxLength={50}
                />
                {errors.name && (
                  <p className="text-red-300 text-sm">{errors.name}</p>
                )}
                <p className="text-nftopia-subtext text-xs">
                  {form.name.length}/50 {t("createCollection.characters")}
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-nftopia-text font-medium">
                  {t("createCollection.description")} *
                </Label>
                <Textarea
                  id="description"
                  placeholder={t("createCollection.descriptionPlaceholder")}
                  value={form.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  className={cn(
                    "bg-nftopia-background border-nftopia-border text-nftopia-text placeholder-nftopia-subtext",
                    "focus:border-nftopia-primary focus:ring-nftopia-primary/20 min-h-[120px]",
                    errors.description &&
                      "border-red-500/70 focus:border-red-400"
                  )}
                  maxLength={500}
                />
                {errors.description && (
                  <p className="text-red-300 text-sm">{errors.description}</p>
                )}
                <p className="text-nftopia-subtext text-xs">
                  {form.description.length}/500{" "}
                  {t("createCollection.characters")}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-nftopia-text font-medium mb-2">
                  {t("createCollection.uploadBannerImage")}
                </label>
                <FileDropZone
                  onFilesSelected={setSelectedFiles}
                  accept={["image/*"]}
                  maxSizeMB={10}
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={
                  !form.name && !form.description && selectedFiles.length === 0
                }
                className="w-full py-3 px-4 rounded-lg bg-nftopia-primary text-nftopia-text font-bold hover:bg-nftopia-hover transition duration-200 disabled:opacity-50"
              >
                {isLoading
                  ? t("createCollection.creating")
                  : t("createCollection.createCollection")}
              </button>
            </form>
          </CardContent>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-nftopia-subtext text-sm">
            {t("createCollection.needHelp")}{" "}
            <a
              href="#"
              className="text-nftopia-primary hover:text-nftopia-hover underline transition-colors"
            >
              {t("createCollection.collectionGuide")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
