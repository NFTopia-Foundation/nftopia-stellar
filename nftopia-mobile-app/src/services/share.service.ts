import { Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { analyticsService } from '@/src/analytics/analytics.service';
import { ANALYTICS_EVENTS } from '@/src/analytics/config';
import { errorLogger } from '@/src/errors/logger';
import { buildShareContent, ShareEntityType } from '@/src/utils/shareLink';

export type ShareStatus = 'shared' | 'cancelled' | 'copied' | 'failed';

export interface ShareResult {
  status: ShareStatus;
  url: string;
  /** Set only when `status === 'shared'` and the OS reports it (iOS only). */
  activityType?: string | null;
}

/**
 * Share an NFT, collection, or profile through the native OS share sheet.
 *
 * `expo-sharing`'s `shareAsync` only accepts local file URLs, so it can't
 * carry a text link — it's used here purely as an availability probe
 * (`isAvailableAsync`). The actual share goes through React Native's core
 * `Share.share`, which is what puts a title + link in front of the OS share
 * sheet on both platforms.
 *
 * Never throws: a share-sheet failure or unavailability falls back to
 * copying the link to the clipboard, and every outcome is reported through
 * `status` rather than a rejected promise, so callers never need a try/catch
 * around this to stay resilient.
 */
export async function shareEntity(
  type: ShareEntityType,
  id: string,
  name?: string,
): Promise<ShareResult> {
  const content = buildShareContent(type, id, name);

  analyticsService.track(ANALYTICS_EVENTS.SHARE_INITIATED, {
    entity_type: type,
    entity_id: id,
  });

  try {
    const canUseShareSheet = await Sharing.isAvailableAsync().catch(() => true);
    if (!canUseShareSheet) {
      return await copyToClipboard(type, id, content.url);
    }

    const result = await Share.share(
      { title: content.title, message: content.message },
      { dialogTitle: content.title },
    );

    if (result.action === Share.dismissedAction) {
      analyticsService.track(ANALYTICS_EVENTS.SHARE_CANCELLED, {
        entity_type: type,
        entity_id: id,
      });
      return { status: 'cancelled', url: content.url };
    }

    analyticsService.track(ANALYTICS_EVENTS.SHARE_COMPLETED, {
      entity_type: type,
      entity_id: id,
      method: 'share_sheet',
      activity_type: result.activityType ?? null,
    });
    return { status: 'shared', url: content.url, activityType: result.activityType };
  } catch (error) {
    errorLogger.log(error as Error, 'ShareService', undefined, {
      entity_type: type,
      entity_id: id,
    });
    analyticsService.track(ANALYTICS_EVENTS.SHARE_FAILED, {
      entity_type: type,
      entity_id: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return await copyToClipboard(type, id, content.url);
  }
}

async function copyToClipboard(
  type: ShareEntityType,
  id: string,
  url: string,
): Promise<ShareResult> {
  try {
    await Clipboard.setStringAsync(url);
    analyticsService.track(ANALYTICS_EVENTS.SHARE_COMPLETED, {
      entity_type: type,
      entity_id: id,
      method: 'clipboard',
    });
    return { status: 'copied', url };
  } catch (error) {
    errorLogger.log(error as Error, 'ShareService.copyToClipboard', undefined, {
      entity_type: type,
      entity_id: id,
    });
    analyticsService.track(ANALYTICS_EVENTS.SHARE_FAILED, {
      entity_type: type,
      entity_id: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: 'failed', url };
  }
}
