import mongoose, { Schema, Document } from 'mongoose';

export interface ITransferFile {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface IZipFile {
  filename: string;
  path: string;
  size: number;
}

export type TransferStatus = 'ready' | 'downloaded' | 'expired' | 'deleted';

export interface ITransfer extends Document {
  token: string;
  shareId: string;
  files: ITransferFile[];
  totalSize: number;
  status: TransferStatus;
  expiresAt: Date;
  downloadCount: number;
  maxDownloads: number;
  zipFile?: IZipFile;
  createdAt: Date;
  updatedAt: Date;
}

const TransferFileSchema = new Schema<ITransferFile>(
  {
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    path: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
  },
  { _id: false }
);

const ZipFileSchema = new Schema<IZipFile>(
  {
    filename: { type: String, required: true },
    path: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false }
);

const TransferSchema = new Schema<ITransfer>(
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
    files: {
      type: [TransferFileSchema],
      required: true,
      default: [],
    },
    totalSize: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['ready', 'downloaded', 'expired', 'deleted'],
      default: 'ready',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
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
    zipFile: {
      type: ZipFileSchema,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export const TransferModel = mongoose.model<ITransfer>('Transfer', TransferSchema);
