import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nft } from '../modules/nft/entities/nft.entity';
import { SearchService } from './search.service';
import { User } from '../users/user.entity';

@Injectable()
export class SearchSyncListener {
  private readonly logger = new Logger(SearchSyncListener.name);

  constructor(
    @InjectRepository(Nft)
    private readonly nftRepository: Repository<Nft>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly searchService: SearchService,
  ) {}

  @OnEvent('search.nft.upsert', { async: true })
  async handleNftUpsert(payload: { nftId: string }) {
    try {
      const nft = await this.nftRepository.findOne({
        where: { id: payload.nftId },
        relations: ['attributes'],
      });

      if (!nft) {
        this.logger.warn(`NFT ${payload.nftId} was not found for indexing`);
        return;
      }

      await this.searchService.indexNft(nft);
    } catch (error) {
      this.logger.error(`Failed to sync NFT ${payload.nftId}`, error);
    }
  }

  @OnEvent('search.nft.delete', { async: true })
  async handleNftDelete(payload: { nftId: string }) {
    try {
      await this.searchService.removeNft(payload.nftId);
    } catch (error) {
      this.logger.error(
        `Failed to remove NFT ${payload.nftId} from search`,
        error,
      );
    }
  }

  @OnEvent('search.user.upsert', { async: true })
  async handleUserUpsert(payload: { userId: string }) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: payload.userId },
      });

      if (!user) {
        this.logger.warn(`User ${payload.userId} was not found for indexing`);
        return;
      }

      await this.searchService.indexUser(user);
    } catch (error) {
      this.logger.error(`Failed to sync user ${payload.userId}`, error);
    }
  }
}
