import { Injectable, Logger } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
  registers: [registry],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'path', 'status_code'],
  registers: [registry],
});

const businessNftMintsTotal = new Counter({
  name: 'nft_mints_total',
  help: 'Total number of NFT mints',
  labelNames: ['collection_id'],
  registers: [registry],
});

const businessListingsCreatedTotal = new Counter({
  name: 'listings_created_total',
  help: 'Total number of listings created',
  labelNames: ['nft_id'],
  registers: [registry],
});

const businessSalesCompletedTotal = new Counter({
  name: 'sales_completed_total',
  help: 'Total number of sales completed',
  labelNames: ['seller_id'],
  registers: [registry],
});

const businessAuctionBidsTotal = new Counter({
  name: 'auction_bids_total',
  help: 'Total number of auction bids placed',
  labelNames: ['auction_id'],
  registers: [registry],
});

const businessTransactionsSettledTotal = new Counter({
  name: 'transactions_settled_total',
  help: 'Total number of transactions settled',
  labelNames: ['status'],
  registers: [registry],
});

const nftImageOptimizationBytes = new Histogram({
  name: 'nft_image_optimization_bytes',
  help: 'Original and optimized NFT image byte sizes',
  labelNames: ['format', 'stage'],
  buckets: [
    1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
    5_000_000, 10_000_000,
  ],
  registers: [registry],
});

const nftImageOptimizationFallbacksTotal = new Counter({
  name: 'nft_image_optimization_fallbacks_total',
  help: 'Total NFT image optimization requests that fell back to originals',
  labelNames: ['format'],
  registers: [registry],
});

@Injectable()
export class PrometheusService {
  private readonly logger = new Logger(PrometheusService.name);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  startRequestTimer(_method?: string, _route?: string): () => number {
    const start = Date.now();
    return () => (Date.now() - start) / 1000;
  }

  observeHttpRequestDuration(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    try {
      httpRequestDurationSeconds.observe(
        { method, path: route, status_code: String(statusCode) },
        durationSeconds,
      );
    } catch (error) {
      this.logger.warn(`Failed to observe request duration: ${error}`);
    }
  }

  incrementHttpRequestsTotal(
    method: string,
    route: string,
    statusCode: number,
  ): void {
    try {
      httpRequestsTotal.inc({
        method,
        path: route,
        status_code: String(statusCode),
      });
    } catch (error) {
      this.logger.warn(`Failed to increment http_requests_total: ${error}`);
    }
  }

  incrementHttpErrorsTotal(
    method: string,
    route: string,
    statusCode: number,
  ): void {
    try {
      httpErrorsTotal.inc({
        method,
        path: route,
        status_code: String(statusCode),
      });
    } catch (error) {
      this.logger.warn(`Failed to increment http_errors_total: ${error}`);
    }
  }

  incrementNftMint(collectionId?: string): void {
    try {
      businessNftMintsTotal.inc({ collection_id: collectionId ?? 'unknown' });
    } catch (error) {
      this.logger.warn(`Failed to increment nft_mints_total: ${error}`);
    }
  }

  incrementListingCreated(nftId: string): void {
    try {
      businessListingsCreatedTotal.inc({ nft_id: nftId });
    } catch (error) {
      this.logger.warn(`Failed to increment listings_created_total: ${error}`);
    }
  }

  incrementSaleCompleted(sellerId: string): void {
    try {
      businessSalesCompletedTotal.inc({ seller_id: sellerId });
    } catch (error) {
      this.logger.warn(`Failed to increment sales_completed_total: ${error}`);
    }
  }

  incrementAuctionBid(auctionId: string): void {
    try {
      businessAuctionBidsTotal.inc({ auction_id: auctionId });
    } catch (error) {
      this.logger.warn(`Failed to increment auction_bids_total: ${error}`);
    }
  }

  incrementTransactionSettled(status: string): void {
    try {
      businessTransactionsSettledTotal.inc({ status });
    } catch (error) {
      this.logger.warn(
        `Failed to increment transactions_settled_total: ${error}`,
      );
    }
  }

  observeNftImageOptimization(
    format: string,
    originalBytes: number,
    optimizedBytes: number,
  ): void {
    try {
      nftImageOptimizationBytes.observe(
        { format, stage: 'original' },
        originalBytes,
      );
      nftImageOptimizationBytes.observe(
        { format, stage: 'optimized' },
        optimizedBytes,
      );
    } catch (error) {
      this.logger.warn(`Failed to observe NFT image optimization: ${error}`);
    }
  }

  incrementNftImageOptimizationFallback(format: string): void {
    try {
      nftImageOptimizationFallbacksTotal.inc({ format });
    } catch (error) {
      this.logger.warn(
        `Failed to increment nft_image_optimization_fallbacks_total: ${error}`,
      );
    }
  }

  async getMetrics(): Promise<string> {
    return registry.metrics();
  }

  getRegistry(): Registry {
    return registry;
  }
}

export const prometheus = new PrometheusService();
