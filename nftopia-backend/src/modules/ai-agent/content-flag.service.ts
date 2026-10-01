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
  ipAddress?: string;
  userAgent?: string;
}

export interface ListContentFlagsFilter {
  status?: ContentFlagStatus;
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
  constructor(
    @InjectRepository(ContentFlag)
    private readonly contentFlagRepo: Repository<ContentFlag>,
    private readonly auditService: AuditService,
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
      afterState: { status: saved.status },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return saved;
  }
}
