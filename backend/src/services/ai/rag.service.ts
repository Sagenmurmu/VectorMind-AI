import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { config } from '../../config';
import { vectorSearchService, SearchResultItem } from './vectorSearch.service';

export interface RagQueryInput {
  query: string;
  topK?: number;
  documentId?: string;
  minSimilarity?: number;
}

export interface RagSourceItem {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  fileName: string;
  chunkIndex: number;
  pageNumber: number | null;
  similarity: number;
  contentSnippet: string;
}

export interface RagResponse {
  answer: string;
  query: string;
  sources: RagSourceItem[];
  contextCount: number;
  model: string;
}

export class RagService {
  private google;

  constructor() {
    this.google = createGoogleGenerativeAI({
      apiKey: config.geminiApiKey,
    });
  }

  /**
   * Executes a complete RAG workflow:
   * Query -> Retrieval -> Context Construction -> LLM Completion -> Answer + Sources.
   */
  public async answerQuestion(input: RagQueryInput): Promise<RagResponse> {
    const trimmedQuery = input.query.trim();
    if (!trimmedQuery) {
      throw new Error('Query string must not be empty.');
    }

    // 1. Retrieve relevant chunks
    const retrievedChunks = await vectorSearchService.search(trimmedQuery, {
      limit: input.topK || 5,
      documentId: input.documentId,
      minSimilarity: input.minSimilarity,
    });

    // 2. Prepare structured sources
    const sources: RagSourceItem[] = retrievedChunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      fileName: chunk.fileName,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      similarity: chunk.similarity,
      contentSnippet: chunk.content.length > 200 ? chunk.content.slice(0, 200) + '...' : chunk.content,
    }));

    // 3. Assemble Grounding Context
    let contextBlock = '';
    if (retrievedChunks.length > 0) {
      contextBlock = retrievedChunks
        .map((chunk, idx) => {
          const pageInfo = chunk.pageNumber ? `, Page: ${chunk.pageNumber}` : '';
          return `[Source ${idx + 1}] "${chunk.documentTitle}" (${chunk.fileName}${pageInfo}, Chunk ${chunk.chunkIndex}, Similarity: ${(chunk.similarity * 100).toFixed(1)}%):\n${chunk.content}`;
        })
        .join('\n\n---\n\n');
    }

    // 4. Grounded System Prompt
    const systemPrompt = `You are a helpful and precise AI knowledge assistant for VectorMind.
Use the provided document context below to answer the user's question accurately.

Guidelines:
- Ground your answer strictly in the provided context.
- When referencing facts, you may cite which source provided them (e.g. [Source 1]).
- If the provided context does not contain enough information to answer the question, truthfully state that the uploaded documents do not contain this information. Do not invent or extrapolate ungrounded facts.
- Be concise, clear, and professional.`;

    const userPrompt = contextBlock
      ? `Provided Document Context:\n${contextBlock}\n\nUser Question: ${trimmedQuery}`
      : `No document context was found for this query.\n\nUser Question: ${trimmedQuery}`;

    // 5. Generate LLM Completion
    const { text: answer } = await generateText({
      model: this.google(config.ai.chatModel),
      system: systemPrompt,
      prompt: userPrompt,
    });

    return {
      answer,
      query: trimmedQuery,
      sources,
      contextCount: retrievedChunks.length,
      model: config.ai.chatModel,
    };
  }
}

export const ragService = new RagService();
