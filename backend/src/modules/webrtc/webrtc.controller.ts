import { Request, Response } from 'express';
import { env } from '../../config/env';
import { HttpStatusCodes } from '../../constants/httpStatusCodes';
import { logger } from '../../utils/logger';
import { webRtcService } from './webrtc.service';

export class WebRtcController {
  public getIceConfig = async (req: Request, res: Response): Promise<Response> => {
    try {
      const isTurnOnly = req.query.turnOnly === 'true' || process.env.WEBRTC_FORCE_TURN_ONLY === 'true';
      const iceServers = await webRtcService.getIceServers(isTurnOnly);

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
        `[TURN-TRACE] ICE config requested | provider=${env.TURN_PROVIDER} | turnOnly=${isTurnOnly} | STUN: ${hasStun} | TURN: ${hasTurn} | TURN UDP: ${hasTurnUdp} | TURN TCP: ${hasTurnTcp}`
      );

      return res.status(HttpStatusCodes.OK).json({
        success: true,
        data: {
          iceServers,
          isTurnOnlyMode: isTurnOnly,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[WebRTC] Failed to retrieve ICE config: ${errorMessage}`);

      return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to retrieve WebRTC ICE configuration',
      });
    }
  };
}

export const webRtcController = new WebRtcController();

