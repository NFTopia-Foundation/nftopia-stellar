import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { RpcProvider, Account, Contract, CallData } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StarknetService {
  private provider: RpcProvider;
  private account: Account;
  private contract: Contract;

  constructor() {
    this.provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    this.account = new Account(
      this.provider,
      process.env.STARKNET_ACCOUNT_ADDRESS,
      process.env.STARKNET_PRIVATE_KEY,
      '1' 
    );

    const contractClassPath = path.resolve(
      __dirname,
      '..',
      '..',
      'src',
      'starknet',
      'abis',
      'nftopia_NftContract.contract_class.json'
    );

    const contractClass = JSON.parse(fs.readFileSync(contractClassPath, 'utf-8'));
    const abi = contractClass.abi;

    this.contract = new Contract(
      abi,
      process.env.STARKNET_CONTRACT_ADDRESS,
      this.account
    );
  }

  async mint(to: string, tokenId: string, tokenUri: string) {
    try {
      const callData = CallData.compile({
        to,
        token_id: tokenId,
        uri: tokenUri,
      });

      const res = await this.account.execute({
        contractAddress: this.contract.address,
        entrypoint: 'mint',
        calldata: callData,
      });

      return res;
    } catch (err) {
      console.error('Starknet mint error:', err);
      throw new InternalServerErrorException('Minting on Starknet failed');
    }
  }

  async getOwnerOf(tokenId: string) {
    try {
      const result = await this.contract.call('owner_of', [tokenId]);
      return result;
    } catch (err) {
      console.error('Starknet read error:', err);
      throw new InternalServerErrorException('Read from Starknet failed');
    }
  }
}
