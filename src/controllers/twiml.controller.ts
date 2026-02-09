import { Request, Response } from 'express';
import twilio from 'twilio';
import { config, getWebSocketUrl } from '../config';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/error.handler';

const { VoiceResponse } = twilio.twiml;

// Validate Twilio webhook signature
const validateTwilioRequest = (req: Request): boolean => {
  if (config.server.nodeEnv === 'development') {
    // Skip validation in development
    return true;
  }

  const signature = req.header('X-Twilio-Signature');
  const url = `${config.publicUrl}${req.originalUrl}`;

  if (!signature) {
    logger.warn('Missing Twilio signature');
    return false;
  }

  const isValid = twilio.validateRequest(
    config.twilio.authToken,
    signature,
    url,
    req.body
  );

  if (!isValid) {
    logger.warn('Invalid Twilio signature', { url, signature });
  }

  return isValid;
};

// Handle incoming voice call
export const handleIncomingVoice = asyncHandler(
  async (req: Request, res: Response) => {
    // Validate request
    if (!validateTwilioRequest(req)) {
      return res.status(401).send('Unauthorized');
    }

    const { CallSid, From, To, CallStatus } = req.body;

    logger.info('Incoming voice call', {
      callSid: CallSid,
      from: From,
      to: To,
      status: CallStatus,
    });

    // Create TwiML response using raw XML for ConversationRelay
    // ConversationRelay is not yet fully supported in the SDK, so we build the XML directly
    const wsUrl = getWebSocketUrl();
    const welcomeGreeting = config.twilio.welcomeGreeting.replace(/"/g, '&quot;');

    const twimlXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay url="${wsUrl}" welcomeGreeting="${welcomeGreeting}" />
  </Connect>
</Response>`;

    // Set response headers
    res.set('Content-Type', 'text/xml');
    res.status(200).send(twimlXml);

    logger.info('TwiML response sent', {
      callSid: CallSid,
      websocketUrl: wsUrl,
      twiml: twimlXml,
    });
  }
);

// Handle Connect action callback
export const handleConnectAction = asyncHandler(
  async (req: Request, res: Response) => {
    // Validate request
    if (!validateTwilioRequest(req)) {
      return res.status(401).send('Unauthorized');
    }

    const { CallSid, CallStatus, CallDuration } = req.body;

    logger.info('Connect action callback', {
      callSid: CallSid,
      status: CallStatus,
      duration: CallDuration,
    });

    // Create TwiML response
    const twiml = new VoiceResponse();

    // If the conversation ended, hang up
    if (CallStatus === 'completed' || CallStatus === 'failed') {
      twiml.hangup();
    } else {
      // Fallback: Say goodbye and hang up
      twiml.say({
        voice: 'Polly.Joanna',
        language: 'en-US',
      }, 'Thank you for calling. Goodbye!');
      twiml.hangup();
    }

    // Set response headers
    res.set('Content-Type', 'text/xml');
    res.status(200).send(twiml.toString());
  }
);

// Handle call status callback
export const handleStatusCallback = asyncHandler(
  async (req: Request, res: Response) => {
    // Validate request
    if (!validateTwilioRequest(req)) {
      return res.status(401).send('Unauthorized');
    }

    const { CallSid, CallStatus, CallDuration, CallEndReason } = req.body;

    logger.info('Call status update', {
      callSid: CallSid,
      status: CallStatus,
      duration: CallDuration,
      endReason: CallEndReason,
    });

    // Acknowledge the callback
    res.status(200).send('OK');
  }
);

// Handle fallback for unmatched routes
export const handleFallback = asyncHandler(
  async (req: Request, res: Response) => {
    const { CallSid } = req.body;

    logger.warn('Fallback route hit', {
      callSid: CallSid,
      path: req.path,
      method: req.method,
    });

    // Create TwiML response
    const twiml = new VoiceResponse();
    twiml.say({
      voice: 'Polly.Joanna',
      language: 'en-US',
    }, 'We apologize, but we are experiencing technical difficulties. Please try again later.');
    twiml.hangup();

    // Set response headers
    res.set('Content-Type', 'text/xml');
    res.status(200).send(twiml.toString());
  }
);

// Health check endpoint
export const healthCheck = asyncHandler(
  async (req: Request, res: Response) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.server.nodeEnv,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        twilio: {
          configured: !!config.twilio.accountSid,
        },
        llama: {
          configured: !!config.llama.apiKey,
        },
        websocket: {
          url: getWebSocketUrl(),
        },
      },
    };

    res.status(200).json(health);
  }
);