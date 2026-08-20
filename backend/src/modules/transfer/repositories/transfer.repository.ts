import { TransferModel } from '../models/transfer.model';
import { ITransferDocument } from '../interfaces/transfer.interface';
import { TransferStatusType, TRANSFER_STATUS } from '../constants/transfer.constants';

export class TransferRepository {
  public async create(data: Partial<ITransferDocument>): Promise<ITransferDocument> {
    return await TransferModel.create(data);
  }

  public async findByToken(token: string): Promise<ITransferDocument | null> {
    return await TransferModel.findOne({ token });
  }

  public async findByShareId(shareId: string): Promise<ITransferDocument | null> {
    return await TransferModel.findOne({ shareId });
  }

  public async incrementDownloadCount(id: string, maxAllowed: number): Promise<ITransferDocument | null> {
    return await TransferModel.findOneAndUpdate(
      {
        _id: id,
        downloadCount: { $lt: maxAllowed },
        status: { $in: [TRANSFER_STATUS.READY, TRANSFER_STATUS.DOWNLOADING] },
      },
      {
        $inc: { downloadCount: 1 },
        $set: {
          status: TRANSFER_STATUS.DOWNLOADING,
          downloadStartedAt: new Date(),
          lastAccessedAt: new Date(),
        },
      },
      { new: true }
    );
  }

  public async updateStatus(
    id: string,
    status: TransferStatusType,
    extraData?: Partial<ITransferDocument>
  ): Promise<ITransferDocument | null> {
    return await TransferModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          ...extraData,
        },
      },
      { new: true }
    );
  }

  public async deleteByToken(token: string): Promise<ITransferDocument | null> {
    return await TransferModel.findOneAndUpdate(
      { token },
      { $set: { status: TRANSFER_STATUS.DELETED } },
      { new: true }
    );
  }

  public async findExpired(now: Date = new Date()): Promise<ITransferDocument[]> {
    return await TransferModel.find({
      $or: [
        { expiresAt: { $lte: now }, status: { $ne: TRANSFER_STATUS.DELETED } },
        { status: TRANSFER_STATUS.EXPIRED },
      ],
    });
  }
}

export const transferRepository = new TransferRepository();
