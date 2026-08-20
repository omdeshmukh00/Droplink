import { Schema, model, Document } from 'mongoose';

export interface IBulkFileMetadata extends Document {
  fileId: string;
  sessionId: string;
  participantId: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  size: number;
  status: 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'DELETED';
  createdAt: Date;
  completedAt?: Date;
}

const BulkFileMetadataSchema = new Schema<IBulkFileMetadata>(
  {
    fileId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    participantId: {
      type: String,
      required: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
    },
    size: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['UPLOADING', 'COMPLETED', 'FAILED', 'DELETED'],
      default: 'UPLOADING',
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const BulkFileMetadata = model<IBulkFileMetadata>('BulkFileMetadata', BulkFileMetadataSchema);
