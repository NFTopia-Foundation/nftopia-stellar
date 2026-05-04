import { IsNotEmpty, IsString } from 'class-validator';

export class TransferTokenDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  tokenId: string;
}
