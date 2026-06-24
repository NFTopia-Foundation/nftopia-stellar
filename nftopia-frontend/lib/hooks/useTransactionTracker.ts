'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getSorobanServer } from '@/lib/stellar/client';
import { useTransactionStore } from '@/lib/stores/transaction-store';
import type { StellarNetwork } from '@/types/stellar';

const POLL_INTERVAL_MS = 10_000;   // 10 seconds
const POLL_TIMEOUT_MS = 120_000;   // 2 minutes

/**
 * Polls Stellar RPC for the final status of a submitted transaction.
 * Call once per submitted transaction hash.
 */
export function useTransactionTracker() {
  const { updateStatus } = useTransactionStore();
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const stopPolling = useCallback((txHash: string) => {
    const interval = timersRef.current.get(txHash);
    if (interval !== undefined) {
      clearInterval(interval);
      timersRef.current.delete(txHash);
    }
  }, []);

  const trackTransaction = useCallback(
    (txHash: string, network: StellarNetwork) => {
      if (timersRef.current.has(txHash)) return; // already tracking

      updateStatus(txHash, 'processing');

      const server = getSorobanServer(network);
      const startedAt = Date.now();

      const poll = async () => {
        try {
          const result = await server.getTransaction(txHash);

          if (result.status === 'SUCCESS') {
            updateStatus(txHash, 'confirmed');
            stopPolling(txHash);
            return;
          }

          if (result.status === 'FAILED') {
            updateStatus(txHash, 'failed', 'Transaction failed on ledger.');
            stopPolling(txHash);
            return;
          }

          // Still NOT_FOUND or other — check timeout
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            updateStatus(
              txHash,
              'failed',
              'Transaction not confirmed after 2 minutes. It may still confirm later.'
            );
            stopPolling(txHash);
          }
        } catch (_err) {
          // Network error — keep polling until timeout
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            updateStatus(txHash, 'failed', 'Could not confirm transaction status.');
            stopPolling(txHash);
          }
        }
      };

      // Kick off immediately, then on interval
      poll();
      const interval = setInterval(poll, POLL_INTERVAL_MS);
      timersRef.current.set(txHash, interval);
    },
    [updateStatus, stopPolling]
  );

  // Clean up all intervals on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((interval) => clearInterval(interval));
      timersRef.current.clear();
    };
  }, []);

  return { trackTransaction };
}
