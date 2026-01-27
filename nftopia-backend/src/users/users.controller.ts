import { Body, Controller, Get, Headers, Param, Patch, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':address')
  getPublicProfile(@Param('address') address: string) {
    return this.usersService.findByAddress(address);
  }

  // TEMP ownership enforcement
  @Patch('me')
  updateMe(
    @Headers('x-wallet-address') address: string,
    @Body() dto: UpdateProfileDto,
  ) {
    if (!address) {
      throw new UnauthorizedException('Missing wallet address');
    }
    return this.usersService.updateProfile(address, dto);
  }
}
