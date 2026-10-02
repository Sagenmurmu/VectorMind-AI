import { Router } from 'express';
import healthRoutes from './health.routes';
import documentRoutes from './document.routes';
import searchRoutes from './search.routes';
import chatRoutes from './chat.routes';
import inngestRoutes from './inngest.routes';

const router = Router();

// Mount sub-routers
router.use('/health', healthRoutes);
router.use('/documents', documentRoutes);
router.use('/search', searchRoutes);
router.use('/chat', chatRoutes);
router.use('/inngest', inngestRoutes);

export default router;
