export const TRANSFER_STATUS = {
  UPLOADING: 'UPLOADING',
  READY: 'READY',
  DOWNLOADING: 'DOWNLOADING',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  DELETED: 'DELETED',
} as const;

export type TransferStatusType = (typeof TRANSFER_STATUS)[keyof typeof TRANSFER_STATUS];

export const FORBIDDEN_FILE_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.vbs',
  '.msi',
  '.ps1',
  '.scr',
  '.jar',
  '.com',
  '.pif',
  '.application',
  '.gadget',
  '.msp',
  '.hta',
  '.cpl',
  '.msc',
  '.dll',
  '.iso',
] as const;

export const TRANSFER_LIMITS = {
  DEFAULT_MAX_DOWNLOADS: 1,
  DEFAULT_EXPIRY_MINUTES: 10,
  MIN_EXPIRY_MINUTES: 1,
  MAX_EXPIRY_MINUTES: 1440, // 24 hours
  MIN_RECEIVER_LIMIT: 1,
  MAX_RECEIVER_LIMIT: 100,
} as const;
