import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity'
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/create-user.dto';



@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

    async create(createUserDto: CreateUserDto): Promise<User> {

    const existingUser = await this.userRepository.findOne({where: {walletAddress: createUserDto.walletAddress}});
    
    if (existingUser) {
        throw new ConflictException('Wallet address already exists, login instead.');
    } else {
      const user = this.userRepository.create(createUserDto);
      return this.userRepository.save(user);
    }

}

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByWallet(walletAddress: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { walletAddress } });
    if (!user) throw new NotFoundException(`User with wallet address ${walletAddress} not found`);
    return user;
  }

  async findOrCreateByWallet(walletAddress: string): Promise<User> {
    try {
      return await this.findByWallet(walletAddress);
    } catch (err) {
      if (err instanceof NotFoundException) {
        const newUser = this.userRepository.create({ walletAddress });
        return this.userRepository.save(newUser);
      }
      throw err; // rethrow unexpected errors
    }
  }
  

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    await this.userRepository.update(id, updateUserDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  async getTopSellers(): Promise<User[]> {
    return this.userRepository.find({
      where: { isArtist: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }
}