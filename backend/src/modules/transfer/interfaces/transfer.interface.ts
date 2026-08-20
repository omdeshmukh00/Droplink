import { Document } from 'mongoose';
import { TransferStatusType } from '../constants/transfer.constants';
import { DriveMetadata } from '../types/transfer.types';

export interface ITransferDocument extends Document {
  token: string;
  shareId: string; // Unformatted raw Share ID (e.g. ABC92LKJD)
  driveFileId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  status: TransferStatusType;
  downloadCount: number;
  maxDownloads: number;
  receiverLimitEnabled: boolean;
  receiverLimit?: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  lastAccessedAt?: Date;
  downloadStartedAt?: Date;
  downloadCompletedAt?: Date;
  transferType: 'single' | 'zip';
  driveMetadata: DriveMetadata;
}
