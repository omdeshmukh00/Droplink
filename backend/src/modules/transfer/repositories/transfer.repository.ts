import { prisma } from '../../../config/prisma';
import { Transfer, TransferStatus, TransferType, Prisma } from '@prisma/client';
import { ITransferDocument } from '../interfaces/transfer.interface';
import { TransferStatusType } from '../constants/transfer.constants';
import { DriveMetadata } from '../types/transfer.types';

function mapTransfer(record: Transfer): ITransferDocument {
  return {
    _id: record.id,
    id: record.id,
    token: record.token,
    shareId: record.shareId,
    senderId: record.senderId ?? undefined,
    driveFileId: record.driveFileId,
    originalName: record.originalName,
    storedName: record.storedName,
    mimeType: record.mimeType,
    size: Number(record.size), // Convert BigInt byte count to safe JS Number
    status: record.status as TransferStatusType,
    downloadCount: record.downloadCount,
    maxDownloads: record.maxDownloads,
    receiverLimitEnabled: record.receiverLimitEnabled,
    receiverLimit: record.receiverLimit ?? undefined,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy ?? undefined,
    lastAccessedAt: record.lastAccessedAt ?? undefined,
    downloadStartedAt: record.downloadStartedAt ?? undefined,
    downloadCompletedAt: record.downloadCompletedAt ?? undefined,
    transferType: record.transferType as 'single' | 'zip',
    driveMetadata: record.driveMetadata as unknown as DriveMetadata,
  };
}

export class TransferRepository {
  public async create(data: Partial<ITransferDocument>): Promise<ITransferDocument> {
    const created = await prisma.transfer.create({
      data: {
        token: data.token!,
        shareId: data.shareId!,
        senderId: data.senderId ?? null,
        driveFileId: data.driveFileId!,
        originalName: data.originalName!,
        storedName: data.storedName!,
        mimeType: data.mimeType!,
        size: BigInt(data.size || 0),
        status: (data.status as TransferStatus) || TransferStatus.UPLOADING,
        downloadCount: data.downloadCount ?? 0,
        maxDownloads: data.maxDownloads ?? 1,
        receiverLimitEnabled: data.receiverLimitEnabled ?? false,
        receiverLimit: data.receiverLimit ?? null,
        expiresAt: data.expiresAt!,
        createdBy: data.createdBy ?? null,
        transferType: (data.transferType as TransferType) || TransferType.single,
        driveMetadata: (data.driveMetadata || {}) as unknown as Prisma.InputJsonValue,
      },
    });

    return mapTransfer(created);
  }

  public async findByToken(token: string): Promise<ITransferDocument | null> {
    const record = await prisma.transfer.findUnique({
      where: { token },
    });
    return record ? mapTransfer(record) : null;
  }

  public async findByShareId(shareId: string): Promise<ITransferDocument | null> {
    const record = await prisma.transfer.findUnique({
      where: { shareId },
    });
    return record ? mapTransfer(record) : null;
  }

  public async incrementDownloadCount(id: string, maxAllowed: number): Promise<ITransferDocument | null> {
    const updated = await prisma.transfer.updateMany({
      where: {
        OR: [{ id }, { token: id }],
        downloadCount: { lt: maxAllowed },
        status: { in: [TransferStatus.READY, TransferStatus.DOWNLOADING] },
      },
      data: {
        downloadCount: { increment: 1 },
        status: TransferStatus.DOWNLOADING,
        downloadStartedAt: new Date(),
        lastAccessedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return null;
    }

    const record = await prisma.transfer.findFirst({
      where: { OR: [{ id }, { token: id }] },
    });

    return record ? mapTransfer(record) : null;
  }

  public async updateStatus(
    id: string,
    status: TransferStatusType,
    extraData?: Partial<ITransferDocument>
  ): Promise<ITransferDocument | null> {
    const target = await prisma.transfer.findFirst({
      where: { OR: [{ id }, { token: id }] },
    });

    if (!target) return null;

    const updateData: Prisma.TransferUpdateInput = {
      status: status as TransferStatus,
    };

    if (extraData) {
      if (extraData.downloadCompletedAt !== undefined) updateData.downloadCompletedAt = extraData.downloadCompletedAt;
      if (extraData.downloadStartedAt !== undefined) updateData.downloadStartedAt = extraData.downloadStartedAt;
      if (extraData.lastAccessedAt !== undefined) updateData.lastAccessedAt = extraData.lastAccessedAt;
    }

    const record = await prisma.transfer.update({
      where: { id: target.id },
      data: updateData,
    });

    return mapTransfer(record);
  }

  public async deleteByToken(token: string): Promise<ITransferDocument | null> {
    try {
      const record = await prisma.transfer.update({
        where: { token },
        data: { status: TransferStatus.DELETED },
      });
      return mapTransfer(record);
    } catch {
      return null;
    }
  }

  public async findExpired(now: Date = new Date()): Promise<ITransferDocument[]> {
    const records = await prisma.transfer.findMany({
      where: {
        OR: [
          { expiresAt: { lte: now }, status: { not: TransferStatus.DELETED } },
          { status: TransferStatus.EXPIRED },
        ],
      },
    });
    return records.map(mapTransfer);
  }
}

export const transferRepository = new TransferRepository();
