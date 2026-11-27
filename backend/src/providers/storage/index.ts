import { StorageProvider } from './storage.interface';
import { LocalStorageProvider } from './local.storage';
import { config } from '../../config';

// STORAGE_DIR should point at a persistent volume in production (defaults to ./storage_data).
let currentStorageProvider: StorageProvider = new LocalStorageProvider(config.storageDir || undefined);

export function getStorageProvider(): StorageProvider {
  return currentStorageProvider;
}

export function setStorageProvider(provider: StorageProvider): void {
  currentStorageProvider = provider;
}

export * from './storage.interface';
export * from './local.storage';
