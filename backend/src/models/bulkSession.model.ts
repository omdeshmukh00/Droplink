import { Schema, model, Document } from 'mongoose';

export type BulkSessionStatus = 'CREATING' | 'ACTIVE' | 'ENDING' | 'CLOSED' | 'FAILED';

export interface IBulkSession extends Document {
  sessionId: string;
  bulkCode: string; // 9-digit numeric string
  status: BulkSessionStatus;
  hostSocketId?: string;
  lastHostHeartbeat: Date;
  createdAt: Date;
  closedAt?: Date;
  participantCount: number;
  maxParticipants: number;
  settings: {
    autoVerify: boolean;
    requireHostVerification: boolean;
    verificationCode?: string;
  };
}

const BulkSessionSchema = new Schema<IBulkSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    bulkCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['CREATING', 'ACTIVE', 'ENDING', 'CLOSED', 'FAILED'],
      default: 'CREATING',
      required: true,
    },
    hostSocketId: {
      type: String,
      default: null,
    },
    lastHostHeartbeat: {
      type: Date,
      default: Date.now,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    participantCount: {
      type: Number,
      default: 0,
    },
    maxParticipants: {
      type: Number,
      default: 50,
    },
    settings: {
      autoVerify: { type: Boolean, default: true },
      requireHostVerification: { type: Boolean, default: false },
      verificationCode: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

export const BulkSession = model<IBulkSession>('BulkSession', BulkSessionSchema);
