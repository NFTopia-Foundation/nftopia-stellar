import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { EXPORT_FORMATS, type ExportFormat } from '../gdpr.constants';

export class ExportQueryDto {
  @ApiPropertyOptional({
    enum: EXPORT_FORMATS,
    default: 'json',
    description: 'Serialization format for the exported personal data.',
  })
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: ExportFormat;
}
