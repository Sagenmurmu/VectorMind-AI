import { prisma } from '../../db/prisma';
import { AppError } from '../../middleware/errorHandler';

export class ConversationService {
  /**
   * Creates a new conversation owned by the authenticated user.
   */
  public async createConversation(userId: string, title?: string) {
    return prisma.conversation.create({
      data: {
        userId,
        title: title?.trim() || 'New Chat',
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  /**
   * Lists all conversations for a specific user, sorted by most recently active.
   */
  public async listUserConversations(userId: string) {
    return prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  /**
   * Retrieves a single conversation by ID with all stored messages, strictly scoped to user.
   */
  public async getConversation(userId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      const err: AppError = new Error(`Conversation '${conversationId}' not found.`);
      err.statusCode = 404;
      err.code = 'CONVERSATION_NOT_FOUND';
      throw err;
    }

    return conversation;
  }

  /**
   * Updates conversation title.
   */
  public async updateConversationTitle(userId: string, conversationId: string, title: string) {
    // Verify ownership first
    await this.getConversation(userId, conversationId);

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { title: title.trim() },
    });
  }

  /**
   * Deletes a conversation and all its messages.
   */
  public async deleteConversation(userId: string, conversationId: string) {
    // Verify ownership first
    await this.getConversation(userId, conversationId);

    return prisma.conversation.delete({
      where: { id: conversationId },
    });
  }

  /**
   * Fetches the last N messages of a conversation for multi-turn RAG context assembly.
   */
  public async getRecentMessages(conversationId: string, limit = 6) {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Reverse to return in chronological order
    return messages.reverse();
  }
}

export const conversationService = new ConversationService();
