import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChatSession } from './chat-session.entity';

@Entity('ai_tool_call_logs')
@Index(['sessionId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['toolName', 'createdAt'])
export class AiToolCallLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  // Retention policy: Log entries follow the lifecycle of their associated chat session.
  // When a chat session is purged or deleted due to data retention policies,
  // its corresponding tool call logs are automatically cascaded and deleted.
  @ManyToOne(() => ChatSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: ChatSession;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'tool_name', type: 'varchar', length: 100 })
  toolName: string;

  @Column({ type: 'jsonb' })
  args: any;

  @Column({ name: 'result_summary', type: 'text' })
  resultSummary: string;

  @Column({ name: 'duration_ms', type: 'int' })
  durationMs: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
