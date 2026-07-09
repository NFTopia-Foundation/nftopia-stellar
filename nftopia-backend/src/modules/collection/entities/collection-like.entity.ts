import {
  Entity,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Collection } from './collection.entity';
import { User } from '../../../users/user.entity';

@Entity('collection_likes')
@Unique(['collectionId', 'userId'])
export class CollectionLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Collection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection: Collection;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
