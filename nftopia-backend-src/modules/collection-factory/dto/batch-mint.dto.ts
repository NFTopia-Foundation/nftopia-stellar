import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class BatchMintDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  recipients: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  uris: string[];
}
