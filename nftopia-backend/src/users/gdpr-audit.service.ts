import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { GdprAuditLog } from './entities/gdpr-audit-log.entity';
import { GdprAuditAction } from './gdpr.constants';

export interface GdprAuditContext {
  userId: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Writes and queries the GDPR audit trail. Every export request and every
 * deletion attempt flows through here so compliance can be demonstrated
 * after the fact.
 */
@Injectable()
export class GdprAuditService {
  constructor(
    @InjectRepository(GdprAuditLog)
    private readonly repo: Repository<GdprAuditLog>,
  ) {}

  async log(
    action: GdprAuditAction,
    context: GdprAuditContext,
  ): Promise<GdprAuditLog> {
    const entry = this.repo.create({
      action,
      userId: context.userId,
      entityType: context.entityType ?? null,
      entityId: context.entityId ?? null,
      metadata: context.metadata ?? null,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
    return this.repo.save(entry);
  }

  async countActions(
    userId: string,
    actions: GdprAuditAction | GdprAuditAction[],
    since: Date,
  ): Promise<number> {
    const list = Array.isArray(actions) ? actions : [actions];
    return this.repo.count({
      where: {
        userId,
        action: In(list),
        createdAt: MoreThanOrEqual(since),
      },
    });
  }

  async findForUser(userId: string, limit = 100): Promise<GdprAuditLog[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
