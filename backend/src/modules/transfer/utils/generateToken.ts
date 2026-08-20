import crypto from 'crypto';

/**
 * Generates a cryptographically secure random transfer token (64 hex characters).
 */
export function generateTransferToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
