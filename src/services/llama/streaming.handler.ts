import { logger } from '../../utils/logger';

export class StreamingHandler {
  // Token buffering for smooth speech synthesis
  bufferTokensForSpeech(text: string, bufferSize: number = 5): string[] {
    const sentences: string[] = [];
    const sentenceEnders = /[.!?]/;
    const words = text.split(' ');
    let currentSentence = '';
    let wordCount = 0;

    for (const word of words) {
      currentSentence += (currentSentence ? ' ' : '') + word;
      wordCount++;

      // Check if we have a complete sentence or reached buffer size
      if (sentenceEnders.test(word) || wordCount >= bufferSize) {
        sentences.push(currentSentence.trim());
        currentSentence = '';
        wordCount = 0;
      }
    }

    // Add any remaining text
    if (currentSentence.trim()) {
      sentences.push(currentSentence.trim());
    }

    return sentences;
  }

  // Clean text for voice synthesis
  cleanForVoice(text: string): string {
    // Remove markdown formatting
    text = text.replace(/\*\*/g, ''); // Bold
    text = text.replace(/\*/g, ''); // Italic
    text = text.replace(/```[\s\S]*?```/g, ''); // Code blocks
    text = text.replace(/`([^`]+)`/g, '$1'); // Inline code
    text = text.replace(/#{1,6}\s/g, ''); // Headers
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links

    // Remove special characters that don't sound good in speech
    text = text.replace(/[<>]/g, '');
    text = text.replace(/&/g, ' and ');
    text = text.replace(/@/g, ' at ');
    text = text.replace(/#/g, ' number ');

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ');
    text = text.trim();

    return text;
  }

  // Split response into speakable chunks
  splitIntoSpeakableChunks(text: string, maxLength: number = 200): string[] {
    const cleanText = this.cleanForVoice(text);
    const sentences = cleanText.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + ' ' + sentence).length <= maxLength) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  // Process streaming response for optimal voice output
  async processStreamingResponse(
    text: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      // Split into speakable chunks
      const chunks = this.splitIntoSpeakableChunks(text);

      // Send each chunk for voice synthesis
      for (const chunk of chunks) {
        if (chunk.trim()) {
          onChunk(chunk);
        }
      }
    } catch (error) {
      logger.error('Error processing streaming response', { error });
    }
  }
}