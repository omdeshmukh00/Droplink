import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { ApiResponse } from '../../../utils/ApiResponse';
import { downloadService, DownloadService } from '../services/download.service';

export class DownloadController {
  private readonly service: DownloadService;

  constructor(service: DownloadService = downloadService) {
    this.service = service;
  }

  public download = asyncHandler(async (req: Request, res: Response) => {
    const rawParam = req.params.token || req.params.transferCode;
    const token = typeof rawParam === 'string' ? rawParam : String(rawParam || '');
    await this.service.streamDownload(token, res);
  });

  public getStatus = asyncHandler(async (req: Request, res: Response) => {
    const rawParam = req.params.token || req.params.shareId || req.params.transferCode;
    const tokenOrShareId = typeof rawParam === 'string' ? rawParam : String(rawParam || '');
    const status = await this.service.getDownloadStatus(tokenOrShareId);
    return ApiResponse.success(res, status);
  });

  public getByShareId = asyncHandler(async (req: Request, res: Response) => {
    const rawParam = req.params.shareId;
    const shareId = typeof rawParam === 'string' ? rawParam : String(rawParam || '');
    const data = await this.service.getMetadataByShareId(shareId);
    return ApiResponse.success(res, data);
  });
}

export const downloadController = new DownloadController();
