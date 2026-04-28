import { Entity, Column, PrimaryGeneratedColumn, OneToOne } from 'typeorm';
import { StellarNft } from './stellar-nft.entity';

@Entity('nft_metadata')
export class NftMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  image: string;

  @Column({ type: 'jsonb', nullable: true })
  attributes: any;

  @OneToOne(() => StellarNft, (nft) => nft.metadata)
  nft: StellarNft;
}
