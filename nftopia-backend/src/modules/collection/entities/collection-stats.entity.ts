import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Collection } from './collection.entity';

@Entity('collection_stats')
@Index(['collectionId', 'date'], { unique: true })
export class CollectionStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  collectionId: string;

  @ManyToOne(() => Collection)
  @JoinColumn({ name: 'collectionId' })
  collection: Collection;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  volume: string;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  floorPrice: string;

  @Column({ type: 'int', default: 0 })
  salesCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
