import { Request, Response, NextFunction } from 'express';
import { bulkService } from '../services/bulk.service';

export class BulkController {
  public createSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { hostSocketId } = req.body;
      const clientOrigin = (req.get('origin') || req.get('referer') || '').trim();
      const result = await bulkService.createBulkSession(hostSocketId, clientOrigin);
      res.status(201).json({
        success: true,
        data: {
          sessionId: result.session.sessionId,
          bulkCode: result.session.bulkCode,
          shareUrl: result.shareUrl,
          status: result.session.status,
          settings: result.session.settings,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  public getSessionInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramVal = req.params.bulkCode;
      const bulkCode: string = (Array.isArray(paramVal) ? paramVal[0] : paramVal) || '';
      const session = await bulkService.getSessionByCode(bulkCode);

      if (!session) {
        res.status(404).json({
          success: false,
          error: { message: 'Bulk Session not found or closed' },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          bulkCode: session.bulkCode,
          status: session.status,
          participantCount: session.participantCount,
          maxParticipants: session.maxParticipants,
          settings: session.settings,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  public joinSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramVal = req.params.sessionId;
      const sessionId: string = (Array.isArray(paramVal) ? paramVal[0] : paramVal) || '';
      const { displayName, socketId } = req.body;

      if (!displayName || typeof displayName !== 'string') {
        res.status(400).json({
          success: false,
          error: { message: 'Display name is required' },
        });
        return;
      }

      const result = await bulkService.joinBulkSession(sessionId, displayName, socketId);
      res.status(200).json({
        success: true,
        data: {
          sessionId: result.session.sessionId,
          bulkCode: result.session.bulkCode,
          participantId: result.participant.participantId,
          displayName: result.participant.displayName,
          status: result.session.status,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join bulk session';
      res.status(400).json({
        success: false,
        error: { message },
      });
    }
  };

  public getSessionStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramVal = req.params.sessionId;
      const sessionId: string = (Array.isArray(paramVal) ? paramVal[0] : paramVal) || '';
      const session = await bulkService.getSessionByCode(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          error: { message: 'Session not found' },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          bulkCode: session.bulkCode,
          status: session.status,
          participantCount: session.participantCount,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  public endSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramVal = req.params.sessionId;
      const sessionId: string = (Array.isArray(paramVal) ? paramVal[0] : paramVal) || '';
      const session = await bulkService.closeSession(sessionId, 'Host manually ended session');

      if (!session) {
        res.status(404).json({
          success: false,
          error: { message: 'Bulk session not found or already closed' },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          status: session.status,
          closedAt: session.closedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

export const bulkController = new BulkController();
