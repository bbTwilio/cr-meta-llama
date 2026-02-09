import { Router } from 'express';
import {
  handleIncomingVoice,
  handleConnectAction,
  handleStatusCallback,
  handleFallback,
  healthCheck,
} from '../controllers/twiml.controller';

const router = Router();

// Health check endpoint
router.get('/health', healthCheck);

// TwiML endpoints
router.post('/api/voice/incoming', handleIncomingVoice);
router.post('/api/voice/action', handleConnectAction);
router.post('/api/voice/status', handleStatusCallback);
router.post('/api/voice/fallback', handleFallback);

// Catch-all for voice endpoints
router.all('/api/voice/*', handleFallback);

export default router;