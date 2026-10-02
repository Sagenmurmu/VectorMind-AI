import { Request, Response, NextFunction } from 'express';
import { conversationService } from '../services/conversation/conversation.service';

export class ConversationController {
  public static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const conversations = await conversationService.listUserConversations(userId);
      res.status(200).json({
        success: true,
        count: conversations.length,
        data: conversations,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { title } = req.body;
      const conversation = await conversationService.createConversation(userId, title);
      res.status(201).json({
        success: true,
        message: 'Conversation created.',
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const conversation = await conversationService.getConversation(userId, id);
      res.status(200).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async updateTitle(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { title } = req.body;
      const updated = await conversationService.updateConversationTitle(userId, id, title);
      res.status(200).json({
        success: true,
        message: 'Conversation title updated.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      await conversationService.deleteConversation(userId, id);
      res.status(200).json({
        success: true,
        message: `Conversation '${id}' deleted.`,
      });
    } catch (error) {
      next(error);
    }
  }
}
