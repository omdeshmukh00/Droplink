import { QRPayloadDto } from '../dto/transfer.dto';
import { formatShareId } from './generateShareId';
import { env } from '../../../config/env';

/**
 * Builds standard QR code payload for a transfer.
 */
export function buildQRPayload(token: string, rawShareId: string): QRPayloadDto {
  const formattedShareId = formatShareId(rawShareId);
  const clientBase = env.CLIENT_URL.replace(/\/$/, '');
  const shareUrl = `${clientBase}/t/${token}`;

  return {
    shareUrl,
    shareId: formattedShareId,
    transferToken: token,
  };
}
