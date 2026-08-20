import { Schema, model, Document } from 'mongoose';

export interface IBulkParticipant extends Document {
  participantId: string;
  sessionId: string;
  displayName: string;
  socketId?: string;
  joinedAt: Date;
  lastSeenAt: Date;
  status: 'CONNECTED' | 'DISCONNECTED' | 'LEFT';
  filesUploaded: number;
  totalBytesUploaded: number;
}

const BulkParticipantSchema = new Schema<IBulkParticipant>(
  {
    participantId: {
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
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    socketId: {
      type: String,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['CONNECTED', 'DISCONNECTED', 'LEFT'],
      default: 'CONNECTED',
    },
    filesUploaded: {
      type: Number,
      default: 0,
    },
    totalBytesUploaded: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const BulkParticipant = model<IBulkParticipant>('BulkParticipant', BulkParticipantSchema);
