import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export const generateUUID = (): string => {
  return uuidv4();
};

/**
 * Generate human-friendly Share ID (9 characters)
 * Allowed characters: ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (excludes I, O, 0, 1)
 */
export const generateShareId = (): string => {
  const allowedChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const length = 9;
  const randomBytes = crypto.randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    const byte = randomBytes[i];
    if (byte !== undefined) {
      result += allowedChars[byte % allowedChars.length];
    }
  }

  return result;
};

/**
 * Formats internal Share ID (ABC92LKJD) into display format (ABC-92L-KJD)
 */
export const formatShareId = (shareId: string): string => {
  const clean = normalizeShareId(shareId);
  if (clean.length !== 9) return shareId;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
};

/**
 * Normalizes input Share ID by removing hyphens/whitespace and converting to uppercase
 */
export const normalizeShareId = (input: string): string => {
  return (input || '').replace(/[\s-]/g, '').toUpperCase();
};

/**
 * Generates cryptographically secure 64-char hex token
 */
export const generateTransferToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};
