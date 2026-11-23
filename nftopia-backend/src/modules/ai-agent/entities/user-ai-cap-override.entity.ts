import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ToolSetName } from '../tools/tool-set.types';

/** Per-tool-set AI chat rate-limit points override (#751). */
export type RateLimitPointsOverride = Partial<Record<ToolSetName, number>>;

/**
 * An admin-granted override of a user's AI chat spend caps (#529). One row
 * per user — setting a new override replaces the previous one; clearing it
 * removes the row entirely, reverting the user to the env-configured
 * default caps.
 *
 * Deliberately does *not* touch/void `AiUsageRecord` rows: "resetting" a
 * user's cap here means raising the ceiling (or removing it, via a very
 * high value), not erasing their actual usage history, which stays intact
 * for cost auditing.
 */
@Entity('user_ai_cap_overrides')
export class UserAiCapOverride {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'daily_token_cap', type: 'int', nullable: true })
  dailyTokenCap?: number | null;

  @Column({ name: 'monthly_token_cap', type: 'int', nullable: true })
  monthlyTokenCap?: number | null;

  @Column({
    name: 'daily_spend_cap_usd',
    type: 'decimal',
    precision: 12,
    scale: 6,
    nullable: true,
  })
  dailySpendCapUsd?: string | null;

  @Column({
    name: 'monthly_spend_cap_usd',
    type: 'decimal',
    precision: 12,
    scale: 6,
    nullable: true,
  })
  monthlySpendCapUsd?: string | null;

  /**
   * Optional per-tool-set AI chat request-rate budgets (#751), e.g.
   * `{ "marketplace-assistant": 60 }`. A tool set absent from this map (or
   * a null column) uses the env-configured default points for that tool
   * set — see AiChatRateLimitGuard. The window length (AI_CHAT_RATE_LIMIT_TTL)
   * is not overridable; only the number of requests allowed within it.
   */
  @Column({ name: 'rate_limit_points', type: 'jsonb', nullable: true })
  rateLimitPoints?: RateLimitPointsOverride | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy?: string | null;

  /** Null means the override does not expire on its own — an admin must
   * explicitly clear it. */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
