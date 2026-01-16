// transactions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { NFT } from '../nfts/entities/nft.entity';
import { NftStorageService } from '../nftstorage/nftstorage.service';
import { fileTypeResultFromBuffer } from '../utils/file-type-result';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(NFT)
    private readonly nftRepo: Repository<NFT>,
    private readonly nftStorageService: NftStorageService,
  ) {}


  async recordTransaction(buyerId: string, nftId: string, amount: number): Promise<Transaction> {
    const buyer = await this.userRepo.findOneBy({ id: buyerId });
    const nft = await this.nftRepo.findOne({
      where: { id: nftId },
      relations: ['owner'], // to avoid any future lazy load issues
    });
  
    if (!buyer || !nft) throw new NotFoundException('Buyer or NFT not found');
  
    // === 1. Prepare metadata ===
    const updatedMetadata = {
      name: nft.title,
      description: nft.description,
      image: nft.imageUrl, // reference to the file URL
      attributes: [
        ...(nft.metadata?.attributes || []),
        { trait_type: 'owner', value: buyer.id },
        { trait_type: 'price', value: amount },
        { trait_type: 'sold', value: true },
      ],
    };
  
    // === 2. Fetch image from Firebase ===
    const response = await fetch(nft.imageUrl);
    if (!response.ok) throw new Error('Failed to fetch NFT image for IPFS upload');
    const buffer = Buffer.from(await response.arrayBuffer());
  
    // === 3. Upload new metadata to IPFS ==

    const fileTypeResult = await fileTypeResultFromBuffer(buffer);
    const ext = fileTypeResult.ext;

    const ipfsUrl = await this.nftStorageService.uploadToIPFS(
      buffer,
      `${nft.title.replace(/\s+/g, '_')}.${ext}`,
      updatedMetadata
    );
  
    // === 4. Update NFT entity ===
    nft.owner = buyer;
    nft.isListed = false; // assume listing ends on sale
    nft.ipfsUrl = ipfsUrl;
    nft.metadata = updatedMetadata;
    await this.nftRepo.save(nft);
  
    // === 5. Record transaction ===
    const tx = this.txRepo.create({
      buyer,
      nft,
      amount,
    });
  
    return this.txRepo.save(tx);
  }

  async getTransactionsByUser(userId: string): Promise<Transaction[]> {
    return this.txRepo.find({ where: { buyer: { id: userId } }, relations: ['nft'] });
  }
}
