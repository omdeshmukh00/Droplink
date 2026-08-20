export type SocketStatusEvent =
  | 'transfer-created'
  | 'upload-started'
  | 'upload-progress'
  | 'zip-started'
  | 'zip-progress'
  | 'zip-completed'
  | 'drive-upload-started'
  | 'drive-upload-progress'
  | 'drive-upload-completed'
  | 'transfer-processing'
  | 'transfer-ready'
  | 'download-started'
  | 'download-progress'
  | 'download-completed'
  | 'transfer-expired'
  | 'transfer-deleted'
  | 'cleanup-started'
  | 'cleanup-completed'
  | 'error'
  | 'disconnect';

export interface SocketProgressPayload {
  transferToken?: string;
  shareId?: string;
  status: SocketStatusEvent | string;
  percentage?: number;
  message?: string;
  timestamp: string;
  data?: unknown;
}

export interface JoinRoomData {
  roomKey?: string;
  transferToken?: string;
  shareId?: string;
}

export interface RoomJoinedPayload {
  roomKey: string;
  status: 'success' | 'failed';
  message?: string;
  timestamp: string;
  currentStatus?: unknown;
}
