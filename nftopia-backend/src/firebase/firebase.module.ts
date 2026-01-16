import { Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';  
import { ConfigModule } from '@nestjs/config';
import { FirebaseConfig } from './firebase.config';

@Module({
  imports: [ConfigModule.forRoot()], 
  providers: [FirebaseService, FirebaseConfig],
  exports: [FirebaseService, FirebaseConfig],  
})
export class FirebaseModule {}
