import { Injectable } from '@nestjs/common';
import { NFTStorage, File } from 'nft.storage';
import fileType from 'file-type';
import { NFTMetadata } from '../interfaces/NFTMetadata';
import { nftStorageConfig } from './nftstorage.config';

@Injectable()
export class NftStorageService {
  private client = new NFTStorage({ token: nftStorageConfig.apiKey });

  async uploadToIPFS(buffer: Buffer, fileName: string, metadata: NFTMetadata) {
    const fileTypeResult = await fileType.fromBuffer(buffer);
    if (!fileTypeResult) {
      throw new Error('Could not determine file type');
    }

    const imageFile = new File([buffer], fileName, { type: fileTypeResult.mime });

    const meta = await this.client.store({
      name: metadata.name,
      description: metadata.description,
      image: imageFile,
      attributes: metadata.attributes,
    });

    return meta.url; 
  }
}
