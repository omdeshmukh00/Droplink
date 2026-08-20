import crypto from 'crypto';

const ALPHANUMERIC = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Base32 unambiguous characters

/**
 * Generates an unformatted Share ID (9 uppercase alphanumeric characters, e.g. ABC92LKJD).
 */
export function generateShareId(length = 9): string {
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    const randomIndex = (bytes[i] || 0) % ALPHANUMERIC.length;
    result += ALPHANUMERIC[randomIndex];
  }
  return result;
}

/**
 * Formats an unformatted Share ID for client display (e.g. ABC92LKJD -> ABC-92L-KJD).
 */
export function formatShareId(shareId: string): string {
  const clean = normalizeShareId(shareId);
  if (clean.length !== 9) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
}

/**
 * Normalizes a Share ID input by removing dashes, spaces, and converting to uppercase.
 */
export function normalizeShareId(input: string): string {
  if (!input) return '';
  return input.replace(/[\s-]/g, '').toUpperCase();
}
