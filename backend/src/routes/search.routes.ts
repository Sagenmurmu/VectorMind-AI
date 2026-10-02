import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { optionalAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate';
import { searchRequestSchema } from '../schemas/search.schema';

const router = Router();

router.post('/', optionalAuth, validateBody(searchRequestSchema), SearchController.search);

export default router;

