import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getStorageConfig } from '../storage.config';
import type { ScanResult } from './scan.types';

export interface MalwareAlertPayload {
  assetId: string;
  fileHash: string;
  uploadedBy: string;
  originalFilename: string;
  scanResult: ScanResult;
}

@Injectable()
export class ScanAlertService {
  private readonly logger = new Logger(ScanAlertService.name);

  constructor(private readonly configService: ConfigService) {}

  /** Fire-and-forget webhook notification for a malware detection. Never throws. */
  async notifyMalwareDetected(payload: MalwareAlertPayload): Promise<void> {
    const { webhookUrl } = getStorageConfig(this.configService).scanning;

    if (!webhookUrl) {
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: 'storage.malware_detected',
          occurredAt: new Date().toISOString(),
          ...payload,
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `Malware webhook returned status ${response.status} for asset ${payload.assetId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to deliver malware webhook for asset ${payload.assetId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
