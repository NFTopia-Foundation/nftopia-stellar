import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { StoredAsset } from './entities/stored-asset.entity';
import { RescanJob } from './scanning/rescan.job';
import type { ScanStatus } from './scanning/scan.types';

const MAX_PAGE_SIZE = 100;

@Controller('admin/storage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ScanAdminController {
  constructor(
    @InjectRepository(StoredAsset)
    private readonly storedAssetRepository: Repository<StoredAsset>,
    private readonly rescanJob: RescanJob,
  ) {}

  @Get('scans')
  async listScans(
    @Query('status') status?: ScanStatus,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 25,
  ) {
    const take = Math.min(pageSize, MAX_PAGE_SIZE);
    const skip = (Math.max(page, 1) - 1) * take;

    const [items, total] = await this.storedAssetRepository.findAndCount({
      where: status ? { scanStatus: status } : {},
      order: { createdAt: 'DESC' },
      take,
      skip,
    });

    return { items, total, page, pageSize: take };
  }

  @Get('quarantine')
  async listQuarantine() {
    const items = await this.storedAssetRepository.find({
      where: { quarantined: true },
      order: { scannedAt: 'DESC' },
    });

    return { items, total: items.length };
  }

  @Post('scans/:id/rescan')
  async rescan(@Param('id') id: string) {
    await this.rescanJob.rescanAssetById(id);
    return { assetId: id, status: 'rescanned' };
  }
}
