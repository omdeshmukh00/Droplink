import fs from 'fs';
import path from 'path';
import { ZipArchive } from 'archiver';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../utils/AppError';

export interface FileToZip {
  path: string;
  originalName: string;
}

export interface ZipResult {
  zipPath: string;
  filename: string;
  size: number;
}

/**
 * Creates a ZIP archive in the target directory from a list of local file paths.
 */
export async function createZipArchive(
  files: FileToZip[],
  zipFilename: string,
  targetDir: string = path.resolve(process.cwd(), 'temp')
): Promise<ZipResult> {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const zipPath = path.join(targetDir, zipFilename);
  const output = fs.createWriteStream(zipPath);
  const archive = new ZipArchive({ zlib: { level: 6 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const size = archive.pointer();
      logger.info(`📦 Created ZIP archive successfully`, { zipFilename, size });
      resolve({
        zipPath,
        filename: zipFilename,
        size,
      });
    });

    archive.on('error', (err: Error) => {
      logger.error('❌ Error creating ZIP archive:', err);
      reject(AppError.internal(`Failed to generate ZIP archive: ${err.message}`));
    });

    archive.pipe(output);

    for (const file of files) {
      if (fs.existsSync(file.path)) {
        archive.file(file.path, { name: file.originalName });
      }
    }

    archive.finalize();
  });
}
