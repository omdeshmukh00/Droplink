import { TransferStatusType } from '../../transfer/constants/transfer.constants';

export interface DownloadStatusDto {
  token: string;
  shareId: string;
  status: TransferStatusType;
  downloadCount: number;
  remainingDownloads: number;
  expiresAt: string;
  remainingTime: number; // In seconds
  fileName: string;
  fileSize: number;
  transferType: 'single' | 'zip';
}

export interface DownloadMetadataDto {
  token: string;
  shareId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  transferType: 'single' | 'zip';
  status: TransferStatusType;
  expiresAt: string;
  downloadCount: number;
  remainingDownloads: number;
}
