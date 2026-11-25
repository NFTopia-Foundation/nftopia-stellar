import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One row per completed /ai/chat call. Token counts come straight from
 * finalMessage.usage (the last turn of the tool-calling loop, per the
 * Anthropic SDK) — see AiAgentService.chat.
 */
@Entity('ai_usage_records')
@Index(['userId', 'createdAt'])
export class AiUsageRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'tool_set', type: 'varchar', length: 50, default: 'chat' })
  toolSet: string;

  @Column({ type: 'varchar', length: 100 })
  model: string;

  @Column({ name: 'input_tokens', type: 'int' })
  inputTokens: number;

  @Column({ name: 'output_tokens', type: 'int' })
  outputTokens: number;

  @Column({ name: 'total_tokens', type: 'int' })
  totalTokens: number;

  @Column({
    name: 'estimated_cost_usd',
    type: 'decimal',
    precision: 12,
    scale: 6,
  })
  estimatedCostUsd: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
