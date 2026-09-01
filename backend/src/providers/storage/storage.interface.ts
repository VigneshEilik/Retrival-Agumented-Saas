export interface FileMetadata {
  key: string;
  sizeBytes: number;
  mimeType: string;
  checksum: string;
  lastModified: Date;
}

export interface StorageProvider {
  name: string;
  uploadFile(key: string, body: Buffer, mimeType: string): Promise<{ key: string; checksum: string; sizeBytes: number }>;
  getFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
  fileExists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<FileMetadata>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
