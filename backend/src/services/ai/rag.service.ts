import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { config } from '../../config';
import { prisma } from '../../db/prisma';
import { vectorSearchService } from './vectorSearch.service';
import { conversationService } from '../conversation/conversation.service';

export interface RagQueryInput {
  query: string;
  userId?: string;
  conversationId?: string;
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
  citations: RagSourceItem[];
  contextCount: number;
  model: string;
  conversationId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
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
   * Multi-Turn History -> User Message Persistence -> User-Scoped Retrieval -> Context Construction -> LLM Completion -> Assistant Message Persistence.
   */
  public async answerQuestion(input: RagQueryInput): Promise<RagResponse> {
    const trimmedQuery = input.query.trim();
    if (!trimmedQuery) {
      throw new Error('Query string must not be empty.');
    }

    let userMessageId: string | undefined;
    let assistantMessageId: string | undefined;
    let conversationHistoryText = '';

    // 1. If conversationId is supplied, verify ownership, load history, and persist user message
    if (input.conversationId && input.userId) {
      // Verifies conversation belongs to user
      await conversationService.getConversation(input.userId, input.conversationId);

      // Fetch last 6 messages for multi-turn history
      const recentMessages = await conversationService.getRecentMessages(input.conversationId, 6);
      if (recentMessages.length > 0) {
        conversationHistoryText =
          'Recent Conversation History:\n' +
          recentMessages
            .map((m) => `${m.role === 'USER' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n') +
          '\n\n';
      }

      // Persist the user message
      const userMsg = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          role: 'USER',
          content: trimmedQuery,
        },
      });
      userMessageId = userMsg.id;
    }

    // 2. Retrieve relevant chunks strictly scoped to the user's documents
    const retrievedChunks = await vectorSearchService.search(trimmedQuery, {
      limit: input.topK || 5,
      documentId: input.documentId,
      userId: input.userId,
      minSimilarity: input.minSimilarity,
    });

    // 3. Prepare structured sources
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

    // 4. Assemble Grounding Context
    let contextBlock = '';
    if (retrievedChunks.length > 0) {
      contextBlock = retrievedChunks
        .map((chunk, idx) => {
          const pageInfo = chunk.pageNumber ? `, Page: ${chunk.pageNumber}` : '';
          return `[Source ${idx + 1}] "${chunk.documentTitle}" (${chunk.fileName}${pageInfo}, Chunk ${chunk.chunkIndex}, Similarity: ${(chunk.similarity * 100).toFixed(1)}%):\n${chunk.content}`;
        })
        .join('\n\n---\n\n');
    }

    // 5. Grounded System Prompt
    const systemPrompt = `You are a helpful and precise AI knowledge assistant for VectorMind.
Use the provided document context below to answer the user's question accurately.

Guidelines:
- Ground your answer strictly in the provided document context when available.
- When referencing facts, you may cite which source provided them (e.g. [Source 1]).
- If the provided context does not contain enough information to answer the question, truthfully state that the uploaded documents do not contain this information. Do not invent or extrapolate ungrounded facts.
- Take into account the recent conversation history to resolve follow-up questions naturally.
- Be concise, clear, and professional.`;

    let userPrompt = '';
    if (conversationHistoryText) {
      userPrompt += `${conversationHistoryText}`;
    }
    if (contextBlock) {
      userPrompt += `Provided Document Context:\n${contextBlock}\n\n`;
    } else {
      userPrompt += `No document context was found for this query.\n\n`;
    }
    userPrompt += `User Question: ${trimmedQuery}`;

    // 6. Generate LLM Completion
    const { text: answer } = await generateText({
      model: this.google(config.ai.chatModel),
      system: systemPrompt,
      prompt: userPrompt,
    });

    // 7. Persist assistant message with citations if conversationId is present
    if (input.conversationId && input.userId) {
      const assistantMsg = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          role: 'ASSISTANT',
          content: answer,
          citations: sources as any,
        },
      });
      assistantMessageId = assistantMsg.id;

      // Update conversation timestamp and set title if it was default
      const conv = await prisma.conversation.findUnique({ where: { id: input.conversationId } });
      const newTitle =
        conv?.title === 'New Chat'
          ? trimmedQuery.slice(0, 40) + (trimmedQuery.length > 40 ? '...' : '')
          : undefined;

      await prisma.conversation.update({
        where: { id: input.conversationId },
        data: {
          updatedAt: new Date(),
          ...(newTitle ? { title: newTitle } : {}),
        },
      });
    }

    return {
      answer,
      query: trimmedQuery,
      sources,
      citations: sources,
      contextCount: retrievedChunks.length,
      model: config.ai.chatModel,
      conversationId: input.conversationId,
      userMessageId,
      assistantMessageId,
    };
  }
}

export const ragService = new RagService();
