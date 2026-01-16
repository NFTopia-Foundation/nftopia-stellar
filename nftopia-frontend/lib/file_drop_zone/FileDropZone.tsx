import React from 'react';
import { useFileDrop } from './useFileDrop';
import './FileDropZone.css'

import { FileDropZoneProps } from '../interfaces';



export const FileDropZone: React.FC<FileDropZoneProps> = ({
  accept = ['image/*'],
  multiple = true,
  maxSizeMB = 5,
  className,
  dropZoneText,
  dropZoneTextClass,
  onFilesSelected,
  uploadFn,
  showUploadButton = false,
}) => {
  const {
    files,
    isDragActive,
    isUploading,
    getRootProps,
    getInputProps,
    clearFiles,
    handleUpload,
  } = useFileDrop({
    accept,
    multiple,
    maxSizeMB,
    onFilesSelected,
    uploadFn,
  });

  return (
    <div className={`file-dropzone-container ${className}`}>
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="dropzone-content">
          {isDragActive ? (
            <p>Drop files here...</p>
          ) : (
            <p>Drag & drop files or click to select</p>
          )}
          <div className="file-requirements">
            <small>Accepted: {accept.join(', ')}</small>
            <small>Max size: {maxSizeMB}MB</small>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="file-preview-section">
          <h4>Selected Files ({files.length})</h4>
          <ul>
            {files.map((file) => (
              <li key={file.id}>
                {file.previewUrl ? (
                  <img src={file.previewUrl} alt={file.file.name} height={50} />
                ) : (
                  <span>{file.file.name}</span>
                )}
                <span>{(file.metadata.sizeMB).toFixed(2)} MB</span>
              </li>
            ))}
          </ul>

          <div className="file-actions">
            <button 
              type="button" 
              onClick={clearFiles}
              disabled={isUploading}
            >
              Clear All
            </button>

            {showUploadButton && uploadFn && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Upload Now'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
