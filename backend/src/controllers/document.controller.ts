import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { documentService } from '../services/document/document.service';
import { inngest } from '../inngest/client';
import { config } from '../config';
import { ChunkingMethod } from '../services/ai/chunking.service';

// Multer memory storage configuration
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxSizeBytes,
  },
  fileFilter: (_req, file, cb) => {
    const isAllowedMime = config.upload.allowedMimeTypes.includes(file.mimetype as any);
    const hasAllowedExt = config.upload.allowedExtensions.some((ext) =>
      file.originalname.toLowerCase().endsWith(ext)
    );

    if (isAllowedMime || hasAllowedExt) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type. Only TXT and PDF documents are supported (received: ${file.mimetype || file.originalname}).`
        )
      );
    }
  },
});

export class DocumentController {
  /**
   * POST /api/v1/documents/upload
   * Handles multipart file upload and triggers ingestion.
   */
  public static async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({
          success: false,
          error: 'No file was provided in the upload request. Field name must be "file".',
        });
        return;
      }

      if (file.size === 0) {
        res.status(400).json({
          success: false,
          error: 'The uploaded file is empty (0 bytes).',
        });
        return;
      }

      const title = (req.body.title as string) || file.originalname;
      const chunkingMethod = (req.body.chunkingMethod as ChunkingMethod) || 'paragraph';
      const fixedSize = req.body.fixedSize ? parseInt(req.body.fixedSize, 10) : undefined;
      const isSync = req.query.sync === 'true' || req.body.sync === 'true' || req.body.sync === true;
      const userId = req.user?.id;

      // 1. Create Document database record
      const document = await documentService.createDocument({
        userId,
        title,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        sourceType: 'file',
        metadata: {
          originalName: file.originalname,
          chunkingMethod,
          uploadedAt: new Date().toISOString(),
        },
      });

      const chunkingOptions = {
        method: chunkingMethod,
        fixedSize,
      };

      // 2. Either process synchronously or dispatch to Inngest
      if (isSync) {
        console.log(`[DocumentController] Processing document ${document.id} synchronously...`);
        const result = await documentService.processAndIngestDocument(
          document.id,
          file.buffer,
          chunkingOptions
        );

        const updatedDoc = await documentService.getDocumentById(document.id);

        res.status(201).json({
          success: true,
          message: 'Document uploaded and successfully ingested.',
          document: updatedDoc,
          stats: {
            totalChunks: result.totalChunks,
            totalPages: result.totalPages,
          },
        });
        return;
      }

      // Dispatch to Inngest background event
      try {
        await inngest.send({
          name: 'document/ingest',
          data: {
            documentId: document.id,
            fileBufferBase64: file.buffer.toString('base64'),
            chunkingOptions,
          },
        });

        res.status(202).json({
          success: true,
          message: 'Document uploaded successfully. Ingestion scheduled in background.',
          document,
          inngestEvent: 'document/ingest',
        });
      } catch (inngestErr) {
        console.warn(
          '[DocumentController] Inngest dispatch failed or unreachable. Falling back to synchronous ingestion...',
          inngestErr
        );

        const result = await documentService.processAndIngestDocument(
          document.id,
          file.buffer,
          chunkingOptions
        );

        const updatedDoc = await documentService.getDocumentById(document.id);

        res.status(201).json({
          success: true,
          message: 'Document uploaded and ingested via direct fallback.',
          document: updatedDoc,
          stats: {
            totalChunks: result.totalChunks,
            totalPages: result.totalPages,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/documents
   * Lists all documents. If authenticated, scopes to the authenticated user.
   */
  public static async listDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const documents = await documentService.listDocuments(userId);
      res.status(200).json({
        success: true,
        count: documents.length,
        documents,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/documents/:id
   * Retrieves single document details and chunk counts with user authorization check.
   */
  public static async getDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const document = await documentService.getDocumentById(id);

      if (!document) {
        res.status(404).json({
          success: false,
          error: `Document with ID '${id}' was not found.`,
        });
        return;
      }

      // If user is authenticated, ensure document belongs to user
      if (req.user && document.userId !== req.user.id) {
        res.status(403).json({
          success: false,
          error: 'Forbidden. You do not have permission to view this document.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        document,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/documents/:id
   * Deletes a document and cascades to its chunks with user authorization check.
   */
  public static async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await documentService.getDocumentById(id);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: `Document with ID '${id}' was not found.`,
        });
        return;
      }

      // If user is authenticated, ensure document belongs to user
      if (req.user && existing.userId !== req.user.id) {
        res.status(403).json({
          success: false,
          error: 'Forbidden. You do not have permission to delete this document.',
        });
        return;
      }

      await documentService.deleteDocument(id);

      res.status(200).json({
        success: true,
        message: `Document '${existing.title}' (${id}) and all its vector chunks were deleted.`,
      });
    } catch (error) {
      next(error);
    }
  }
}
