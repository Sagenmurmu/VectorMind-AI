import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { optionalAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate';
import { chatRequestSchema } from '../schemas/chat.schema';

const router = Router();

router.post('/', optionalAuth, validateBody(chatRequestSchema), ChatController.chat);

export default router;

