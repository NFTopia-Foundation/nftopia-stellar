import { IsNotEmpty, IsNumber } from 'class-validator';

export class PlaceBidDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number;
}
