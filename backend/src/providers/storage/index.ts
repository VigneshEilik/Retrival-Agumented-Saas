import { StorageProvider } from './storage.interface';
import { LocalStorageProvider } from './local.storage';

let currentStorageProvider: StorageProvider = new LocalStorageProvider();

export function getStorageProvider(): StorageProvider {
  return currentStorageProvider;
}

export function setStorageProvider(provider: StorageProvider): void {
  currentStorageProvider = provider;
}

export * from './storage.interface';
export * from './local.storage';
