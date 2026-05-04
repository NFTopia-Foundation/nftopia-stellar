import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class MintTokenDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  metadataUri: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}
