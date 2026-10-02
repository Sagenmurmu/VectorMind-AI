import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';
import { config } from '../../config';

export class EmbeddingService {
  private embeddingModel;
  private readonly expectedDimensions: number;

  constructor() {
    this.expectedDimensions = config.ai.embeddingDimensions;

    if (!config.geminiApiKey) {
      console.warn(
        '[EmbeddingService] Warning: Neither GOOGLE_GENERATIVE_AI_API_KEY nor GEMINI_API_KEY is configured in backend environment.'
      );
    }

    const google = createGoogleGenerativeAI({
      apiKey: config.geminiApiKey,
    });

    this.embeddingModel = google.textEmbeddingModel(config.ai.embeddingModel);
  }

  /**
   * Generates a single vector embedding for a query string.
   */
  public async embedQuery(queryText: string): Promise<number[]> {
    if (!queryText.trim()) {
      throw new Error('Cannot embed empty query text');
    }

    const { embedding } = await embed({
      model: this.embeddingModel,
      value: queryText.trim(),
    });

    this.assertDimensions(embedding, 'single query');
    return embedding;
  }

  /**
   * Generates vector embeddings for a batch of text chunks.
   */
  public async embedBatch(chunks: string[]): Promise<number[][]> {
    if (!chunks.length) {
      return [];
    }

    // Google API supports batching via embedMany
    const { embeddings } = await embedMany({
      model: this.embeddingModel,
      values: chunks,
    });

    for (let i = 0; i < embeddings.length; i++) {
      this.assertDimensions(embeddings[i], `chunk index ${i}`);
    }

    return embeddings;
  }

  /**
   * Strictly asserts that the returned vector dimension matches the database schema.
   */
  private assertDimensions(vector: number[], context: string): void {
    if (vector.length !== this.expectedDimensions) {
      throw new Error(
        `[EmbeddingService] Dimension mismatch in ${context}: received ${vector.length} dimensions, expected ${this.expectedDimensions}.`
      );
    }
  }
}

export const embeddingService = new EmbeddingService();
