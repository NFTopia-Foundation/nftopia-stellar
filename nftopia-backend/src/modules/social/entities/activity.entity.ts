import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ActivityType {
  MINT = 'MINT',
  PURCHASE = 'PURCHASE',
  LIST = 'LIST',
  BID = 'BID',
}

@Entity('activities')
@Index(['actorId', 'createdAt'])
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  actorId: string;

  @Column({ type: 'enum', enum: ActivityType })
  type: ActivityType;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
