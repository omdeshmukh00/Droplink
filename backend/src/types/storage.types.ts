import { Readable } from 'stream';

export interface FileSaveOptions {
  filename?: string;
  mimeType?: string;
  subDir?: string;
}

export interface StorageFileMetadata {
  path: string;
  size: number;
  lastModified: Date;
  mimeType?: string;
}

export interface StorageProvider {
  save(fileBuffer: Buffer | Readable, options?: FileSaveOptions): Promise<string>;
  delete(filePath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  stream(filePath: string): Promise<Readable>;
  getMetadata(filePath: string): Promise<StorageFileMetadata>;
}
