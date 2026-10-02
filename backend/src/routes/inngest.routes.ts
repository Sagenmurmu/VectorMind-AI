import { Router } from 'express';
import { serve } from 'inngest/express';
import { inngest } from '../inngest/client';
import { ingestDocumentFunction } from '../inngest/functions/ingestDocument';

const router = Router();

// Inngest endpoint mounting GET, POST, and PUT handlers
router.use(
  '/',
  serve({
    client: inngest,
    functions: [ingestDocumentFunction],
  })
);

export default router;
