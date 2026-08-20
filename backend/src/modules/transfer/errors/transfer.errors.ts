import { AppError } from '../../../utils/AppError';
import { HttpStatusCodes } from '../../../constants/httpStatusCodes';
import { ErrorCodes } from '../../../constants/errorCodes';

export class TransferNotFoundError extends AppError {
  constructor(message = 'Transfer not found or has been deleted') {
    super(message, HttpStatusCodes.NOT_FOUND, ErrorCodes.NOT_FOUND, true);
    this.name = 'TransferNotFoundError';
  }
}

export class TransferExpiredError extends AppError {
  constructor(message = 'Transfer link has expired') {
    super(message, HttpStatusCodes.NOT_FOUND, ErrorCodes.NOT_FOUND, true);
    this.name = 'TransferExpiredError';
  }
}

export class TransferDownloadLimitError extends AppError {
  constructor(message = 'Maximum allowed download limit reached for this transfer') {
    super(message, HttpStatusCodes.NOT_FOUND, ErrorCodes.NOT_FOUND, true);
    this.name = 'TransferDownloadLimitError';
  }
}

export class TransferValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, HttpStatusCodes.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, true, details);
    this.name = 'TransferValidationError';
  }
}
