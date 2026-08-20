import { Readable } from 'stream';
import { FileSaveOptions, StorageFileMetadata, StorageProvider } from '../../types/storage.types';

export abstract class AbstractStorageProvider implements StorageProvider {
  abstract save(fileBuffer: Buffer | Readable, options?: FileSaveOptions): Promise<string>;
  abstract delete(filePath: string): Promise<void>;
  abstract exists(filePath: string): Promise<boolean>;
  abstract stream(filePath: string): Promise<Readable>;
  abstract getMetadata(filePath: string): Promise<StorageFileMetadata>;
}

export { StorageProvider };
