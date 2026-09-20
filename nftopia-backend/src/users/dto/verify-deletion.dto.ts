import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyDeletionDto {
  @ApiProperty({
    description: 'Deletion verification token emailed to the account owner.',
  })
  @IsString()
  token: string;
}
