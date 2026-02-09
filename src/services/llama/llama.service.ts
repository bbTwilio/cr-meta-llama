import { LlamaAPIClient } from 'llama-api-client';
import { config } from '../../config';
import { logger, logLlama } from '../../utils/logger';
import { StreamingHandler } from './streaming.handler';
import {
  ConversationEntry,
} from '../../types/websocket.types';

export class LlamaService {
  private client: LlamaAPIClient;
  private streamingHandler: StreamingHandler;
  private activeStreams: Map<string, AbortController>;

  constructor() {
    // Initialize SDK client with built-in retry logic
    this.client = new LlamaAPIClient({
      apiKey: config.llama.apiKey,
      timeout: 30000, // 30 seconds
      maxRetries: 3,  // SDK will retry up to 3 times for network/5XX errors
    });

    // Initialize streaming handler
    this.streamingHandler = new StreamingHandler();

    // Track active streams for cancellation
    this.activeStreams = new Map();
  }

  async generateResponse(
    userPrompt: string,
    conversationHistory: ConversationEntry[]
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // Build messages array for Llama
      const messages = this.buildMessages(userPrompt, conversationHistory);

      logLlama('request', {
        model: config.llama.model,
        messageCount: messages.length,
        maxTokens: config.llama.maxTokens,
      });

      // Make API call - SDK handles retries internally
      const response = await this.client.chat.completions.create({
        model: config.llama.model,
        messages,
        max_completion_tokens: config.llama.maxTokens,
        temperature: config.llama.temperature,
        stream: false,
      });

      const duration = Date.now() - startTime;
      logLlama('response', {
        duration,
        // Note: SDK v1 doesn't include usage info in basic response
      });

      const content = response.completion_message?.content;
      if (typeof content === 'string') {
        return content;
      } else if (content && typeof content === 'object' && 'text' in content) {
        return content.text;
      }
      return 'I apologize, but I was unable to generate a response.';
    } catch (error: any) {
      logger.error('Llama API error', { error });

      // Handle specific SDK error types with user-friendly messages
      if (error.name === 'RateLimitError') {
        return 'I apologize, but the service is currently experiencing high demand. Please try again in a moment.';
      } else if (error.name === 'AuthenticationError') {
        logger.error('Authentication failed with Llama API');
        return 'I apologize, but there is a configuration issue. Please contact support.';
      } else if (error.name === 'APIConnectionTimeoutError') {
        return 'I apologize, but the request timed out. Please try again.';
      } else if (error.name === 'InternalServerError') {
        return 'I apologize, but the service is temporarily unavailable. Please try again later.';
      }

      return 'I apologize, but I encountered an error. Please try again.';
    }
  }

  async generateStreamingResponse(
    userPrompt: string,
    conversationHistory: ConversationEntry[],
    sessionId: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const startTime = Date.now();
    const abortController = new AbortController();

    try {
      // Store abort controller for this session
      this.activeStreams.set(sessionId, abortController);

      // Build messages array for Llama
      const messages = this.buildMessages(userPrompt, conversationHistory);

      logLlama('stream:start', {
        sessionId,
        model: config.llama.model,
        messageCount: messages.length,
      });

      // Create streaming API call - SDK handles retries internally
      const stream = await this.client.chat.completions.create({
        model: config.llama.model,
        messages,
        max_completion_tokens: config.llama.maxTokens,
        temperature: config.llama.temperature,
        stream: true,
      }, {
        signal: abortController.signal,
      });

      // Process stream using async iterator
      let fullResponse = '';
      for await (const chunk of stream) {
        // Check if aborted
        if (abortController.signal.aborted) {
          break;
        }

        // Extract content from chunk based on event type
        if (chunk.event?.event_type === 'progress' && chunk.event?.delta?.type === 'text') {
          const content = (chunk.event.delta as any).text;
          if (content) {
            fullResponse += content;

            // Process through streaming handler for voice optimization
            const processedChunks = this.streamingHandler.bufferTokensForSpeech(content);
            for (const processedChunk of processedChunks) {
              const cleanChunk = this.streamingHandler.cleanForVoice(processedChunk);
              if (cleanChunk) {
                onChunk(cleanChunk);
              }
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      logLlama('stream:complete', {
        sessionId,
        duration,
        responseLength: fullResponse.length,
      });
    } catch (error: any) {
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        logLlama('stream:cancelled', { sessionId });
      } else {
        logger.error('Llama streaming error', { error, sessionId });

        // Handle specific SDK errors with user-friendly messages
        if (error.name === 'RateLimitError') {
          onChunk('I apologize, but the service is experiencing high demand. Please try again later.');
        } else if (error.name === 'AuthenticationError') {
          onChunk('I apologize, but there is a configuration issue. Please contact support.');
        } else if (error.name === 'APIConnectionTimeoutError') {
          onChunk('I apologize, but the connection timed out. Please try again.');
        } else if (error.name === 'InternalServerError') {
          onChunk('I apologize, but the service is temporarily unavailable.');
        } else {
          onChunk('I apologize, but I encountered an error while generating the response.');
        }
      }
    } finally {
      // Clean up
      this.activeStreams.delete(sessionId);
    }
  }

  async cancelStream(sessionId: string): Promise<void> {
    const controller = this.activeStreams.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(sessionId);
      logLlama('stream:abort', { sessionId });
    }
  }

  private buildMessages(
    userPrompt: string,
    conversationHistory: ConversationEntry[]
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Add system prompt
    messages.push({
      role: 'system',
      content: config.llama.systemPrompt,
    });

    // Add conversation history (last 10 messages to avoid token limit)
    const recentHistory = conversationHistory.slice(-10);
    for (const entry of recentHistory) {
      if (entry.role !== 'system') {
        messages.push({
          role: entry.role as 'user' | 'assistant',
          content: entry.content,
        });
      }
    }

    // Add current user prompt
    messages.push({
      role: 'user',
      content: userPrompt,
    });

    return messages;
  }

  // Utility method to validate API key
  async validateApiKey(): Promise<boolean> {
    try {
      // Try to list models to validate the API key
      const models = await this.client.models.list();
      return models && models.length > 0;
    } catch (error: any) {
      logger.error('Failed to validate Llama API key', { error });

      if (error.name === 'AuthenticationError') {
        logger.error('Invalid API key provided');
      }

      return false;
    }
  }

  // Get model information
  async getModelInfo(): Promise<any> {
    try {
      const model = await this.client.models.retrieve(config.llama.model);
      return model;
    } catch (error) {
      logger.error('Failed to get model info', { error });
      return null;
    }
  }
}