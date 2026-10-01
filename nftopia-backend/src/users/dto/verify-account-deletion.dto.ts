import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyAccountDeletionDto {
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token: string;
}
