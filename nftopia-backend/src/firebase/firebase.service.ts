import { Injectable } from '@nestjs/common';
import { FirebaseConfig } from './firebase.config';
import { v4 as uuidv4 } from 'uuid';
import { Bucket } from '@google-cloud/storage';

@Injectable()
export class FirebaseService {
  private bucket: Bucket;

  constructor(private firebaseConfig: FirebaseConfig) {
    this.bucket = this.firebaseConfig.initFirebase();
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const fileName = `${uuidv4()}-${file.originalname}`;
    const fileUpload = this.bucket.file(fileName);

    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    return new Promise((resolve, reject) => {
      blobStream.on('error', (error) => {
        reject(`Unable to upload image: ${error}`);
      });

      blobStream.on('finish', async () => {
        const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${fileName}`;
        resolve(publicUrl);
      });

      blobStream.end(file.buffer);
    });
  }

  async isValidUrl(url: string): Promise<boolean> {
    try {
      const parsedUrl = new URL(url);
      const hasValidProtocol = parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
      const isFirebaseUrl = /^(https:\/\/)?(.*\.firebaseio\.com|firebasestorage\.googleapis\.com)/.test(url);
      return hasValidProtocol && isFirebaseUrl;
    } catch (_) {
      return false;
    }
  }
}


