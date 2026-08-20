import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { downloadService } from './download.service';

export class DownloadController {
  public getInfo = asyncHandler(async (req: Request, res: Response) => {
    const rawParam = req.params.token || req.params.transferCode;
    const token = typeof rawParam === 'string' ? rawParam : String(rawParam || '');
    const info = await downloadService.getMetadata(token);
    return ApiResponse.success(res, info);
  });

  public download = asyncHandler(async (req: Request, res: Response) => {
    const rawParam = req.params.token || req.params.transferCode;
    const token = typeof rawParam === 'string' ? rawParam : String(rawParam || '');
    await downloadService.streamDownload(token, res);
  });
}

export const downloadController = new DownloadController();
