import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Nft } from './nft.entity';

@Entity('nft_attributes')
@Index('idx_nft_attributes_nft_id', ['nftId'])
export class NftMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nft_id', type: 'uuid' })
  nftId: string;

  @ManyToOne(() => Nft, (nft) => nft.attributes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nft_id' })
  nft: Nft;

  @Column({ name: 'trait_type', type: 'varchar', length: 100 })
  traitType: string;

  @Column({ type: 'varchar', length: 255 })
  value: string;

  @Column({ name: 'display_type', type: 'varchar', length: 50, nullable: true })
  displayType?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
