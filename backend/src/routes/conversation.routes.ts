import { Router } from 'express';
import { ConversationController } from '../controllers/conversation.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate';
import { createConversationSchema, updateConversationSchema } from '../schemas/conversation.schema';

const router = Router();

// All conversation routes require authentication
router.use(requireAuth);

router.get('/', ConversationController.list);
router.post('/', validateBody(createConversationSchema), ConversationController.create);
router.get('/:id', ConversationController.getById);
router.patch('/:id', validateBody(updateConversationSchema), ConversationController.updateTitle);
router.delete('/:id', ConversationController.delete);

export default router;
