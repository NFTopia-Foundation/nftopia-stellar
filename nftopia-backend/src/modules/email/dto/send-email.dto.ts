import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { TemplateData } from '../email.interface';

/**
 * DTO for sending templated emails
 */
export class SendEmailDto {
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  templateName: string;

  @IsObject()
  @IsOptional()
  data?: TemplateData;
}

/**
 * DTO for requesting password reset
 */
export class RequestPasswordResetDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

/**
 * DTO for resetting password
 */
export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}

/**
 * DTO for resending verification email
 */
export class ResendVerificationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
