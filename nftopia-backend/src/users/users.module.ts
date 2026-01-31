import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity'; // Point to the entity file

@Module({
  imports: [TypeOrmModule.forFeature([User])], // Registers the Repository
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Good practice to export if other modules need it
})
export class UsersModule {}
