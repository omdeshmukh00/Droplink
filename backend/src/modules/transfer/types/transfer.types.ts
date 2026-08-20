import { TransferStatusType } from '../constants/transfer.constants';

export type SocketUploadStage =
  | 'UPLOADING'
  | 'CREATING_ZIP'
  | 'UPLOADING_TO_DRIVE'
  | 'GENERATING_SHARE_ID'
  | 'SAVING_MONGODB'
  | 'READY'
  | 'FAILED';

export interface UploadProgressEvent {
  token: string;
  stage: SocketUploadStage;
  progress?: number;
  message?: string;
}

export interface DriveMetadata {
  fileId: string;
  md5Checksum?: string;
  mimeType?: string;
  createdTime?: string;
}

export interface CreateTransferParams {
  files: Express.Multer.File[];
  maxDownloads?: number;
  receiverLimitEnabled?: boolean;
  receiverLimit?: number;
  expiryMinutes?: number;
  createdBy?: string;
}
