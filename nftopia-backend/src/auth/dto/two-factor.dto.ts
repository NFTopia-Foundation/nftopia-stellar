import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class TwoFactorVerifyDto {
  @ApiProperty({ description: '6-digit TOTP code from authenticator app' })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class TwoFactorChallengeDto {
  @ApiProperty({ description: 'Temporary 2FA-pending JWT from login response' })
  @IsString()
  pendingToken: string;

  @ApiProperty({ description: '6-digit TOTP code from authenticator app' })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class TwoFactorRecoverDto {
  @ApiProperty({ description: 'One of the generated backup codes' })
  @IsString()
  backupCode: string;
}
