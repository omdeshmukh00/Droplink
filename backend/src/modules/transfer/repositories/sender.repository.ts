import { prisma } from '../../../config/prisma';
import { Sender } from '@prisma/client';

export interface ISender {
  id: string;
  senderCode: string;
  senderName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SenderRepository {
  public async findOrCreateSender(senderCode: string, senderName?: string): Promise<ISender> {
    const existing = await prisma.sender.findUnique({
      where: { senderCode },
    });

    if (existing) {
      if (senderName && existing.senderName !== senderName) {
        const updated = await prisma.sender.update({
          where: { id: existing.id },
          data: { senderName },
        });
        return this.mapSender(updated);
      }
      return this.mapSender(existing);
    }

    const created = await prisma.sender.create({
      data: {
        senderCode,
        senderName: senderName || null,
      },
    });

    return this.mapSender(created);
  }

  public async findByCode(senderCode: string): Promise<ISender | null> {
    const record = await prisma.sender.findUnique({
      where: { senderCode },
    });
    return record ? this.mapSender(record) : null;
  }

  public async findById(id: string): Promise<ISender | null> {
    const record = await prisma.sender.findUnique({
      where: { id },
    });
    return record ? this.mapSender(record) : null;
  }

  private mapSender(record: Sender): ISender {
    return {
      id: record.id,
      senderCode: record.senderCode,
      senderName: record.senderName ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export const senderRepository = new SenderRepository();
