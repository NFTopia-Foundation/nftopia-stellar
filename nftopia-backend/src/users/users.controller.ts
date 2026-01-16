import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Put,
    Delete,
  } from '@nestjs/common';
  import { User } from './entities/user.entity';
  import { UsersService } from './users.service';
  import { CreateUserDto } from './dto/create-user.dto';
  import { UpdateUserDto } from './dto/create-user.dto';
  import { UserResponseDto } from './dto/create-user.dto';
import { isInstance } from 'class-validator';
  
  @Controller('users')
  export class UsersController {
    constructor(private readonly usersService: UsersService) {}
  
    @Post()
    async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
      const user = await this.usersService.create(createUserDto);
      return this.toResponseDto(user);    
    }
  
    @Get()
    async findAll(): Promise<UserResponseDto[]> {
      const users = await this.usersService.findAll();
      return users.map(this.toResponseDto);
    }
  
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<UserResponseDto> {
      const user = await this.usersService.findOne(id);
      return this.toResponseDto(user);
    }
  
    @Get('wallet/:walletAddress')
    async findByWallet(
      @Param('walletAddress') walletAddress: string,
    ): Promise<UserResponseDto> {
      const user = await this.usersService.findByWallet(walletAddress);
      return this.toResponseDto(user);
    }
  
    @Get('top-sellers')
    async getTopSellers(): Promise<UserResponseDto[]> {
      const users = await this.usersService.getTopSellers();
      return users.map(this.toResponseDto);
    }
  
    @Put(':id')
    async update(
      @Param('id') id: string,
      @Body() updateUserDto: UpdateUserDto,
    ): Promise<UserResponseDto> {
      const user = await this.usersService.update(id, updateUserDto);
      return this.toResponseDto(user);
    }
  
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<void> {
      return this.usersService.remove(id);
    }
  
    private toResponseDto(user: User ): UserResponseDto {
      return {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        avatar: user.avatar,
        isArtist: user.isArtist,
        createdAt: user.createdAt,
      };
    }
  }