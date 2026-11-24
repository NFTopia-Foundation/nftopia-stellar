import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class AuditLogsQueryDto {
  @IsOptional()
  @IsUUID()
  adminId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => value === undefined ? 0 : Number(value))
  @IsInt()
  @Min(0)
  offset?: number;
}
