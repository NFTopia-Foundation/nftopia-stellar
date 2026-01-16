// lib/upload.ts
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase.config';

export async function uploadToFirebase(file: File): Promise<string> {
  const storageRef = ref(storage, `nftopia/${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
}
