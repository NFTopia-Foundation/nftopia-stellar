import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractEventDlq } from './entities/contract-event-dlq.entity';
import { ContractEvent } from './entities/contract-event.entity';
import { IndexerService } from './indexer.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@ApiTags('Admin DLQ')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/dlq')
export class DlqController {
  constructor(
    @InjectRepository(ContractEventDlq)
    private readonly dlqRepo: Repository<ContractEventDlq>,
    @InjectRepository(ContractEvent)
    private readonly eventRepo: Repository<ContractEvent>,
    private readonly indexerService: IndexerService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List DLQ records' })
  async listDlqRecords(
    @Query('status') status?: string,
    @Query('contractId') contractId?: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    const query = this.dlqRepo.createQueryBuilder('dlq');

    if (status) {
      query.andWhere('dlq.status = :status', { status });
    }

    if (contractId) {
      query.andWhere('dlq.contract_id = :contractId', { contractId });
    }

    query.orderBy('dlq.lastFailedAt', 'DESC').take(limit).skip(offset);

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      total,
      limit: Number(limit),
      offset: Number(offset),
    };
  }

  @Post(':id/replay')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Manually trigger replay for a specific DLQ record',
  })
  async manualReplay(@Param('id') id: string) {
    const dlq = await this.dlqRepo.findOne({ where: { id } });

    if (!dlq) {
      throw new Error(`DLQ record not found: ${id}`);
    }

    try {
      const entity = this.eventRepo.create({
        contractId: dlq.contractId,
        ledger: dlq.ledger,
        txHash: dlq.txHash,
        eventIndex: dlq.eventIndex,
        eventType: dlq.eventType,
        payload: dlq.payload,
      });

      const result = await this.eventRepo
        .createQueryBuilder()
        .insert()
        .into(ContractEvent)
        .values(entity as QueryDeepPartialEntity<ContractEvent>)
        .orIgnore()
        .execute();

      dlq.status = 'resolved';
      await this.dlqRepo.save(dlq);

      const inserted = result.identifiers && result.identifiers.length > 0;
      return { success: true, inserted, status: dlq.status };
    } catch (err) {
      dlq.lastFailedAt = new Date();
      dlq.errorMessage = err instanceof Error ? err.message : String(err);
      dlq.stack = err instanceof Error ? (err.stack ?? '') : '';
      await this.dlqRepo.save(dlq);

      return { success: false, error: dlq.errorMessage };
    }
  }
}
