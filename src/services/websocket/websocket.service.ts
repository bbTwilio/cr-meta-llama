// WebSocket service - simplified without complex state management
import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../../config';
import { logger, logWebSocket } from '../../utils/logger';
import { MessageHandler } from './message.handler';
import { SessionManager } from '../conversation/session.manager';
import {
  SessionWebSocket,
  IncomingMessage,
  ResponseMessage,
  PongMessage,
  MessageType,
} from '../../types/websocket.types';

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private messageHandler: MessageHandler;
  private sessionManager: SessionManager;

  constructor(private server: HTTPServer) {
    this.sessionManager = SessionManager.getInstance();
    this.messageHandler = new MessageHandler();
  }

  async initialize(): Promise<void> {
    try {
      // Create WebSocket server
      this.wss = new WebSocketServer({
        server: this.server,
        path: config.websocket.path,
        maxPayload: config.websocket.maxPayload,
      });

      // Set up event handlers
      this.setupEventHandlers();

      logWebSocket('initialized', {
        path: config.websocket.path,
        maxPayload: config.websocket.maxPayload,
      });
    } catch (error) {
      logger.error('Failed to initialize WebSocket service', { error });
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: SessionWebSocket, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error });
    });
  }

  private handleConnection(ws: SessionWebSocket, request: any): void {
    const clientIp = request.socket.remoteAddress;

    logWebSocket('connection:opened', {
      ip: clientIp,
    });

    // Set up event handlers for this connection
    ws.on('message', async (data: Buffer) => {
      try {
        await this.handleMessage(ws, data);
      } catch (error) {
        logger.error('Error handling message', { error });
        this.sendError(ws, 'Failed to process message');
      }
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(ws, code, reason.toString());
    });

    ws.on('error', (error) => {
      logger.error('WebSocket connection error', {
        callSid: ws.callSid,
        error,
      });
    });

    ws.on('pong', () => {
      // Simple pong handler
      logger.debug('Pong received');
    });
  }

  private async handleMessage(ws: SessionWebSocket, data: Buffer): Promise<void> {
    try {
      // Parse incoming message
      const message: IncomingMessage = JSON.parse(data.toString());

      logWebSocket('message:received', {
        type: message.type,
        callSid: ws.callSid,
      });

      // Handle ping messages directly
      if (message.type === MessageType.PING) {
        const pong: PongMessage = {
          type: MessageType.PONG,
          sequenceNumber: message.sequenceNumber,
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(pong));
        return;
      }

      // Process message through handler
      const response = await this.messageHandler.handleMessage(message, ws);

      // Send response if available
      if (response) {
        this.sendResponse(ws, response);
      }
    } catch (error) {
      logger.error('Failed to handle WebSocket message', {
        error,
        callSid: ws.callSid,
      });
      this.sendError(ws, 'Invalid message format');
    }
  }

  private handleDisconnection(ws: SessionWebSocket, code: number, reason: string): void {
    logWebSocket('connection:closed', {
      callSid: ws.callSid,
      code,
      reason,
    });

    // End session if exists
    if (ws.callSid) {
      this.sessionManager.endSession(ws.callSid);
    }
  }

  public sendResponse(ws: SessionWebSocket, response: ResponseMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(response);
      ws.send(message);

      const tokenText = response.type === 'text' ? response.token : '';
      logger.debug('📤 Sent message', {
        callSid: ws.callSid,
        type: response.type,
        tokenLength: tokenText ? tokenText.length : 0,
      });

      logWebSocket('message:sent', {
        type: response.type,
        callSid: ws.callSid,
      });
    } else {
      logger.warn('Attempted to send message to closed connection', {
        callSid: ws.callSid,
      });
    }
  }

  public sendError(ws: SessionWebSocket, error: string): void {
    const response: ResponseMessage = {
      type: 'text',
      token: `Error: ${error}`,
      interruptible: true,
      last: true,
    };
    this.sendResponse(ws, response);
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket service...');

    // Close all connections
    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        ws.close(1000, 'Server shutting down');
      });

      // Close the WebSocket server
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          logger.info('WebSocket server closed');
          resolve();
        });
      });
    }

    // Clean up sessions
    this.sessionManager.shutdown();
  }

  // Utility methods
  public getActiveConnections(): number {
    return this.wss?.clients.size || 0;
  }

  public getActiveCallCount(): number {
    return this.sessionManager.getActiveCallCount();
  }
}