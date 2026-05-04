import {
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class SubmitVerificationRequestDto {
  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  proofLinks?: string[];

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  additionalInfo?: string;
}

export class ReviewVerificationRequestDto {
  @IsString()
  reviewNotes?: string;
}
