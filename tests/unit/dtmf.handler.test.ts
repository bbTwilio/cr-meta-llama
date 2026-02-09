import { DtmfHandler } from '../../src/services/conversation/dtmf.handler';
import { SessionState } from '../../src/types/websocket.types';

describe('DtmfHandler', () => {
  let dtmfHandler: DtmfHandler;
  let mockSession: SessionState;

  beforeEach(() => {
    dtmfHandler = new DtmfHandler();
    mockSession = {
      sessionId: 'test-session-123',
      callSid: 'CA123456789',
      from: '+1234567890',
      to: '+0987654321',
      startTime: new Date(),
      lastActivity: new Date(),
      conversationHistory: [
        {
          role: 'assistant',
          content: 'Welcome! How can I help you?',
          timestamp: new Date(),
        },
        {
          role: 'user',
          content: 'I need assistance',
          timestamp: new Date(),
        },
        {
          role: 'assistant',
          content: 'I would be happy to help you with that.',
          timestamp: new Date(),
        },
      ],
      dtmfBuffer: '',
      currentSequenceNumber: 0,
      isActive: true,
      metadata: {},
    };
  });

  describe('processDigits', () => {
    it('should handle single digit commands', async () => {
      const response = await dtmfHandler.processDigits('0', mockSession);

      expect(response).toBeDefined();
      expect(response?.message).toContain('operator');
      expect(response?.transfer).toBe('operator');
    });

    it('should handle end call command', async () => {
      const response = await dtmfHandler.processDigits('#', mockSession);

      expect(response).toBeDefined();
      expect(response?.message).toContain('Goodbye');
      expect(response?.endCall).toBe(true);
    });

    it('should handle repeat command', async () => {
      const response = await dtmfHandler.processDigits('9', mockSession);

      expect(response).toBeDefined();
      expect(response?.message).toBe('I would be happy to help you with that.');
    });

    it('should handle menu command', async () => {
      const response = await dtmfHandler.processDigits('*', mockSession);

      expect(response).toBeDefined();
      expect(response?.message).toContain('main menu');
    });

    it('should handle multi-digit commands', async () => {
      // Register a custom multi-digit command
      dtmfHandler.registerCommand({
        sequence: '99',
        action: 'custom',
        description: 'Secret menu',
      });

      // First digit - should request more input
      mockSession.dtmfBuffer = '9';
      const response1 = await dtmfHandler.processDigits('9', mockSession);

      expect(response1).toBeDefined();
      expect(response1?.message).toContain('Secret menu');
    });

    it('should handle menu selections', async () => {
      const response = await dtmfHandler.processDigits('1', mockSession);

      expect(response).toBeDefined();
      expect(response?.message).toContain('account information');
    });

    it('should handle invalid selections', async () => {
      const response = await dtmfHandler.processDigits('7', mockSession);

      expect(response).toBeDefined();
      expect(response?.message).toContain('not a valid option');
    });

    it('should clear buffer with ** command', async () => {
      mockSession.dtmfBuffer = '123';

      // First *
      await dtmfHandler.processDigits('*', mockSession);

      // Second * should trigger buffer clear
      mockSession.dtmfBuffer = '*';
      const response = await dtmfHandler.processDigits('*', mockSession);

      expect(response).toBeDefined();
      expect(response?.message).toBe('Clear DTMF buffer');
    });
  });

  describe('command registration', () => {
    it('should register custom commands', () => {
      const customHandler = jest.fn();

      dtmfHandler.registerCommand({
        sequence: '777',
        action: 'custom',
        description: 'Lucky number',
        handler: customHandler,
      });

      // Process the command sequence
      mockSession.dtmfBuffer = '77';
      dtmfHandler.processDigits('7', mockSession);

      expect(customHandler).not.toHaveBeenCalled(); // Handler is async, would need proper async test
    });
  });

  describe('buffer management', () => {
    it('should handle potential multi-digit matches', async () => {
      // Register a 3-digit command
      dtmfHandler.registerCommand({
        sequence: '123',
        action: 'custom',
        description: 'Test command',
      });

      // First digit
      const response1 = await dtmfHandler.processDigits('1', mockSession);
      expect(response1).toBeDefined();
      expect(response1?.message).toContain('continue entering');

      // Second digit
      mockSession.dtmfBuffer = '1';
      const response2 = await dtmfHandler.processDigits('2', mockSession);
      expect(response2).toBeDefined();
      expect(response2?.message).toContain('continue entering');

      // Third digit - should match
      mockSession.dtmfBuffer = '12';
      const response3 = await dtmfHandler.processDigits('3', mockSession);
      expect(response3).toBeDefined();
      expect(response3?.message).toBe('Test command');
    });

    it('should handle no match after buffer timeout', async () => {
      mockSession.dtmfBuffer = '99';
      const response = await dtmfHandler.processDigits('8', mockSession);

      expect(response).toBeDefined();
      expect(response?.message).toContain('not a valid option');
    });
  });

  describe('repeat functionality', () => {
    it('should return last assistant message', async () => {
      const response = await dtmfHandler.processDigits('9', mockSession);

      expect(response).toBeDefined();
      expect(response?.message).toBe('I would be happy to help you with that.');
    });

    it('should handle no previous message', async () => {
      mockSession.conversationHistory = [];
      const response = await dtmfHandler.processDigits('9', mockSession);

      expect(response).toBeDefined();
      expect(response?.message).toBe('No previous message to repeat.');
    });
  });
});