"use client";

import { uploadToFirebase } from "@/lib/firebase/uploadtofirebase";
import { useState } from "react";

export default function Page() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    console.log("Submit triggered");

    if (!imageFile) {
      console.log("No image selected");
      return;
    }

    const ext = imageFile.name.split(".").pop();
    const filename = `${Date.now()}.${ext}`;
    console.log("Uploading file:", filename);

    try {
      const url = await uploadToFirebase(imageFile);
      console.log("File uploaded to:", url);
      setFileUrl(url || "");
      setImageFile(null);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  return (
    <div className="w-full h-screen flex items-center justify-center bg-nftopia-background">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-3 items-center bg-nftopia-card border border-nftopia-border rounded-lg text-nftopia-text p-4 shadow"
      >
        <h1 className="text-lg font-semibold text-nftopia-text">Upload your image</h1>
        <input
          type="file"
          id="imageFile"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              setImageFile(e.target.files[0]);
              setUploadProgress(0);
              setFileUrl("");
            }
          }}
          className="w-full p-2 rounded border border-nftopia-border bg-nftopia-background text-nftopia-text file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-nftopia-primary file:text-nftopia-text hover:file:bg-nftopia-hover"
        />

        <button
          type="submit"
          className="w-full p-2 rounded text-nftopia-text bg-nftopia-primary hover:bg-nftopia-hover transition-colors"
        >
          Upload Image
        </button>

        {uploadProgress > 0 && (
          <p className="text-sm text-nftopia-primary">Uploading: {uploadProgress}%</p>
        )}

        {fileUrl && (
          <div className="mt-3">
            <p className="text-sm text-green-400">Upload complete!</p>
            <img src={fileUrl} alt="Uploaded" className="w-32 h-auto rounded border border-nftopia-border" />
          </div>
        )}
      </form>
    </div>
  );
}
