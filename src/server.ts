import express, { Express } from 'express';
import { createServer } from 'http';
import { config } from './config';
import { logger, logStartupBanner, logStatus } from './utils/logger';
import { errorHandler } from './utils/error.handler';
import twimlRoutes from './routes/twiml.routes';
import { WebSocketService } from './services/websocket/websocket.service';

// Initialize Express app
const app: Express = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logging
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      logger.warn(`🌐 ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    } else if (config.logging.level === 'debug') {
      logger.debug(`🌐 ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    }
  });

  next();
});

// Routes
app.use('/', twimlRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeCalls: wsService.getActiveCallCount(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
    path: req.path,
  });
});

// Error handler middleware (must be last)
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket service
const wsService = new WebSocketService(server);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.warn(`⚠️  Received ${signal}, shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('✅ HTTP server closed');
  });

  // Close WebSocket connections
  await wsService.shutdown();

  // Exit
  logger.info('✅ Shutdown complete');
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Show startup banner
    logStartupBanner();

    // Initialize WebSocket service
    logStatus.starting('WebSocket Service');
    await wsService.initialize();
    logStatus.ready('WebSocket Service');

    // Start HTTP server
    logStatus.starting('HTTP Server');
    server.listen(config.server.port, () => {
      logStatus.ready('Server', {
        port: config.server.port,
        environment: config.server.nodeEnv,
      });

      // Log simplified configuration
      logger.info('📋 Configuration', {
        twilio: {
          welcomeGreeting: config.twilio.welcomeGreeting,
        },
        llama: {
          model: config.llama.model,
          maxTokens: config.llama.maxTokens,
        },
        features: {
          dtmf: config.features.enableDtmf,
          interruptions: config.features.enableInterruptions,
        },
      });

      // Ready message
      console.log('');
      logger.info('🎉 Server is ready to handle calls!');
      logger.info(`📞 Configure your Twilio number to: ${config.publicUrl}/api/voice/incoming`);
      console.log('');
    });
  } catch (error) {
    logStatus.failed('Server', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export { app, server };