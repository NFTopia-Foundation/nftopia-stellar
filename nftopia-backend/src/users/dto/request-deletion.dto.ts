import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestDeletionDto {
  @ApiPropertyOptional({
    description:
      'Optional email-verification token. When supplied alongside confirm=true ' +
      'the deletion is scheduled immediately instead of sending a new email.',
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({
    description: 'Optional free-text reason for the deletion request.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
