import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class EmailRegisterDto {
  @ApiProperty({
    example: 'builder@nftopia.io',
  })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    minLength: 8,
    description:
      'Password must include uppercase, lowercase, number, and symbol',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/, {
    message:
      'password must include uppercase, lowercase, number, and special character',
  })
  password: string;

  @ApiPropertyOptional({
    example: 'stellarbuilder',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  username?: string;
}

export class EmailLoginDto {
  @ApiProperty({
    example: 'builder@nftopia.io',
  })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
