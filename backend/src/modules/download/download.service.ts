import { Response } from 'express';
import { transferService } from '../transfer/services/transfer.service';

export class DownloadService {
  public async streamDownload(token: string, res: Response): Promise<void> {
    return await transferService.streamDownload(token, res);
  }

  public async getMetadata(tokenOrShareId: string) {
    return await transferService.getTransferByToken(tokenOrShareId);
  }
}

export const downloadService = new DownloadService();
