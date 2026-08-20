import { AppError } from '../../../utils/AppError';
import { HttpStatusCodes } from '../../../constants/httpStatusCodes';
import { ErrorCodes } from '../../../constants/errorCodes';

export class DownloadNotFoundError extends AppError {
  constructor(message = 'Transfer not found or file is missing') {
    super(message, HttpStatusCodes.NOT_FOUND, ErrorCodes.NOT_FOUND, true);
    this.name = 'DownloadNotFoundError';
  }
}

export class DownloadExpiredError extends AppError {
  constructor(message = 'Transfer link has expired') {
    super(message, HttpStatusCodes.GONE, ErrorCodes.TRANSFER_EXPIRED, true);
    this.name = 'DownloadExpiredError';
  }
}

export class DownloadLimitExceededError extends AppError {
  constructor(message = 'Download limit exceeded') {
    super(message, HttpStatusCodes.TOO_MANY_REQUESTS, ErrorCodes.DOWNLOAD_LIMIT_REACHED, true);
    this.name = 'DownloadLimitExceededError';
  }
}

export class DownloadStreamError extends AppError {
  constructor(message = 'Failed to stream file download') {
    super(message, HttpStatusCodes.INTERNAL_SERVER_ERROR, ErrorCodes.STORAGE_ERROR, false);
    this.name = 'DownloadStreamError';
  }
}
