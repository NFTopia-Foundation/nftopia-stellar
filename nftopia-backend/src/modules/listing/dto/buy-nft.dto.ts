import { IsNotEmpty, IsString } from 'class-validator';

export class BuyNftDto {
  @IsString()
  @IsNotEmpty()
  paymentMethod: string; // placeholder for future payment details
}
