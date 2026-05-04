import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OfferStatus } from '../interfaces/offer.interface';

export class OfferQueryDto {
  @IsEnum(OfferStatus)
  @IsOptional()
  status?: OfferStatus;

  @IsString()
  @IsOptional()
  bidderId?: string;
}
