import { Request, Response } from 'express';
import { env } from '../../config/env';
import { HttpStatusCodes } from '../../constants/httpStatusCodes';

export class WebRtcController {
  public getIceConfig = (_req: Request, res: Response): Response => {
    const stunUrls = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];

    if (env.WEBRTC_STUN_URL && !stunUrls.includes(env.WEBRTC_STUN_URL)) {
      stunUrls.push(env.WEBRTC_STUN_URL);
    }

    const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
      {
        urls: stunUrls,
      },
    ];

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
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: {
        iceServers,
      },
    });
  };
}

export const webRtcController = new WebRtcController();
