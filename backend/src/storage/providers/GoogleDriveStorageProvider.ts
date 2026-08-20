import fs from 'fs';
import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { StorageProvider } from '../interfaces/StorageProvider';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/AppError';
import { HttpStatusCode, HttpStatusCodes } from '../../constants/httpStatusCodes';
import { ErrorCodes } from '../../constants/errorCodes';

/**
 * Interface representing structured metadata for a file stored in Google Drive.
 */
export interface GoogleDriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime?: string;
  modifiedTime?: string;
  md5Checksum?: string;
}

/**
 * Interface for Google Drive configuration options.
 */
export interface GoogleDriveStorageConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
}

/**
 * Custom error class representing Google Drive storage operational failures.
 */
export class GoogleDriveStorageError extends AppError {
  constructor(message: string, statusCode: HttpStatusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR, details?: Record<string, unknown>) {
    super(message, statusCode, ErrorCodes.INTERNAL_SERVER_ERROR, true, details);
    this.name = 'GoogleDriveStorageError';
  }
}

/**
 * Production-ready storage provider implementation for Google Drive.
 * Implements the {@link StorageProvider} interface using Google Drive v3 API.
 */
export class GoogleDriveStorageProvider implements StorageProvider {
  private readonly driveClient: drive_v3.Drive;
  private readonly oauth2Client: OAuth2Client;
  private readonly folderId: string;

  /**
   * Initializes the GoogleDriveStorageProvider instance.
   * Reads OAuth credentials and target folder ID from environment variables or custom config.
   *
   * @param config - Optional configuration override. If omitted, values are read from process.env.
   * @throws {GoogleDriveStorageError} If any required credential environment variable is missing.
   */
  constructor(config?: Partial<GoogleDriveStorageConfig>) {
    const clientId = config?.clientId || process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = config?.clientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = config?.refreshToken || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    const folderId = config?.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!clientId || !clientSecret || !refreshToken || !folderId) {
      const missingKeys: string[] = [];
      if (!clientId) missingKeys.push('GOOGLE_DRIVE_CLIENT_ID');
      if (!clientSecret) missingKeys.push('GOOGLE_DRIVE_CLIENT_SECRET');
      if (!refreshToken) missingKeys.push('GOOGLE_DRIVE_REFRESH_TOKEN');
      if (!folderId) missingKeys.push('GOOGLE_DRIVE_FOLDER_ID');

      logger.error('GoogleDriveStorageProvider initialization failed: Missing environment variables', { missingKeys });
      throw new GoogleDriveStorageError(
        `Google Drive configuration incomplete. Missing: ${missingKeys.join(', ')}`,
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    this.folderId = folderId;

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });

    this.driveClient = google.drive({
      version: 'v3',
      auth: this.oauth2Client,
    });

    logger.info('GoogleDriveStorageProvider successfully initialized', { folderId: this.folderId });
  }

  /**
   * Uploads a file from local filesystem to Google Drive into the configured folder.
   *
   * @param filePath - Local path of the file to be uploaded.
   * @param fileName - Target file name to set in Google Drive.
   * @param mimeType - MIME type of the file being uploaded.
   * @returns Promise resolving to an object containing the created file's ID and name.
   * @throws {GoogleDriveStorageError} If the local file does not exist or the upload fails.
   */
  public async upload(
    filePath: string,
    fileName: string,
    mimeType: string
  ): Promise<{ fileId: string; fileName: string }> {
    if (!fs.existsSync(filePath)) {
      logger.error(`Upload failed: Local file not found at path '${filePath}'`);
      throw new GoogleDriveStorageError(`Local file not found: ${filePath}`, HttpStatusCodes.BAD_REQUEST);
    }

    try {
      logger.info(`Starting file upload to Google Drive: ${fileName}`, { mimeType, folderId: this.folderId });

      const fileStream = fs.createReadStream(filePath);

      const response = await this.driveClient.files.create({
        requestBody: {
          name: fileName,
          parents: [this.folderId],
        },
        media: {
          mimeType,
          body: fileStream,
        },
        fields: 'id, name',
      });

      const fileId = response.data.id;
      const uploadedFileName = response.data.name || fileName;

      if (!fileId) {
        throw new GoogleDriveStorageError('Google Drive API returned an empty file ID after upload');
      }

      logger.info(`File uploaded successfully to Google Drive`, { fileId, fileName: uploadedFileName });

      return {
        fileId,
        fileName: uploadedFileName,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Google Drive upload failed for file '${fileName}'`, { error: errorMessage });
      if (error instanceof AppError) throw error;
      throw new GoogleDriveStorageError(`Failed to upload file to Google Drive: ${errorMessage}`);
    }
  }

  /**
   * Downloads a file from Google Drive as a readable stream.
   *
   * @param fileId - The Google Drive file ID to download.
   * @returns Promise resolving to a NodeJS.ReadableStream for streaming file content.
   * @throws {GoogleDriveStorageError} If the file does not exist or stream creation fails.
   */
  public async download(fileId: string): Promise<NodeJS.ReadableStream> {
    if (!fileId) {
      throw new GoogleDriveStorageError('File ID is required for download', HttpStatusCodes.BAD_REQUEST);
    }

    try {
      logger.info(`Requesting download stream for Google Drive file`, { fileId });

      const response = await this.driveClient.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      logger.info(`Download stream established for file`, { fileId });
      return response.data as unknown as NodeJS.ReadableStream;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to download Google Drive file with ID '${fileId}'`, { error: errorMessage });
      if (error instanceof AppError) throw error;
      throw new GoogleDriveStorageError(`Failed to download file '${fileId}' from Google Drive: ${errorMessage}`);
    }
  }

  /**
   * Permanently deletes a file from Google Drive by its file ID.
   *
   * @param fileId - The Google Drive file ID to delete.
   * @returns Promise resolving when deletion is complete.
   * @throws {GoogleDriveStorageError} If the deletion request fails.
   */
  public async delete(fileId: string): Promise<void> {
    if (!fileId) {
      throw new GoogleDriveStorageError('File ID is required for deletion', HttpStatusCodes.BAD_REQUEST);
    }

    try {
      logger.info(`Deleting Google Drive file`, { fileId });

      await this.driveClient.files.delete({ fileId });

      logger.info(`Successfully deleted Google Drive file`, { fileId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to delete Google Drive file '${fileId}'`, { error: errorMessage });
      if (error instanceof AppError) throw error;
      throw new GoogleDriveStorageError(`Failed to delete file '${fileId}' from Google Drive: ${errorMessage}`);
    }
  }

  /**
   * Checks whether a file exists in Google Drive and is not in trash.
   *
   * @param fileId - The Google Drive file ID to check.
   * @returns Promise resolving to true if the file exists and is active, false otherwise.
   */
  public async exists(fileId: string): Promise<boolean> {
    if (!fileId) {
      return false;
    }

    try {
      const response = await this.driveClient.files.get({
        fileId,
        fields: 'id, trashed',
      });

      return Boolean(response.data.id && !response.data.trashed);
    } catch (error: unknown) {
      logger.debug(`Existence check returned false for Google Drive file '${fileId}'`);
      return false;
    }
  }

  /**
   * Retrieves metadata for a file stored in Google Drive.
   *
   * @param fileId - The Google Drive file ID to retrieve metadata for.
   * @returns Promise resolving to file metadata structure.
   * @throws {GoogleDriveStorageError} If the file does not exist or metadata retrieval fails.
   */
  public async getMetadata(fileId: string): Promise<GoogleDriveFileMetadata> {
    if (!fileId) {
      throw new GoogleDriveStorageError('File ID is required to fetch metadata', HttpStatusCodes.BAD_REQUEST);
    }

    try {
      logger.info(`Fetching metadata for Google Drive file`, { fileId });

      const response = await this.driveClient.files.get({
        fileId,
        fields: 'id, name, mimeType, size, createdTime, modifiedTime, md5Checksum, trashed',
      });

      const data = response.data;

      if (!data.id || data.trashed) {
        throw new GoogleDriveStorageError(`File with ID '${fileId}' not found or is in trash`, HttpStatusCodes.NOT_FOUND);
      }

      const metadata: GoogleDriveFileMetadata = {
        id: data.id,
        name: data.name || 'unnamed',
        mimeType: data.mimeType || 'application/octet-stream',
        size: data.size ? parseInt(data.size, 10) : 0,
        createdTime: data.createdTime || undefined,
        modifiedTime: data.modifiedTime || undefined,
        md5Checksum: data.md5Checksum || undefined,
      };

      return metadata;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to retrieve metadata for Google Drive file '${fileId}'`, { error: errorMessage });
      if (error instanceof AppError) throw error;
      throw new GoogleDriveStorageError(`Failed to retrieve metadata for file '${fileId}': ${errorMessage}`);
    }
  }
}
