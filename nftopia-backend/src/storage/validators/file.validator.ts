import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { ALLOWED_MIME_TYPES } from '../storage.constants';
import type { StorageConfig, UploadedFile } from '../storage.types';

export interface FileValidationResult {
  ipfsEligible: boolean;
}

export const validateFileForStorage = (
  file: UploadedFile,
  config: StorageConfig,
): FileValidationResult => {
  if (!file || !file.buffer || !file.mimetype || typeof file.size !== 'number') {
    throw new BadRequestException('Invalid upload payload');
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestException(`Unsupported MIME type: ${file.mimetype}`);
  }

  if (file.size > config.arweave.maxFileSizeBytes) {
    throw new PayloadTooLargeException(
      `File exceeds max allowed size of ${config.arweave.maxFileSizeBytes} bytes`,
    );
  }

  return {
    ipfsEligible: file.size <= config.ipfs.maxFileSizeBytes,
  };
};

export const computeFileHash = (fileBuffer: Buffer): string =>
  createHash('sha256').update(fileBuffer).digest('hex');
