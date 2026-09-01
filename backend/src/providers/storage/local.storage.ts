import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { StorageProvider, FileMetadata } from './storage.interface';
import { logger } from '../../utils/logger';

export class LocalStorageProvider implements StorageProvider {
  name = 'LocalStorageProvider';
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), 'storage_data');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolvePath(key: string): string {
    // Prevent path traversal attacks
    const sanitizedKey = path.normalize(key).replace(/^(\.\.[\/\\])+/, '');
    return path.join(this.baseDir, sanitizedKey);
  }

  async uploadFile(key: string, body: Buffer, mimeType: string): Promise<{ key: string; checksum: string; sizeBytes: number }> {
    const filePath = this.resolvePath(key);
    const dirPath = path.dirname(filePath);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    await fs.promises.writeFile(filePath, body);

    const checksum = crypto.createHash('sha256').update(body).digest('hex');
    const sizeBytes = body.length;

    // Save metadata JSON alongside file
    const metaPath = `${filePath}.meta.json`;
    await fs.promises.writeFile(
      metaPath,
      JSON.stringify({ key, sizeBytes, mimeType, checksum, lastModified: new Date().toISOString() })
    );

    logger.info({ key, sizeBytes, checksum }, 'Local file uploaded successfully');

    return { key, checksum, sizeBytes };
  }

  async getFile(key: string): Promise<Buffer> {
    const filePath = this.resolvePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found in storage: ${key}`);
    }
    return fs.promises.readFile(filePath);
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    const metaPath = `${filePath}.meta.json`;

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    if (fs.existsSync(metaPath)) {
      await fs.promises.unlink(metaPath);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    return fs.existsSync(filePath);
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    const filePath = this.resolvePath(key);
    const metaPath = `${filePath}.meta.json`;

    if (fs.existsSync(metaPath)) {
      const content = await fs.promises.readFile(metaPath, 'utf8');
      const parsed = JSON.parse(content);
      return {
        ...parsed,
        lastModified: new Date(parsed.lastModified),
      };
    }

    const stat = await fs.promises.stat(filePath);
    const body = await fs.promises.readFile(filePath);
    const checksum = crypto.createHash('sha256').update(body).digest('hex');

    return {
      key,
      sizeBytes: stat.size,
      mimeType: 'application/octet-stream',
      checksum,
      lastModified: stat.mtime,
    };
  }

  async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    // Local storage mock signed URL endpoint
    return `/api/v1/storage/download?key=${encodeURIComponent(key)}`;
  }
}
