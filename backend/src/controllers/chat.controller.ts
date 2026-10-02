import { Request, Response, NextFunction } from 'express';
import { ragService } from '../services/ai/rag.service';
import { conversationService } from '../services/conversation/conversation.service';

export class ChatController {
  /**
   * POST /api/v1/chat
   * RAG Q&A endpoint supporting persistent conversations, multi-turn history, and citations.
   */
  public static async chat(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, message, messages, topK, documentId, minSimilarity } = req.body;
      let conversationId = req.body.conversationId;

      // Support query, message, or last item in messages array
      let userQuery = query || message;
      if (!userQuery && Array.isArray(messages) && messages.length > 0) {
        const last = messages[messages.length - 1];
        userQuery = typeof last === 'string' ? last : last.content;
      }

      if (!userQuery || typeof userQuery !== 'string' || !userQuery.trim()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Field "query" or "message" is required and must be a non-empty string.',
          },
        });
        return;
      }

      const userId = req.user?.id;

      // Auto-create a conversation if authenticated user did not supply one
      if (userId && !conversationId) {
        const autoConv = await conversationService.createConversation(
          userId,
          userQuery.trim().slice(0, 40)
        );
        conversationId = autoConv.id;
      }

      const parsedTopK = topK ? parseInt(String(topK), 10) : undefined;
      const parsedMinSim = minSimilarity !== undefined ? parseFloat(String(minSimilarity)) : undefined;

      const result = await ragService.answerQuestion({
        query: userQuery.trim(),
        userId,
        conversationId,
        topK: parsedTopK,
        documentId: documentId ? String(documentId) : undefined,
        minSimilarity: parsedMinSim,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
