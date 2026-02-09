import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Simplified configuration schema
const configSchema = z.object({
  server: z.object({
    port: z.number().min(1).max(65535),
    nodeEnv: z.enum(['development', 'production', 'test']),
  }),

  twilio: z.object({
    accountSid: z.string().startsWith('AC').length(34),
    authToken: z.string().min(32),
    welcomeGreeting: z.string().min(1).max(500),
  }),

  llama: z.object({
    apiKey: z.string().min(1),
    apiUrl: z.string().url(),
    model: z.string().min(1),
    maxTokens: z.number().min(1).max(4096),
    temperature: z.number().min(0).max(2),
    systemPrompt: z.string().min(1),
  }),

  websocket: z.object({
    path: z.string().min(1),
    maxPayload: z.number().min(1),
  }),

  publicUrl: z.string().url(),

  features: z.object({
    enableDtmf: z.boolean(),
    enableInterruptions: z.boolean(),
  }),

  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']),
    format: z.enum(['json', 'simple']),
  }),
});

// Load and validate configuration
function loadConfig() {
  try {
    const rawConfig = {
      server: {
        port: parseInt(process.env.PORT || '3000', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
      },
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: process.env.TWILIO_AUTH_TOKEN || '',
        welcomeGreeting: process.env.TWILIO_WELCOME_GREETING || 'Hello! How can I assist you today?',
      },
      llama: {
        apiKey: process.env.LLAMA_API_KEY || '',
        apiUrl: process.env.LLAMA_API_URL || 'https://api.llama.com/v1/chat/completions',
        model: process.env.LLAMA_MODEL || 'Llama-4-Maverick-17B-128E-Instruct-FP8',
        maxTokens: parseInt(process.env.LLAMA_MAX_TOKENS || '150', 10),
        temperature: parseFloat(process.env.LLAMA_TEMPERATURE || '0.7'),
        systemPrompt: process.env.LLAMA_SYSTEM_PROMPT || 'You are a helpful voice assistant. Keep responses concise and natural for voice conversation.',
      },
      websocket: {
        path: process.env.WS_PATH || '/ws',
        maxPayload: parseInt(process.env.WS_MAX_PAYLOAD || '1048576', 10),
      },
      publicUrl: process.env.PUBLIC_URL || 'http://localhost:3000',
      features: {
        enableDtmf: process.env.ENABLE_DTMF === 'true',
        enableInterruptions: process.env.ENABLE_INTERRUPTIONS === 'true',
      },
      logging: {
        level: process.env.LOG_LEVEL as any || 'info',
        format: process.env.LOG_FORMAT as any || 'simple',
      },
    };

    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.issues.forEach(issue => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

// Export configuration
export const config = loadConfig();

// Utility functions
export function getWebSocketUrl(): string {
  const url = new URL(config.publicUrl);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}${config.websocket.path}`;
}

// Type export
export type Config = z.infer<typeof configSchema>;