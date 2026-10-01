// Classifies raw QR/barcode content scanned by `QRScannerScreen` so it can
// route to the right handler (Send screen vs. WalletConnect pairing vs. an
// error state) without inlining string-shape checks in the screen itself.
// Pure, no native dependencies — cheap to unit test.

import { isValidStellarAddress } from '@/stores/addressBookStore';
import { isWalletConnectUri } from '@/src/utils/walletConnectUri';

export type QrContentType = 'stellar-address' | 'wallet-connect-uri' | 'unknown';

export interface QrClassification {
  type: QrContentType;
  /** Present when `type === 'stellar-address'`. */
  address?: string;
  /** Present when `type === 'wallet-connect-uri'`. */
  uri?: string;
  /** The original scanned string, untrimmed. */
  raw: string;
}

export function classifyQrContent(raw: string): QrClassification {
  const trimmed = (raw ?? '').trim();

  if (isValidStellarAddress(trimmed)) {
    return { type: 'stellar-address', address: trimmed, raw };
  }

  if (isWalletConnectUri(trimmed)) {
    return { type: 'wallet-connect-uri', uri: trimmed, raw };
  }

  return { type: 'unknown', raw };
}
