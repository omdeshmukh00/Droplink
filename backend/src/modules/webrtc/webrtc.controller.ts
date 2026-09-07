import { Request, Response } from 'express';
import { env } from '../../config/env';
import { HttpStatusCodes } from '../../constants/httpStatusCodes';
import { logger } from '../../utils/logger';

export class WebRtcController {
  public getIceConfig = (req: Request, res: Response): Response => {
    const isTurnOnly = req.query.turnOnly === 'true' || process.env.WEBRTC_FORCE_TURN_ONLY === 'true';

    const stunUrls = [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302',
      'stun:stun.services.mozilla.com',
    ];

    if (env.WEBRTC_STUN_URL && !stunUrls.includes(env.WEBRTC_STUN_URL)) {
      stunUrls.push(env.WEBRTC_STUN_URL);
    }

    const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [];

    if (!isTurnOnly) {
      iceServers.push({ urls: stunUrls });
    }

    if (env.WEBRTC_TURN_URL && env.WEBRTC_TURN_URL.trim().length > 0) {
      const turnUrls = env.WEBRTC_TURN_URL.split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      const turnEntry: { urls: string[]; username?: string; credential?: string } = {
        urls: turnUrls,
      };

      if (env.WEBRTC_TURN_USERNAME) {
        turnEntry.username = env.WEBRTC_TURN_USERNAME;
      }
      if (env.WEBRTC_TURN_CREDENTIAL) {
        turnEntry.credential = env.WEBRTC_TURN_CREDENTIAL;
      }

      iceServers.push(turnEntry);
    } else if (isTurnOnly) {
      // Fallback if TURN is forced but TURN config is missing: keep STUN
      iceServers.push({ urls: stunUrls });
    }

    const hasStun = iceServers.some((s) =>
      Array.isArray(s.urls) ? s.urls.some((u) => u.startsWith('stun:')) : String(s.urls).startsWith('stun:')
    );
    const hasTurn = iceServers.some((s) =>
      Array.isArray(s.urls) ? s.urls.some((u) => u.startsWith('turn:') || u.startsWith('turns:')) : false
    );
    const hasTurnUdp = iceServers.some((s) =>
      Array.isArray(s.urls)
        ? s.urls.some((u) => u.startsWith('turn:') && (!u.includes('transport=') || u.includes('transport=udp')))
        : false
    );
    const hasTurnTcp = iceServers.some((s) =>
      Array.isArray(s.urls) ? s.urls.some((u) => u.includes('transport=tcp')) : false
    );

    logger.info(
      `[TURN-TRACE] ICE config requested | turnOnly=${isTurnOnly} | STUN: ${hasStun} | TURN: ${hasTurn} | TURN UDP: ${hasTurnUdp} | TURN TCP: ${hasTurnTcp}`
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        iceServers,
        isTurnOnlyMode: isTurnOnly,
      },
    });
  };
}

export const webRtcController = new WebRtcController();
