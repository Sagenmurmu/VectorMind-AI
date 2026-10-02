import { prisma } from '../../db/prisma';
import { DocumentStatus, Prisma } from '@prisma/client';
import { extractionService } from './extraction.service';
import { chunkingService, ChunkingOptions, ChunkItem } from '../ai/chunking.service';
import { embeddingService } from '../ai/embedding.service';

export interface CreateDocumentInput {
  userId?: string;
  title: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  sourceType?: string;
  metadata?: Record<string, any>;
}

export class DocumentService {
  public static readonly DEFAULT_SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001';
  public static readonly DEFAULT_SYSTEM_USER_EMAIL = 'default_user@vectormind.internal';

  /**
   * Ensures a default user exists for unauthenticated operations (until Phase 4 Auth).
   */
  public async ensureDefaultUser(): Promise<string> {
    const existing = await prisma.user.findUnique({
      where: { email: DocumentService.DEFAULT_SYSTEM_USER_EMAIL },
    });

    if (existing) {
      return existing.id;
    }

    const created = await prisma.user.create({
      data: {
        id: DocumentService.DEFAULT_SYSTEM_USER_ID,
        email: DocumentService.DEFAULT_SYSTEM_USER_EMAIL,
        name: 'Default VectorMind User',
      },
    });

    return created.id;
  }

  /**
   * Creates a new Document record with PENDING status.
   */
  public async createDocument(input: CreateDocumentInput) {
    const userId = input.userId || (await this.ensureDefaultUser());

    return prisma.document.create({
      data: {
        userId,
        title: input.title,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        sourceType: input.sourceType || 'file',
        status: DocumentStatus.PENDING,
        metadata: (input.metadata as Prisma.InputJsonObject) || {},
      },
    });
  }

  /**
   * Updates document status and appends any error or diagnostic metadata.
   */
  public async updateStatus(
    documentId: string,
    status: DocumentStatus,
    metadataUpdates: Record<string, any> = {}
  ) {
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const currentMeta = (doc.metadata as Record<string, any>) || {};
    const updatedMeta = { ...currentMeta, ...metadataUpdates, lastStatusChange: new Date().toISOString() };

    return prisma.document.update({
      where: { id: documentId },
      data: {
        status,
        metadata: updatedMeta as Prisma.InputJsonObject,
      },
    });
  }

  /**
   * Retrieves a document by ID with chunk count.
   */
  public async getDocumentById(documentId: string) {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    return doc;
  }

  /**
   * Lists all documents.
   */
  public async listDocuments(userId?: string) {
    return prisma.document.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });
  }

  /**
   * Deletes a document and cascades to its chunks.
   */
  public async deleteDocument(documentId: string) {
    return prisma.document.delete({
      where: { id: documentId },
    });
  }

  /**
   * Full ingestion pipeline: Extract -> Chunk -> Embed -> Transact Chunks -> Complete.
   * This is idempotent: previous chunks for this document are safely replaced on reprocessing.
   */
  public async processAndIngestDocument(
    documentId: string,
    fileBuffer: Buffer,
    chunkingOptions: ChunkingOptions = {}
  ): Promise<{ documentId: string; totalChunks: number; totalPages: number }> {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) {
      throw new Error(`Document with ID '${documentId}' does not exist.`);
    }

    try {
      // 1. Mark status as PROCESSING
      await this.updateStatus(documentId, DocumentStatus.PROCESSING);

      // 2. Extract text from buffer
      const extraction = await extractionService.extractText(
        fileBuffer,
        document.mimeType || 'text/plain',
        document.fileName
      );

      // 3. Chunk extracted text while preserving page numbers
      const chunkItems: ChunkItem[] = chunkingService.chunkPages(
        extraction.pages,
        chunkingOptions
      );

      if (!chunkItems.length) {
        throw new Error('Text extraction produced zero valid text chunks.');
      }

      // 4. Generate embeddings in batch via Gemini
      const chunkTexts = chunkItems.map((c) => c.content);
      const embeddings = await embeddingService.embedBatch(chunkTexts);

      // 5. Store chunks transactionally (idempotent: delete existing chunks first)
      await prisma.$executeRawUnsafe(
        'DELETE FROM "document_chunks" WHERE "documentId" = $1',
        documentId
      );

      for (let i = 0; i < chunkItems.length; i++) {
        const item = chunkItems[i];
        const vectorJson = `[${embeddings[i].join(',')}]`;
        const chunkMetadata = {
          fileName: document.fileName,
          title: document.title,
          sourceType: document.sourceType,
          chunkingMethod: chunkingOptions.method || 'paragraph',
          pageNumber: item.pageNumber || null,
          chunkIndex: item.chunkIndex,
          totalChunks: chunkItems.length,
          ingestedAt: new Date().toISOString(),
        };

        const chunkId = `chk_${Date.now()}_${i}`;

        await prisma.$executeRawUnsafe(
          `INSERT INTO "document_chunks" (
            "id", "documentId", "chunkIndex", "content", "embedding", "metadata", "pageNumber", "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5::vector, $6::jsonb, $7, NOW(), NOW())`,
          chunkId,
          documentId,
          item.chunkIndex,
          item.content,
          vectorJson,
          JSON.stringify(chunkMetadata),
          item.pageNumber || null
        );
      }

      // 6. Mark status as COMPLETED
      await this.updateStatus(documentId, DocumentStatus.COMPLETED, {
        totalChunks: chunkItems.length,
        totalPages: extraction.totalPages,
        chunkingMethod: chunkingOptions.method || 'paragraph',
      });

      return {
        documentId,
        totalChunks: chunkItems.length,
        totalPages: extraction.totalPages,
      };
    } catch (err: any) {
      console.error(`[DocumentService] Ingestion failed for document ${documentId}:`, err);

      await this.updateStatus(documentId, DocumentStatus.FAILED, {
        failureReason: err?.message || 'Unknown processing error',
      });

      throw err;
    }
  }
}

export const documentService = new DocumentService();
