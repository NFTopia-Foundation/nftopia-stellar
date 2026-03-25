import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class PlaceBidDto {
  @IsString()
  @IsNotEmpty()
  bidder: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,7})?$/, {
    message: 'bidAmount must be a numeric string with up to 7 decimals',
  })
  bidAmount: string;
}
