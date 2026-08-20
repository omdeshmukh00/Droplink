import fs from 'fs';
import path from 'path';
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
import archiver from 'archiver';
import { AbstractStorageProvider } from './storage.provider';
import { FileSaveOptions, StorageFileMetadata } from '../../types/storage.types';
import { env } from '../../config/env';
import { generateUUID } from '../../utils/generateId';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';

const streamPipeline = promisify(pipeline);

export class LocalStorageProvider extends AbstractStorageProvider {
  private baseDir: string;
  private tempDir: string;

  constructor(baseDir: string = env.UPLOAD_DIR) {
    super();
    this.baseDir = path.resolve(process.cwd(), baseDir);
    this.tempDir = path.resolve(process.cwd(), env.TEMP_DIR);
    this.ensureDirectoryExists(this.baseDir);
    this.ensureDirectoryExists(this.tempDir);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info(`📁 Created directory: ${dirPath}`);
    }
  }

  private validateSafePath(filePath: string): string {
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(this.baseDir) && !resolvedPath.startsWith(this.tempDir)) {
      throw AppError.forbidden('Path traversal attempt detected');
    }
    return resolvedPath;
  }

  public async save(fileBuffer: Buffer | Readable, options?: FileSaveOptions): Promise<string> {
    const filename = options?.filename || `${generateUUID()}`;
    const targetDir = options?.subDir
      ? path.join(this.baseDir, options.subDir)
      : this.baseDir;

    this.ensureDirectoryExists(targetDir);
    const filePath = path.join(targetDir, filename);

    try {
      if (Buffer.isBuffer(fileBuffer)) {
        await fs.promises.writeFile(filePath, fileBuffer);
      } else {
        const writeStream = fs.createWriteStream(filePath);
        await streamPipeline(fileBuffer, writeStream);
      }
      return filePath;
    } catch (error) {
      logger.error(`❌ Failed to save file to local storage at ${filePath}:`, error);
      throw AppError.internal('Failed to store file on disk');
    }
  }

  public async delete(filePath: string): Promise<void> {
    const safePath = this.validateSafePath(filePath);
    try {
      if (await this.exists(safePath)) {
        await fs.promises.unlink(safePath);
        logger.info(`🗑️ Deleted file: ${safePath}`);
      }
    } catch (error) {
      logger.error(`❌ Error deleting file ${safePath}:`, error);
      throw AppError.internal('Failed to delete file from disk');
    }
  }

  public async exists(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = path.resolve(filePath);
      await fs.promises.access(resolvedPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async stream(filePath: string): Promise<Readable> {
    const safePath = this.validateSafePath(filePath);
    if (!(await this.exists(safePath))) {
      throw AppError.notFound('Requested file does not exist on disk');
    }
    return fs.createReadStream(safePath);
  }

  public async getMetadata(filePath: string): Promise<StorageFileMetadata> {
    const safePath = this.validateSafePath(filePath);
    try {
      const stats = await fs.promises.stat(safePath);
      return {
        path: safePath,
        size: stats.size,
        lastModified: stats.mtime,
      };
    } catch (error) {
      throw AppError.notFound('File metadata unavailable or file missing');
    }
  }

  /**
   * Bundles multiple files into a single ZIP archive on disk.
   */
  public async createZipArchive(
    files: { path: string; originalName: string }[],
    zipFilename: string
  ): Promise<{ path: string; size: number }> {
    const zipPath = path.join(this.tempDir, zipFilename);
    this.ensureDirectoryExists(this.tempDir);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = (archiver as any)('zip', { zlib: { level: 6 } });

      output.on('close', () => {
        logger.info(`📦 Created ZIP archive: ${zipPath} (${archive.pointer()} bytes)`);
        resolve({ path: zipPath, size: archive.pointer() });
      });

      archive.on('error', (err: any) => {
        logger.error(`❌ Error building ZIP archive at ${zipPath}:`, err);
        reject(AppError.internal('Failed to create ZIP archive'));
      });

      archive.pipe(output);

      for (const file of files) {
        archive.file(file.path, { name: file.originalName });
      }

      archive.finalize();
    });
  }
}

export const localStorageProvider = new LocalStorageProvider();
