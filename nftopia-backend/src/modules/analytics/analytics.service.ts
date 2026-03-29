import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CollectionStats } from './entities/collection-stats.entity.js';
import { Order } from '../order/entities/order.entity.js';
import { Nft } from '../nft/entities/nft.entity.js';
import { Listing } from '../listing/entities/listing.entity.js';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(CollectionStats)
    private readonly statsRepo: Repository<CollectionStats>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Nft)
    private readonly nftRepo: Repository<Nft>,
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async aggregateDailyStats(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(`${dateStr}T23:59:59.999Z`);

    this.logger.log(`Aggregating collection stats for ${dateStr}`);

    const rows = (await this.orderRepo
      .createQueryBuilder('order')
      .innerJoin(Nft, 'nft', 'nft.id = order.nftId')
      .select('nft.collectionId', 'collectionId')
      .addSelect('SUM(CAST(order.price AS DECIMAL))', 'volume')
      .addSelect('COUNT(order.id)', 'salesCount')
      .where('order.status = :status', { status: 'COMPLETED' })
      .andWhere('order.type = :type', { type: 'SALE' })
      .andWhere('order.createdAt >= :start', { start })
      .andWhere('order.createdAt <= :end', { end })
      .andWhere('nft.collectionId IS NOT NULL')
      .groupBy('nft.collectionId')
      .getRawMany()) as { collectionId: string; volume: string; salesCount: string }[];

    for (const row of rows) {
      const floorPrice = await this.getFloorPrice(row.collectionId);

      await this.statsRepo
        .createQueryBuilder()
        .insert()
        .into(CollectionStats)
        .values({
          collectionId: row.collectionId,
          date: dateStr,
          volume: row.volume ?? '0',
          floorPrice,
          salesCount: parseInt(row.salesCount, 10),
        })
        .orUpdate(['volume', 'floor_price', 'sales_count'], [
          'collection_id',
          'date',
        ])
        .execute();
    }

    this.logger.log(`Done. Aggregated ${rows.length} collection(s) for ${dateStr}`);
  }

  async getCollectionStats(
    collectionId: string,
    from?: string,
    to?: string,
  ): Promise<{
    stats: CollectionStats[];
    charts: { volume: [number, string][]; floorPrice: [number, string | null][] };
  }> {
    const qb = this.statsRepo
      .createQueryBuilder('stats')
      .where('stats.collectionId = :collectionId', { collectionId })
      .orderBy('stats.date', 'ASC');

    if (from) qb.andWhere('stats.date >= :from', { from });
    if (to) qb.andWhere('stats.date <= :to', { to });

    const stats = await qb.getMany();

    const charts = {
      volume: stats.map((s) => [new Date(s.date).getTime(), s.volume] as [number, string]),
      floorPrice: stats.map((s) => [new Date(s.date).getTime(), s.floorPrice] as [number, string | null]),
    };

    return { stats, charts };
  }

  private async getFloorPrice(collectionId: string): Promise<string | null> {
    const result = (await this.listingRepo
      .createQueryBuilder('listing')
      .innerJoin(Nft, 'nft', 'nft.tokenId = listing.nftTokenId AND nft.contractAddress = listing.nftContractId')
      .select('MIN(CAST(listing.price AS DECIMAL))', 'floorPrice')
      .where('listing.status = :status', { status: 'ACTIVE' })
      .andWhere('nft.collectionId = :collectionId', { collectionId })
      .getRawOne()) as { floorPrice: string | null };

    return result?.floorPrice ?? null;
  }
}
