import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../users/user.entity';
import { NftMetadata } from './nft-metadata.entity';

@Entity('nfts')
@Index('idx_nfts_owner_id', ['ownerId'])
@Index('idx_nfts_creator_id', ['creatorId'])
@Index('idx_nfts_collection_id', ['collectionId'])
@Index('idx_nfts_token_id', ['tokenId'])
export class Nft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'token_id', type: 'varchar', length: 100, unique: true })
  tokenId: string;

  @Column({ name: 'contract_address', type: 'varchar', length: 56 })
  contractAddress: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl?: string;

  @Column({
    name: 'animation_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  animationUrl?: string;

  @Column({
    name: 'external_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  externalUrl?: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ name: 'collection_id', type: 'uuid', nullable: true })
  collectionId?: string;

  @Column({
    name: 'minted_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  mintedAt: Date;

  @Column({
    name: 'last_price',
    type: 'decimal',
    precision: 20,
    scale: 7,
    nullable: true,
  })
  lastPrice?: string;

  @Column({ name: 'is_burned', type: 'boolean', default: false })
  isBurned: boolean;

  @OneToMany(() => NftMetadata, (attribute) => attribute.nft, {
    cascade: true,
  })
  attributes: NftMetadata[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
