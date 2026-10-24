import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AI_AGENT_RAISED_BY,
  AI_AGENT_SYSTEM_ACTOR_ID,
  ContentFlag,
  ContentFlagEntityType,
  ContentFlagSeverity,
  ContentFlagStatus,
} from './entities/content-flag.entity';
import { AuditAction, AuditService } from '../../common/audit/audit.service';

export const DEFAULT_MODERATION_CONFIDENCE_THRESHOLD = 0.7;
export interface CreateContentFlagInput {
  entityType: ContentFlagEntityType;
  entityId: string;
  reason: string;
  severity: ContentFlagSeverity;
  confidence: number;
}

export interface ResolveContentFlagInput {
  status: Exclude<ContentFlagStatus, 'pending'>;
  reviewedBy: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ListContentFlagsFilter {
  status?: ContentFlagStatus;
  entityType?: ContentFlagEntityType;
  limit?: number;
  offset?: number;
}

/**
 * Read/write access to content_flags, shared by the `flag_content` AI tool
 * (creation) and the admin flags endpoints (listing + resolution). Every
 * mutation is recorded through AuditService, matching the pattern already
 * used by AdminService.
 */
@Injectable()
export class ContentFlagService {
  private readonly logger = new Logger(ContentFlagService.name);

  constructor(
    @InjectRepository(ContentFlag)
    private readonly contentFlagRepo: Repository<ContentFlag>,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Idempotency check for the ai-moderation queue processor (#527): a
   * redelivered job for the same entity must not raise a second flag.
   * Matches on entity identity alone (any status), not job/attempt —
   * once an entity has ever been flagged, moderation for it is done.
   */
  async findExistingFlag(
    entityType: ContentFlagEntityType,
    entityId: string,
  ): Promise<ContentFlag | null> {
    return this.contentFlagRepo.findOne({ where: { entityType, entityId } });
  }

  /**
   * The configured confidence cutoff (env-backed, see ModerationConfigService).
   * At-or-above this value a flag is reviewable; below it the result is
   * auto-cleared and no flag row is written.
   */
  getConfidenceThreshold(): number {
    const raw = this.configService.get<string>(
      'MODERATION_CONFIDENCE_THRESHOLD',
    );
    const parsed = raw !== undefined ? Number(raw) : NaN;
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    return DEFAULT_MODERATION_CONFIDENCE_THRESHOLD;
  }

  /**
   * Writes a reviewable flag only when the model confidence meets the
   * configured threshold. Below-threshold results are auto-cleared (no row
   * written, no audit entry) and the caller is told via the returned `flagged`
   * flag so it can record the appropriate metric/log.
   */
  async createFlagIfAboveThreshold(
    input: CreateContentFlagInput,
  ): Promise<{ flagged: boolean; flag?: ContentFlag; threshold: number }> {
    const threshold = this.getConfidenceThreshold();
    if (input.confidence < threshold) {
      this.logger.debug(
        `Auto-cleared moderation result for ${input.entityType}:${input.entityId} ` +
          `(confidence ${input.confidence} < threshold ${threshold})`,
      );
      return { flagged: false, threshold };
    }
    const flag = await this.createFlag(input);
    return { flagged: true, flag, threshold };
  }

  async createFlag(input: CreateContentFlagInput): Promise<ContentFlag> {
    const flag = this.contentFlagRepo.create({
      entityType: input.entityType,
      entityId: input.entityId,
      reason: input.reason,
      severity: input.severity,
      confidence: input.confidence,
      raisedBy: AI_AGENT_RAISED_BY,
      status: 'pending',
    });
    const saved = await this.contentFlagRepo.save(flag);

    await this.auditService.logAdminAction(AuditAction.FLAG_CONTENT, {
      adminId: AI_AGENT_SYSTEM_ACTOR_ID,
      entityType: input.entityType,
      entityId: input.entityId,
      afterState: {
        flagId: saved.id,
        severity: saved.severity,
        confidence: saved.confidence,
      },
    });

    return saved;
  }

  async listFlags(
    filter: ListContentFlagsFilter,
  ): Promise<{ flags: ContentFlag[]; total: number }> {
    const qb = this.contentFlagRepo.createQueryBuilder('flag');

    if (filter.status) {
      qb.andWhere('flag.status = :status', { status: filter.status });
    }
    if (filter.entityType) {
      qb.andWhere('flag.entityType = :entityType', { entityType: filter.entityType });
    }

    const total = await qb.getCount();
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const flags = await qb
      .orderBy('flag.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    return { flags, total };
  }

  async resolveFlag(
    id: string,
    input: ResolveContentFlagInput,
  ): Promise<ContentFlag> {
    const flag = await this.contentFlagRepo.findOne({ where: { id } });
    if (!flag) {
      throw new NotFoundException(`Content flag ${id} not found`);
    }
    if (flag.status !== 'pending') {
      throw new BadRequestException(
        `Content flag ${id} has already been ${flag.status}`,
      );
    }

    const beforeState = { status: flag.status };
    flag.status = input.status;
    flag.reviewedAt = new Date();
    flag.reviewedBy = input.reviewedBy;
    if (input.reason !== undefined) {
      flag.resolutionReason = input.reason;
    }
    const saved = await this.contentFlagRepo.save(flag);

    const action =
      input.status === 'reviewed'
        ? AuditAction.REVIEW_CONTENT_FLAG
        : AuditAction.DISMISS_CONTENT_FLAG;

    await this.auditService.logAdminAction(action, {
      adminId: input.reviewedBy,
      entityType: 'ContentFlag',
      entityId: id,
      beforeState,
      afterState: { status: saved.status, reason: input.reason },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return saved;
  }

  async bulkResolveFlags(
    ids: string[],
    input: ResolveContentFlagInput,
  ): Promise<{ resolved: ContentFlag[]; failed: { id: string; reason: string }[] }> {
    const resolved: ContentFlag[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const id of ids) {
      try {
        const flag = await this.resolveFlag(id, input);
        resolved.push(flag);
      } catch (error) {
        failed.push({
          id,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { resolved, failed };
  }
}
