import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('follows')
@Unique(['followerId', 'followingId'])
@Index(['followingId'])
export class Follow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  followerId: string;

  @Column()
  followingId: string;

  @CreateDateColumn()
  createdAt: Date;
}
