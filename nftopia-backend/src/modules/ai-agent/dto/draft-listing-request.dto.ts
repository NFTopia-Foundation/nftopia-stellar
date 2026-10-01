import { IsNotEmpty, IsUUID } from 'class-validator';

export class DraftListingRequestDto {
  @IsUUID()
  @IsNotEmpty()
  nftId: string;
}
