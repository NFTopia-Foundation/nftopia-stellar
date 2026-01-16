// create-user.dto.ts
import { IsEthereumAddress, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsEthereumAddress()
  walletAddress: string;

  @IsOptional()
  @IsString()
  username?: string;
}

// update-user.dto.ts
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsBoolean()
  isArtist?: boolean;
}

// user-response.dto.ts
export class UserResponseDto {
  id: string;
  walletAddress: string;
  username: string;
  avatar: string;
  isArtist: boolean;
  createdAt: Date;
}