import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('collections')
export class Collection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: false })
  isHidden: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column()
  creatorAddress: string;
}
