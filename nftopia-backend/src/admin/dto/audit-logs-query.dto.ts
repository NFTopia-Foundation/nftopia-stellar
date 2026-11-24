import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AuditAction } from '../../common/audit/audit-log.entity';

export class AuditLogsQueryDto {
  @IsOptional()
  @IsUUID()
  adminId?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 0 : Number(value)))
  @IsInt()
  @Min(0)
  offset?: number;
}
