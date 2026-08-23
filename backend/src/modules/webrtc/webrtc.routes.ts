import { Router } from 'express';
import { webRtcController } from './webrtc.controller';

const router = Router();

router.get('/config', webRtcController.getIceConfig);
router.get('/ice-config', webRtcController.getIceConfig);

export const webRtcRoutes = router;
