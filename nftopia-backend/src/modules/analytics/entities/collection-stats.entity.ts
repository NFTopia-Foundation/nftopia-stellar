import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('collection_stats')
@Unique('uq_collection_stats_collection_date', ['collectionId', 'date'])
@Index('idx_collection_stats_collection_id', ['collectionId'])
@Index('idx_collection_stats_date', ['date'])
export class CollectionStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'collection_id', type: 'varchar', length: 100 })
  collectionId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: '0' })
  volume: string;

  @Column({
    name: 'floor_price',
    type: 'decimal',
    precision: 20,
    scale: 7,
    nullable: true,
  })
  floorPrice: string | null;

  @Column({ name: 'sales_count', type: 'int', default: 0 })
  salesCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
