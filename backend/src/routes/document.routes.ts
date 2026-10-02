import { Router } from 'express';
import { DocumentController, upload } from '../controllers/document.controller';

const router = Router();

// Upload document with optional ?sync=true
router.post('/upload', upload.single('file'), DocumentController.uploadDocument);

// List all documents
router.get('/', DocumentController.listDocuments);

// Get document by ID
router.get('/:id', DocumentController.getDocument);

// Delete document by ID
router.delete('/:id', DocumentController.deleteDocument);

export default router;
