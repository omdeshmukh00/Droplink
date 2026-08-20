import path from 'path';
import { env } from '../config/env';
import { AppError } from './AppError';

// List of dangerous executable and script file extensions
const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.vbs',
  '.msi',
  '.scr',
  '.pif',
  '.application',
  '.gadget',
  '.hta',
  '.cpl',
  '.msc',
  '.jar',
  '.com',
  '.ps1',
  '.bas',
  '.dll',
  '.sys',
  '.vbe',
  '.jse',
  '.wsf',
  '.wsh',
]);

const DANGEROUS_MIMES = new Set([
  'application/x-msdownload',
  'application/x-executable',
  'application/x-msdos-program',
  'application/x-sh',
  'application/x-shellscript',
  'application/x-bat',
  'application/x-cmd',
]);

export interface FileToValidate {
  originalname: string;
  size: number;
  mimetype: string;
}

export function validateUploads(files?: FileToValidate[]): void {
  if (!files || files.length === 0) {
    throw AppError.validationError('No files uploaded. Please attach at least one file.');
  }

  if (files.length > env.MAX_FILES) {
    throw AppError.validationError(`Too many files. Maximum allowed files per transfer is ${env.MAX_FILES}.`);
  }

  let totalSize = 0;

  for (const file of files) {
    if (!file || file.size <= 0) {
      throw AppError.validationError(`File '${file?.originalname || 'unknown'}' is empty.`);
    }

    if (file.size > env.MAX_FILE_SIZE) {
      throw AppError.validationError(
        `File '${file.originalname}' exceeds the maximum allowed file size of ${Math.round(
          env.MAX_FILE_SIZE / (1024 * 1024)
        )}MB.`
      );
    }

    totalSize += file.size;

    const ext = path.extname(file.originalname).toLowerCase();
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      throw AppError.validationError(`File '${file.originalname}' has a prohibited file type (${ext}).`);
    }

    if (DANGEROUS_MIMES.has(file.mimetype.toLowerCase())) {
      throw AppError.validationError(`File '${file.originalname}' has an unsafe MIME type.`);
    }
  }

  if (totalSize > env.MAX_FILE_SIZE) {
    throw AppError.validationError(
      `Total transfer size exceeds maximum limit of ${Math.round(env.MAX_FILE_SIZE / (1024 * 1024))}MB.`
    );
  }
}
