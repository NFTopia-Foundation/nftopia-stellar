import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseService } from '../firebase/firebase.service';
import { NftStorageService } from '../nftstorage/nftstorage.service';
import { NFT } from './entities/nft.entity';
import { NFTMetadata } from '../interfaces/NFTMetadata';
import { CreateNftFromUrlDto, MintNftDto } from './dto/mint-nft.dto';
import { User } from '../users/entities/user.entity';
import { Collection } from '../collections/entities/collection.entity';

@Injectable()
export class NftsService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly nftStorage: NftStorageService,
    @InjectRepository(NFT)
    private readonly nftRepo: Repository<NFT>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Collection)
    private readonly collectionRepo: Repository<Collection>,
  ) {}

  async mintNft(
    file: Express.Multer.File,
    fileBuffer: Buffer,
    fileName: string,
    dto: MintNftDto,
    userId: string,
    collectionId: string,
  ) {
    // Upload media to Firebase
    // const firebaseUrl = await this.firebase.uploadFile(fileBuffer, fileName);
    const firebaseUrl = await this.firebase.uploadFile(file);



    // Prepare metadata for NFT.Storage
    const nftMetadata: NFTMetadata = {
      name: dto.title,
      description: dto.description,
      image: firebaseUrl,
      attributes: []
    };

    // Upload to NFT.Storage
    const ipfsUrl = await this.nftStorage.uploadToIPFS(fileBuffer, fileName, nftMetadata);

    // Get owner and collection entities
    const owner = await this.userRepo.findOneBy({ id: userId });
    const collection = await this.collectionRepo.findOneBy({ id: collectionId });

    // Save to database
    const nft = this.nftRepo.create({
      tokenId: `TKN-${Date.now()}`, // temporary placeholder
      title: dto.title,
      description: dto.description,
      imageUrl: firebaseUrl,
      ipfsUrl: ipfsUrl,
      metadata: nftMetadata,
      price: dto.price,
      currency: dto.currency || 'STK',
      owner,
      collection,
      isListed: false,
    });

    return await this.nftRepo.save(nft);
  }

  async mintNftFromUrl(dto: CreateNftFromUrlDto, userId: string, collectionId: string) {
    if (!this.firebase.isValidUrl(dto.imageUrl)) {
      throw new BadRequestException('Invalid image URL');
    }

    // Prepare metadata for NFT.Storage
    const nftMetadata: NFTMetadata = {
      name: dto.title,
      description: dto.description,
      image: dto.imageUrl,
      attributes: []
    };

    // Upload to NFT.Storage? do we then still send over the image buffer?\
    // const ipfsUrl = await this.nftStorage.uploadToIPFS(fileBuffer, fileName, nftMetadata);

    // Get owner and collection entities
    const owner = await this.userRepo.findOneBy({ id: userId });
    const collection = await this.collectionRepo.findOneBy({ id: collectionId });

    // Save to database
    const nft = this.nftRepo.create({
      tokenId: `TKN-${Date.now()}`,
      title: dto.title,
      description: dto.description,
      imageUrl: dto.imageUrl,
      metadata: nftMetadata,
      price: dto.price,
      currency: dto.currency || 'STK',
      owner,
      collection,
      isListed: false,
    });

    return await this.nftRepo.save(nft);
  }
}
