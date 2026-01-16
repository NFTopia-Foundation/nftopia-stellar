import React, { useState, useRef, useCallback } from 'react';

import { FileWithMeta, FileDropOptions, FileDropResult } from '../interfaces';

export const useFileDrop = (options: FileDropOptions = {}): FileDropResult => {
  const [files, setFiles] = useState<FileWithMeta[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    if (options.accept && !options.accept.some(type => 
      file.type.match(type.replace('*', '.*'))
    )) return false;
    
    if (options.maxSizeMB && (file.size / (1024 * 1024)) > options.maxSizeMB) {
      return false;
    }
    return true;
  };

  const processFile = (file: File): FileWithMeta => {
    const fileSizeMB = file.size / (1024 * 1024);
    return {
      file,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      metadata: {
        sizeMB: parseFloat(fileSizeMB.toFixed(2)),
        type: file.type,
        lastModified: new Date(file.lastModified)
      }
    };
  };

  const handleFiles = useCallback((newFiles: File[]) => {
    const validFiles = newFiles.filter(validateFile);
    const processedFiles = validFiles.map(processFile);
    
    setFiles(prev => [...prev, ...processedFiles]);
    options.onFilesSelected?.(processedFiles);
  }, [options.onFilesSelected]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }, [handleFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files));
  }, [handleFiles]);

  const handleDrag = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleUpload = useCallback(async () => {
    if (!options.uploadFn || files.length === 0) return;
    
    setIsUploading(true);
    try {
      await Promise.all(files.map(f => options.uploadFn?.(f.file)));
    } finally {
      setIsUploading(false);
    }
  }, [files, options.uploadFn]);

  const clearFiles = useCallback(() => {
    files.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
  }, [files]);

  return {
    files,
    isDragActive,
    isUploading,
    getRootProps: () => ({
      onDragEnter: handleDrag,
      onDragLeave: handleDrag,
      onDragOver: handleDrag,
      onDrop: handleDrop,
      onClick: () => inputRef.current?.click(),
    }),
    getInputProps: () => ({
      type: 'file',
      ref: inputRef,
      style: { display: 'none' },
      onChange: handleChange,
      accept: options.accept?.join(','),
      multiple: options.multiple,
    }),
    clearFiles,
    handleUpload,
  };
};
