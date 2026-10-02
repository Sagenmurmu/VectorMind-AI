import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', validateBody(registerSchema), AuthController.register);
router.post('/login', validateBody(loginSchema), AuthController.login);
router.get('/me', requireAuth, AuthController.me);

export default router;
