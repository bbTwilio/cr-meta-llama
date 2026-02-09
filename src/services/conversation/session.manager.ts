// Simplified session management - just tracks active calls
import { logger } from '../../utils/logger';

export interface Session {
  callSid: string;
  from: string;
  to: string;
  startTime: Date;
  conversationHistory: Array<{ role: string; content: string }>;
}

export class SessionManager {
  private static instance: SessionManager;
  private sessions: Map<string, Session>;

  private constructor() {
    this.sessions = new Map();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  createSession(callSid: string, from: string, to: string): Session {
    const session: Session = {
      callSid,
      from,
      to,
      startTime: new Date(),
      conversationHistory: [],
    };

    this.sessions.set(callSid, session);
    logger.info('📞 Call started', { callSid, from, to });

    return session;
  }

  getSession(callSid: string): Session | undefined {
    return this.sessions.get(callSid);
  }

  addMessage(callSid: string, role: 'user' | 'assistant', content: string): void {
    const session = this.sessions.get(callSid);
    if (session) {
      session.conversationHistory.push({ role, content });

      // Keep only last 20 messages to prevent memory issues
      if (session.conversationHistory.length > 20) {
        session.conversationHistory = session.conversationHistory.slice(-20);
      }
    }
  }

  endSession(callSid: string): void {
    const session = this.sessions.get(callSid);
    if (session) {
      const duration = Date.now() - session.startTime.getTime();
      logger.info('📞 Call ended', {
        callSid,
        duration: Math.round(duration / 1000) + 's',
        messages: session.conversationHistory.length
      });
      this.sessions.delete(callSid);
    }
  }

  getActiveCallCount(): number {
    return this.sessions.size;
  }

  shutdown(): void {
    logger.info('Shutting down session manager');
    this.sessions.clear();
  }
}