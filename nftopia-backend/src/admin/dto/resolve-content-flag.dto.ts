import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ContentFlagStatus } from '../../modules/ai-agent/entities/content-flag.entity';

export class ResolveContentFlagDto {
  @IsIn(['reviewed', 'dismissed'])
  status: Exclude<ContentFlagStatus, 'pending'>;

  /** Optional moderator rationale, persisted with the resolution. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
