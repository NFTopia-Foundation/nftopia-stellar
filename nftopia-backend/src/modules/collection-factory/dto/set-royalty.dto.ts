import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class SetRoyaltyDto {
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;
}
