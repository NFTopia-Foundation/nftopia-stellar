import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from './config/typeorm.config';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ...(process.env.NODE_ENV === 'test'
      ? []
      : [TypeOrmModule.forRoot(typeOrmConfig), UsersModule]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
