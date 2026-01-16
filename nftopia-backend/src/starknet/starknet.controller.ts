import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { StarknetService } from './starknet.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('starknet')
@UseGuards(JwtAuthGuard)
export class StarknetController {
  constructor(private readonly starknetService: StarknetService) {}

  @Post('mint')
  async mint(@Body() body: { to: string; tokenId: string; uri: string }) {
    return this.starknetService.mint(body.to, body.tokenId, body.uri);
  }

  @Get('owner/:tokenId')
  async getOwner(@Param('tokenId') tokenId: string) {
    return this.starknetService.getOwnerOf(tokenId);
  }
}
