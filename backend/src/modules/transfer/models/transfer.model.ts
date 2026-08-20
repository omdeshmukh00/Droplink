import mongoose, { Schema } from 'mongoose';
import { ITransferDocument } from '../interfaces/transfer.interface';
import { TRANSFER_STATUS } from '../constants/transfer.constants';

const DriveMetadataSchema = new Schema(
  {
    fileId: { type: String, required: true },
    md5Checksum: { type: String, required: false },
    mimeType: { type: String, required: false },
    createdTime: { type: String, required: false },
  },
  { _id: false }
);

const TransferSchema = new Schema<ITransferDocument>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    shareId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    driveFileId: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    storedName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TRANSFER_STATUS),
      default: TRANSFER_STATUS.UPLOADING,
      index: true,
    },
    downloadCount: {
      type: Number,
      required: true,
      default: 0,
    },
    maxDownloads: {
      type: Number,
      required: true,
      default: 1,
    },
    receiverLimitEnabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    receiverLimit: {
      type: Number,
      required: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    createdBy: {
      type: String,
      required: false,
    },
    lastAccessedAt: {
      type: Date,
      required: false,
    },
    downloadStartedAt: {
      type: Date,
      required: false,
    },
    downloadCompletedAt: {
      type: Date,
      required: false,
    },
    transferType: {
      type: String,
      enum: ['single', 'zip'],
      default: 'single',
    },
    driveMetadata: {
      type: DriveMetadataSchema,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const TransferModel = mongoose.model<ITransferDocument>('Transfer', TransferSchema);
