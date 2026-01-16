import React from 'react';

export interface FileWithMeta {
    file: File;
    id: string;
    previewUrl?: string;
    metadata: {
      sizeMB: number;
      type: string;
      lastModified: Date;
    };
  }
  
  export interface FileDropOptions {
    accept?: string[];
    multiple?: boolean;
    maxSizeMB?: number;
    onFilesSelected?: (files: FileWithMeta[]) => void;
    uploadFn?: (file: File) => Promise<void>;
  }
  
  export interface FileDropResult {
    files: FileWithMeta[];
    isDragActive: boolean;
    isUploading: boolean;
    getInputProps: () => React.InputHTMLAttributes<HTMLInputElement> & { 
      ref: React.RefObject<HTMLInputElement> 
    };
    getRootProps: () => React.HTMLAttributes<HTMLElement>;
    clearFiles: () => void;
    handleUpload: () => Promise<void>;
  }


  export interface FileDropZoneProps {
    accept?: string[];
    multiple?: boolean;
    maxSizeMB?: number;
    className?: string; // Add this line
    dropZoneText?: string;
    dropZoneTextClass?: string;
    onFilesSelected?: (files: FileWithMeta[]) => void;
    uploadFn?: (file: File) => Promise<void>;
    showUploadButton?: boolean;
    disabled?: boolean;
  }


  export interface CollectionForm {
    name: string;
    description: string;
    bannerImage: string;
  }
  
  
  export interface Collection {
    id: string;
    name: string;
    description: string;
    bannerImage: string;
    createdAt: string;
    creator: {
      id: string;
      username?: string;
      walletAddress: string;
    };
  }



  export interface NFTMetadata {
    name: string;
    description: string;
    imageUrl: string; 
    attributes?: Array<{
      trait_type: string;
      value: string | number | boolean;
    }>;
  }
  
  
  