import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './audit-log.entity';
import { ConfigService } from '@nestjs/config';

export { AuditAction };

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {}

  async logAdminAction(
    action: AuditAction,
    metadata: {
      adminId: string;
      entityType: string;
      entityId: string;
      beforeState?: Record<string, unknown>;
      afterState?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<AuditLog> {
    if (!metadata.adminId) {
      throw new UnauthorizedException('adminId is required for audit logging');
    }

    const log = this.auditLogRepository.create({
      action,
      adminId: metadata.adminId,
      entityType: metadata.entityType,
      entityId: metadata.entityId,
      beforeState: metadata.beforeState,
      afterState: metadata.afterState,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return this.auditLogRepository.save(log);
  }

  async findAuditLogs(filters: {
    adminId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const query = this.auditLogRepository.createQueryBuilder('log');

    if (filters.adminId) {
      query.andWhere('log.adminId = :adminId', { adminId: filters.adminId });
    }

    if (filters.action) {
      query.andWhere('log.action = :action', { action: filters.action });
    }

    if (filters.entityType) {
      query.andWhere('log.entityType = :entityType', {
        entityType: filters.entityType,
      });
    }

    if (filters.entityId) {
      query.andWhere('log.entityId = :entityId', {
        entityId: filters.entityId,
      });
    }

    if (filters.startDate) {
      query.andWhere('log.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      query.andWhere('log.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    const total = await query.getCount();
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const logs = await query
      .orderBy('log.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    return { logs, total };
  }
}
