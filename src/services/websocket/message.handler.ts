import {
  IncomingMessage,
  ResponseMessage,
  TextMessage,
  EndSessionMessage,
  SessionWebSocket,
  SetupMessage,
  PromptMessage,
  InterruptMessage,
  DtmfMessage,
  EndMessage,
  ErrorMessage,
  MessageType,
} from '../../types/websocket.types';
import { SessionManager } from '../conversation/session.manager';
import { LlamaService } from '../llama/llama.service';
import { logger } from '../../utils/logger';
import { config } from '../../config';

export class MessageHandler {
  private sessionManager: SessionManager;
  private llamaService: LlamaService;

  constructor() {
    this.sessionManager = SessionManager.getInstance();
    this.llamaService = new LlamaService();
  }

  async handleMessage(
    message: IncomingMessage,
    ws: SessionWebSocket
  ): Promise<ResponseMessage | null> {
    try {
      switch (message.type) {
        case MessageType.SETUP:
          return await this.handleSetup(message as SetupMessage, ws);

        case MessageType.PROMPT:
          return await this.handlePrompt(message as PromptMessage, ws);

        case MessageType.INTERRUPT:
          return this.handleInterrupt(message as InterruptMessage, ws);

        case MessageType.DTMF:
          return this.handleDtmf(message as DtmfMessage, ws);

        case MessageType.END:
          return this.handleEnd(message as EndMessage, ws);

        case MessageType.ERROR:
          this.handleError(message as ErrorMessage, ws);
          return null;

        default:
          logger.warn('Unknown message type', { type: (message as any).type });
          return null;
      }
    } catch (error) {
      logger.error('Error in message handler', {
        error,
        messageType: message.type,
        callSid: ws.callSid,
      });

      const errorResponse: TextMessage = {
        type: 'text',
        token: 'I apologize, but I encountered an error. Please try again.',
        interruptible: true,
        last: true,
      };
      return errorResponse;
    }
  }

  private async handleSetup(message: SetupMessage, ws: SessionWebSocket): Promise<ResponseMessage | null> {
    logger.info('📞 Setting up call', {
      callSid: message.callSid,
      from: message.from,
      to: message.to,
    });

    // Create simple session
    this.sessionManager.createSession(message.callSid, message.from, message.to);

    // Store call info on WebSocket
    ws.callSid = message.callSid;

    // Don't send greeting - it's handled by TwiML welcomeGreeting
    return null;
  }

  private async handlePrompt(message: PromptMessage, ws: SessionWebSocket): Promise<ResponseMessage | null> {
    if (!ws.callSid) {
      logger.error('Received prompt without callSid');
      return null;
    }

    const session = this.sessionManager.getSession(ws.callSid);
    if (!session) {
      logger.error('Session not found', { callSid: ws.callSid });
      return null;
    }

    logger.info('🎤 User said', {
      callSid: ws.callSid,
      prompt: message.voicePrompt,
    });

    // Add user message to history
    this.sessionManager.addMessage(ws.callSid, 'user', message.voicePrompt);

    try {
      // Get response from Llama (convert simple history to expected format)
      const conversationHistory = session.conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: new Date(),
      }));

      const response = await this.llamaService.generateResponse(
        message.voicePrompt,
        conversationHistory
      );

      logger.info('🤖 Assistant response', {
        callSid: ws.callSid,
        responseLength: response.length,
      });

      // Add assistant response to history
      this.sessionManager.addMessage(ws.callSid, 'assistant', response);

      // Return response
      const textResponse: TextMessage = {
        type: 'text',
        token: response,
        interruptible: config.features.enableInterruptions,
        last: true,
      };
      return textResponse;

    } catch (error) {
      logger.error('Failed to generate Llama response', {
        error,
        callSid: ws.callSid,
      });

      const errorResponse: TextMessage = {
        type: 'text',
        token: 'I apologize, but I had trouble processing that. Could you please try again?',
        interruptible: true,
        last: true,
      };
      return errorResponse;
    }
  }

  private handleInterrupt(message: InterruptMessage, ws: SessionWebSocket): ResponseMessage | null {
    logger.info('🛑 User interrupted', {
      callSid: ws.callSid,
      utterance: message.utteranceUntilInterrupt,
    });

    // Cancel any ongoing Llama streaming if implemented
    if (ws.callSid) {
      this.llamaService.cancelStream(ws.callSid);
    }

    // No response needed for interrupt
    return null;
  }

  private handleDtmf(message: DtmfMessage, ws: SessionWebSocket): ResponseMessage | null {
    if (!config.features.enableDtmf) {
      return null;
    }

    logger.info('📱 DTMF digit pressed', {
      callSid: ws.callSid,
      digit: message.digit,
    });

    // Simple DTMF handling
    let response = '';
    switch (message.digit) {
      case '#':
        // End call
        const endResponse: EndSessionMessage = {
          type: 'end',
        };
        return endResponse;

      case '*':
        response = 'You pressed star. How can I help you?';
        break;

      case '0':
        response = 'You pressed zero. Transferring to an operator is not available at this time.';
        break;

      default:
        response = `You pressed ${message.digit}. Please speak your request.`;
    }

    const textResponse: TextMessage = {
      type: 'text',
      token: response,
      interruptible: true,
      last: true,
    };
    return textResponse;
  }

  private handleEnd(message: EndMessage, ws: SessionWebSocket): ResponseMessage | null {
    if (ws.callSid) {
      logger.info('📞 Call ending', {
        callSid: ws.callSid,
        reason: message.reason,
      });

      // End the session
      this.sessionManager.endSession(ws.callSid);

      // Clean up
      ws.callSid = undefined;
    }

    return null;
  }

  private handleError(message: ErrorMessage, ws: SessionWebSocket): void {
    logger.warn('⚠️ Twilio error', {
      callSid: ws.callSid,
      description: message.description,
      code: message.code,
    });
  }
}