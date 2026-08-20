import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { uploadService } from './upload.service';
import { initiateUploadSchema } from './upload.schema';

export class UploadController {
  public initiate = asyncHandler(async (req: Request, res: Response) => {
    const validatedBody = initiateUploadSchema.parse(req.body);
    const result = await uploadService.prepareUpload(validatedBody);
    return ApiResponse.created(res, result);
  });
}

export const uploadController = new UploadController();
