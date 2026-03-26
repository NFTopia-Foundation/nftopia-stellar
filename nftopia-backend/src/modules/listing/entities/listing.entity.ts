import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nftContractId: string;

  @Column()
  nftTokenId: string;

  @Column()
  sellerId: string;

  @Column({ type: 'decimal', precision: 20, scale: 7 })
  price: number;

  @Column({ default: 'XLM' })
  currency: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
