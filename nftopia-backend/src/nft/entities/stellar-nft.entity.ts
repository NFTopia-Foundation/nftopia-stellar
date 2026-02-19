import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { NftMetadata } from './nft-metadata.entity';

@Entity('stellar_nfts')
@Index(['owner']) // Optimize queries by owner
@Index(['contractId']) // Optimize filter by contract
export class StellarNft {
  @PrimaryColumn()
  contractId: string;

  @PrimaryColumn()
  tokenId: string;

  @Column()
  owner: string; // Stellar G-address

  @Column({ nullable: true })
  metadataUri: string;

  @OneToOne(() => NftMetadata, (metadata) => metadata.nft, {
    cascade: true,
    eager: true,
  })
  @JoinColumn()
  metadata: NftMetadata;

  @Column({ default: 0 })
  views: number; // For PopularThisWeek

  @Column({ default: 0 })
  salesCount: number; // For TopSellers

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  volume: number; // Total volume in XLM

  @Column({ nullable: true })
  mintedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
