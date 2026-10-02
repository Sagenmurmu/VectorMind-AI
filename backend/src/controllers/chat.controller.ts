import { Request, Response, NextFunction } from 'express';
import { ragService } from '../services/ai/rag.service';

export class ChatController {
  /**
   * POST /api/v1/chat
   * Stateless RAG Q&A endpoint returning grounded answer and source provenance.
   */
  public static async chat(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, message, messages, topK, documentId, minSimilarity } = req.body;

      // Support query, message, or last message in messages array
      let userQuery = query || message;
      if (!userQuery && Array.isArray(messages) && messages.length > 0) {
        const last = messages[messages.length - 1];
        userQuery = typeof last === 'string' ? last : last.content;
      }

      if (!userQuery || typeof userQuery !== 'string' || !userQuery.trim()) {
        res.status(400).json({
          success: false,
          error: 'Field "query" or "message" is required and must be a non-empty string.',
        });
        return;
      }

      const parsedTopK = topK ? parseInt(String(topK), 10) : undefined;
      const parsedMinSim = minSimilarity !== undefined ? parseFloat(String(minSimilarity)) : undefined;

      const result = await ragService.answerQuestion({
        query: userQuery.trim(),
        topK: parsedTopK,
        documentId: documentId ? String(documentId) : undefined,
        minSimilarity: parsedMinSim,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}
