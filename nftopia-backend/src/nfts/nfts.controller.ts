import {
  Controller,
  Post,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Express } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { NftsService } from './nfts.service';
import { CreateNftFromUrlDto, MintNftDto } from './dto/mint-nft.dto';
import { User } from 'src/users/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RequestWithUser } from 'src/types/RequestWithUser';

@Controller('nfts')
export class NftsController {
  constructor(private readonly nftService: NftsService) {}

  @Post('mint/:userId/:collectionId')
  @UseInterceptors(FileInterceptor('file'))
  async mint(
    @Param('userId') userId: string,
    @Param('collectionId') collectionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: MintNftDto,
  ) {
    return this.nftService.mintNft(
      file,
      file.buffer,
      file.originalname,
      body,
      userId,
      collectionId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('mint/from-url')
  async mintFromUrl(
    @Body() dto: CreateNftFromUrlDto,
    @Req() req: RequestWithUser,
    @Query('collectionId') collectionId: string
  ) {
    return this.nftService.mintNftFromUrl(dto, req.user.sub, collectionId);
  }

}
