import { TransferStatusType } from '../constants/transfer.constants';

export interface QRPayloadDto {
  shareUrl: string;
  shareId: string;
  transferToken: string;
}

export interface TransferResponseDto {
  token: string;
  shareId: string; // Formatted Share ID (e.g. ABC-92L-KJD)
  shareUrl: string;
  qrPayload: QRPayloadDto;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  status: TransferStatusType;
  downloadCount: number;
  maxDownloads: number;
  receiverLimitEnabled: boolean;
  receiverLimit?: number;
  remainingDownloads: number;
  expiresAt: string;
  createdAt: string;
  transferType: 'single' | 'zip';
}

export interface TransferStatusDto {
  token: string;
  shareId: string;
  status: TransferStatusType;
  downloadCount: number;
  maxDownloads: number;
  remainingDownloads: number;
  receiverLimitEnabled: boolean;
  receiverLimit?: number;
  expiresAt: string;
  secondsRemaining: number;
  isExpired: boolean;
}
