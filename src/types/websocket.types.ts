import { WebSocket } from 'ws';
import type {
  CompletionCreateParams,
  CreateChatCompletionResponse,
  CreateChatCompletionResponseStreamChunk
} from 'llama-api-client/resources/chat/index';

// Twilio ConversationRelay message types
export enum MessageType {
  SETUP = 'setup',
  PROMPT = 'prompt',
  INTERRUPT = 'interrupt',
  DTMF = 'dtmf',
  END = 'end',
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',  // Twilio sends error messages for various status updates
}

// Base message structure
export interface BaseMessage {
  type: MessageType;
  sequenceNumber: number;
}

// Setup message from Twilio (sent upon connection)
export interface SetupMessage extends BaseMessage {
  type: MessageType.SETUP;
  sessionId: string;
  accountSid: string;
  callSid: string;
  parentCallSid?: string;
  from: string;
  to: string;
  forwardedFrom?: string;
  callType?: string;
  callerName?: string;
  direction: 'inbound' | 'outbound-api' | 'trunking-origination' | 'trunking-termination';
  callStatus: string;
  customParameters?: Record<string, any>;
}

// User voice input message (when caller speaks)
export interface PromptMessage extends BaseMessage {
  type: MessageType.PROMPT;
  voicePrompt: string;  // The transcribed text from the caller
  lang?: string;  // Language of the transcription
  last?: boolean;  // Whether this is the last prompt in a sequence
}

// Interrupt message when caller interrupts TTS
export interface InterruptMessage extends BaseMessage {
  type: MessageType.INTERRUPT;
  utteranceUntilInterrupt?: string;  // Text that was spoken before interruption
  durationUntilInterruptMs?: number;  // Duration before interruption in milliseconds
}

// DTMF (touch-tone) input message
export interface DtmfMessage extends BaseMessage {
  type: MessageType.DTMF;
  digit: string;  // Single DTMF digit (0-9, *, #)
}

// Call end message (not documented but may be sent)
export interface EndMessage extends BaseMessage {
  type: MessageType.END;
  reason?: 'hangup' | 'error' | 'timeout';
  callDuration?: number;
  errorCode?: string;
  errorMessage?: string;
}

// Heartbeat messages
export interface PingMessage extends BaseMessage {
  type: MessageType.PING;
  timestamp: number;
}

export interface PongMessage extends BaseMessage {
  type: MessageType.PONG;
  timestamp: number;
}

// Error message from Twilio (for session errors)
export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  description: string;  // Error description
  code?: string;  // Error code (e.g., "64107")
}

// Union type for all incoming messages
export type IncomingMessage =
  | SetupMessage
  | PromptMessage
  | InterruptMessage
  | DtmfMessage
  | EndMessage
  | PingMessage
  | ErrorMessage;

// Response message structure to Twilio ConversationRelay
export interface TextMessage {
  type: 'text';
  token: string;  // The text content to be spoken
  last?: boolean;  // Whether this is the last token
  lang?: string;  // Language code (e.g., "en-US")
  interruptible?: boolean;  // Whether the TTS can be interrupted
  preemptible?: boolean;  // Whether the message can be preempted
}

export interface PlayMessage {
  type: 'play';
  source: string;  // URL of media to play
  loop?: number;
  interruptible?: boolean;
  preemptible?: boolean;
}

export interface SendDigitsMessage {
  type: 'sendDigits';
  digits: string;  // DTMF digits to send
}

export interface LanguageMessage {
  type: 'language';
  ttsLanguage?: string;
  transcriptionLanguage?: string;
}

export interface EndSessionMessage {
  type: 'end';
  handoffData?: string;
}

// Union type for all response messages to Twilio
export type ResponseMessage = TextMessage | PlayMessage | SendDigitsMessage | LanguageMessage | EndSessionMessage;

// Session state management
export interface SessionState {
  sessionId: string;
  callSid: string;
  from: string;
  to: string;
  startTime: Date;
  lastActivity: Date;
  conversationHistory: ConversationEntry[];
  dtmfBuffer: string;
  currentSequenceNumber: number;
  isActive: boolean;
  metadata: Record<string, any>;
  pendingInterruption?: boolean;
  currentStreamId?: string;
}

// Conversation history entry
export interface ConversationEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    confidence?: number;
    duration?: number;
    interrupted?: boolean;
    lang?: string;  // Language code for transcription
    last?: boolean;  // Whether this was the last message in a sequence
  };
}

// WebSocket connection with session
export interface SessionWebSocket extends WebSocket {
  sessionId?: string;
  callSid?: string;
  isAlive?: boolean;
  lastPing?: number;
}

// Llama API request/response types - using SDK types
export type LlamaRequest = CompletionCreateParams & {
  // Additional custom fields if needed
};

export type LlamaResponse = CreateChatCompletionResponse & {
  // Additional custom fields if needed
};

// Streaming response chunk
export type LlamaStreamChunk = CreateChatCompletionResponseStreamChunk & {
  // Additional custom fields if needed
};

// Error types
export interface WebSocketError {
  code: string;
  message: string;
  details?: any;
}

// Event emitter events
export interface WebSocketEvents {
  'session:created': (session: SessionState) => void;
  'session:updated': (session: SessionState) => void;
  'session:ended': (sessionId: string, reason: string) => void;
  'message:received': (message: IncomingMessage, sessionId: string) => void;
  'message:sent': (message: ResponseMessage, sessionId: string) => void;
  'error': (error: WebSocketError, sessionId?: string) => void;
  'connection:opened': (ws: SessionWebSocket) => void;
  'connection:closed': (ws: SessionWebSocket, code: number, reason: string) => void;
}

// DTMF command mappings
export interface DtmfCommand {
  sequence: string;
  action: 'end_call' | 'transfer' | 'menu' | 'repeat' | 'custom';
  description: string;
  handler?: (session: SessionState) => Promise<void>;
}

// Rate limiting
export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Metrics
export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  averageSessionDuration: number;
  totalMessages: number;
  llmaCalls: number;
  errors: number;
  dtmfCommands: number;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
}

// Type guards
export function isSetupMessage(msg: any): msg is SetupMessage {
  return msg?.type === MessageType.SETUP && typeof msg.callSid === 'string';
}

export function isPromptMessage(msg: any): msg is PromptMessage {
  return msg?.type === MessageType.PROMPT && typeof msg.voicePrompt === 'string';
}

export function isInterruptMessage(msg: any): msg is InterruptMessage {
  return msg?.type === MessageType.INTERRUPT;
}

export function isDtmfMessage(msg: any): msg is DtmfMessage {
  return msg?.type === MessageType.DTMF && typeof msg.digit === 'string';
}

export function isEndMessage(msg: any): msg is EndMessage {
  return msg?.type === MessageType.END;
}

export function isPingMessage(msg: any): msg is PingMessage {
  return msg?.type === MessageType.PING;
}

export function isErrorMessage(msg: any): msg is ErrorMessage {
  return msg?.type === MessageType.ERROR;
}