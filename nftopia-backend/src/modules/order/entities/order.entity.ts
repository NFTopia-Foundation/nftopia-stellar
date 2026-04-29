import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('orders')
@Index('idx_orders_buyer_id', ['buyerId'])
@Index('idx_orders_seller_id', ['sellerId'])
@Index('idx_orders_nft_id', ['nftId'])
@Index('idx_orders_created_at', ['createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  nftId: string;

  @Column('uuid')
  buyerId: string;

  @Column('uuid')
  sellerId: string;

  @Column('decimal', { precision: 20, scale: 7 })
  price: string;

  @Column({ type: 'varchar', length: 10, default: 'XLM' })
  currency: string;

  @Column({ type: 'varchar', length: 20 })
  type: string; // SALE, PURCHASE

  @Column({ type: 'varchar', length: 20, default: 'COMPLETED' })
  status: string; // COMPLETED, PENDING, FAILED

  @Column({ type: 'varchar', length: 100, nullable: true })
  transactionHash: string;

  @Column({ type: 'uuid', nullable: true })
  listingId: string;

  @Column({ type: 'uuid', nullable: true })
  auctionId: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
