import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d])/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character',
  })
  newPassword: string;
}

export class VerifyEmailDto {
  @IsString()
  token: string;
}
