import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseConfig {
  constructor(private configService: ConfigService) {}

  initFirebase() {
    const base64 = this.configService.get<string>(
      'FIREBASE_CREDENTIALS_BASE64',
    );
    const bucket = this.configService.get<string>('FIREBASE_STORAGE_BUCKET');

    if (!base64) throw new Error('Missing Firebase config');

    const serviceAccount = JSON.parse(
      Buffer.from(base64, 'base64').toString('utf-8'),
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: bucket,
    });

    return admin.storage().bucket();
  }
}
