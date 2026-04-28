import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionStats } from './entities/collection-stats.entity';
import { Order } from '../order/entities/order.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(CollectionStats)
    private readonly statsRepo: Repository<CollectionStats>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async aggregateStatsForDate(date: string): Promise<void> {
    // Find all completed sales for each collection on the given date
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .select('order.nftId', 'nftId')
      .addSelect('MIN(order.price)', 'floorPrice')
      .addSelect('SUM(order.price)', 'volume')
      .addSelect('COUNT(*)', 'salesCount')
      .addSelect('nft.collectionId', 'collectionId')
      .innerJoin('nft', 'nft', 'nft.id = order.nftId')
      .where('order.status = :status', { status: 'COMPLETED' })
      .andWhere('DATE(order.createdAt) = :date', { date })
      .groupBy('nft.collectionId');

    type StatsRow = {
      collectionId: string;
      volume: string;
      floorPrice: string;
      salesCount: number;
    };
    const results: StatsRow[] = await qb.getRawMany();

    for (const row of results) {
      await this.statsRepo.save({
        collectionId: row.collectionId,
        date,
        volume: row.volume,
        floorPrice: row.floorPrice,
        salesCount: row.salesCount,
      });
    }
  }

  async getStatsForCollection(
    collectionId: string,
    from?: string,
    to?: string,
  ) {
    const qb = this.statsRepo
      .createQueryBuilder('stats')
      .where('stats.collectionId = :collectionId', { collectionId });
    if (from) qb.andWhere('stats.date >= :from', { from });
    if (to) qb.andWhere('stats.date <= :to', { to });
    qb.orderBy('stats.date', 'ASC');
    return qb.getMany();
  }
}
