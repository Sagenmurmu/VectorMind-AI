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

      const isStreaming = req.body.stream === true || req.headers.accept === 'text/event-stream';

      if (isStreaming) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        if (typeof (res as any).flushHeaders === 'function') {
          (res as any).flushHeaders();
        }

        try {
          const streamResult = await ragService.streamQuestion({
            query: userQuery.trim(),
            userId,
            conversationId,
            topK: parsedTopK,
            documentId: documentId ? String(documentId) : undefined,
            minSimilarity: parsedMinSim,
          });

          // 1. Emit metadata event
          res.write(
            `data: ${JSON.stringify({
              type: 'metadata',
              conversationId: streamResult.conversationId,
              sources: streamResult.sources,
              citations: streamResult.citations,
              model: streamResult.model,
              userMessageId: streamResult.userMessageId,
            })}\n\n`
          );

          let fullAnswer = '';

          // 2. Stream individual tokens
          for await (const chunk of streamResult.textStream) {
            fullAnswer += chunk;
            res.write(
              `data: ${JSON.stringify({
                type: 'chunk',
                text: chunk,
              })}\n\n`
            );
          }

          // 3. Finalize message persistence and conversation update
          const { assistantMessageId } = await streamResult.finalize(fullAnswer);

          // 4. Emit done event
          res.write(
            `data: ${JSON.stringify({
              type: 'done',
              assistantMessageId,
              fullAnswer,
            })}\n\n`
          );

          res.end();
          return;
        } catch (streamErr: any) {
          console.error('[ChatController] Streaming error:', streamErr);
          res.write(
            `data: ${JSON.stringify({
              type: 'error',
              error: streamErr.message || 'Stream generation failed.',
            })}\n\n`
          );
          res.end();
          return;
        }
      }

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
