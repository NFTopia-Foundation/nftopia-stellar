import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import {
  EXIF_STRIPPABLE_MIME_TYPES,
  MIME_TYPES_WITHOUT_MAGIC_BYTES,
} from '../storage.constants';
import { sniffMimeType } from './magic-bytes';

@Injectable()
export class FileInspectorService {
  private readonly logger = new Logger(FileInspectorService.name);

  /**
   * Detects a file's real MIME type from its content instead of trusting the
   * client-supplied `mimetype`, which can be spoofed. Returns null when the
   * content doesn't match any recognizable/allowed signature.
   */
  detectMimeType(buffer: Buffer, claimedMimeType: string): string | null {
    if (MIME_TYPES_WITHOUT_MAGIC_BYTES.has(claimedMimeType)) {
      return this.detectTextBasedMimeType(buffer, claimedMimeType);
    }

    const detected = sniffMimeType(buffer);
    if (!detected) {
      return null;
    }

    // "image/jpg" is a common non-standard alias clients send for JPEG.
    if (detected === 'image/jpeg' && claimedMimeType === 'image/jpg') {
      return 'image/jpg';
    }

    return detected;
  }

  private detectTextBasedMimeType(
    buffer: Buffer,
    claimedMimeType: string,
  ): string | null {
    if (claimedMimeType === 'image/svg+xml') {
      const text = buffer.subarray(0, 1024).toString('utf8').trim();
      return text.startsWith('<?xml') || /<svg[\s>]/i.test(text)
        ? 'image/svg+xml'
        : null;
    }

    if (claimedMimeType === 'application/json') {
      try {
        JSON.parse(buffer.toString('utf8'));
        return 'application/json';
      } catch {
        return null;
      }
    }

    return null;
  }

  /** Strips embedded metadata/scripts that aren't needed to render the asset. */
  async sanitize(buffer: Buffer, mimeType: string): Promise<Buffer> {
    if (EXIF_STRIPPABLE_MIME_TYPES.has(mimeType)) {
      return this.stripExif(buffer);
    }

    if (mimeType === 'image/svg+xml') {
      return this.sanitizeSvg(buffer);
    }

    return buffer;
  }

  private async stripExif(buffer: Buffer): Promise<Buffer> {
    try {
      // sharp drops input metadata (EXIF/XMP/ICC) on re-encode unless
      // .withMetadata() is called, so this strips it by default.
      return await sharp(buffer).toBuffer();
    } catch (error) {
      this.logger.warn(
        `EXIF stripping failed, storing original file: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return buffer;
    }
  }

  private sanitizeSvg(buffer: Buffer): Buffer {
    const sanitized = buffer
      .toString('utf8')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');

    return Buffer.from(sanitized, 'utf8');
  }
}
