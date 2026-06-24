type ShareCreatorProfileInput = {
  url: string;
  title: string;
  text?: string;
  imageUrl?: string | null;
};

export type ShareResult =
  | { method: "native" }
  | { method: "clipboard" }
  | { method: "cancelled" };

async function fetchShareImageFile(imageUrl: string): Promise<File | null> {
  try {
    const response = await fetch(imageUrl, { mode: "cors" });
    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;

    const extension = blob.type.split("/")[1] || "png";
    return new File([blob], `creator-profile.${extension}`, { type: blob.type });
  } catch {
    return null;
  }
}

export async function shareCreatorProfile(
  input: ShareCreatorProfileInput,
): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      const shareData: ShareData = {
        title: input.title,
        text: input.text,
        url: input.url,
      };

      if (input.imageUrl && navigator.canShare) {
        const imageFile = await fetchShareImageFile(input.imageUrl);
        if (imageFile && navigator.canShare({ files: [imageFile] })) {
          await navigator.share({ ...shareData, files: [imageFile] });
          return { method: "native" };
        }
      }

      await navigator.share(shareData);
      return { method: "native" };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { method: "cancelled" };
      }
    }
  }

  await navigator.clipboard.writeText(input.url);
  return { method: "clipboard" };
}

export async function copyCreatorProfileUrl(url: string): Promise<void> {
  await navigator.clipboard.writeText(url);
}
