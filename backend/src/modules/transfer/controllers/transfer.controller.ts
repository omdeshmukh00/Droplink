import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { ApiResponse } from '../../../utils/ApiResponse';
import { transferService, TransferService } from '../services/transfer.service';
import { createTransferSchema, validateUploadedFiles } from '../validators/transfer.validator';
import { TransferValidationError } from '../errors/transfer.errors';

export class TransferController {
  private readonly service: TransferService;

  constructor(service: TransferService = transferService) {
    this.service = service;
  }

  public create = asyncHandler(async (req: Request, res: Response) => {
    let files: Express.Multer.File[] = [];

    if (Array.isArray(req.files)) {
      files = req.files;
    } else if (req.files && typeof req.files === 'object') {
      files = Object.values(req.files).flat();
    } else if (req.file) {
      files = [req.file];
    }

    if (!files || files.length === 0) {
      throw new TransferValidationError('No files uploaded. Please attach at least one file.');
    }

    // Validate uploaded files against size, mime type, and security rules
    validateUploadedFiles(files);

    const input = createTransferSchema.parse(req.body);
    const result = await this.service.createTransfer(files, input);
    return ApiResponse.created(res, result);
  });

  public getByToken = asyncHandler(async (req: Request, res: Response) => {
    const rawParam = req.params.token;
    const token = typeof rawParam === 'string' ? rawParam : String(rawParam || '');
    const data = await this.service.getTransferByToken(token);
    return ApiResponse.success(res, data);
  });

  public getByShareId = asyncHandler(async (req: Request, res: Response) => {
    const rawParam = req.params.shareId;
    const shareId = typeof rawParam === 'string' ? rawParam : String(rawParam || '');
    const data = await this.service.getTransferByShareId(shareId);
    return ApiResponse.success(res, data);
  });

  public verifyShareId = asyncHandler(async (req: Request, res: Response) => {
    const rawParam = req.params.shareId;
    const shareId = typeof rawParam === 'string' ? rawParam : String(rawParam || '');
    const cleanId = shareId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (!cleanId) {
      return res.status(400).json({ success: false, message: 'ShareID is required' });
    }

    const socketService = (await import('../../../services/socket.service')).SocketService.getInstance();
    const hasP2PSender = socketService.hasActiveRoom(`transfer:${cleanId}`) || socketService.hasActiveRoom(cleanId);

    if (hasP2PSender) {
      return ApiResponse.success(res, { valid: true, mode: 'p2p' });
    }

    try {
      const data = await this.service.getTransferByShareId(cleanId);
      if (data) {
        return ApiResponse.success(res, { valid: true, mode: 'cloud', data });
      }
    } catch {
      // Ignore
    }

    return res.status(404).json({
      success: false,
      message: 'ShareID is Invalid',
    });
  });

  public getStatus = asyncHandler(async (req: Request, res: Response) => {
    const rawParam = req.params.token;
    const token = typeof rawParam === 'string' ? rawParam : String(rawParam || '');
    const status = await this.service.getTransferStatus(token);
    return ApiResponse.success(res, status);
  });

  public download = asyncHandler(async (req: Request, res: Response) => {
    const rawParam = req.params.token;
    const token = typeof rawParam === 'string' ? rawParam : String(rawParam || '');
    await this.service.streamDownload(token, res);
  });

  public delete = asyncHandler(async (req: Request, res: Response) => {
    const rawParam = req.params.token;
    const token = typeof rawParam === 'string' ? rawParam : String(rawParam || '');
    const result = await this.service.deleteTransfer(token);
    return ApiResponse.success(res, result);
  });
}

export const transferController = new TransferController();
