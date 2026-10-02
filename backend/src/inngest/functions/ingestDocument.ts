import { inngest } from '../client';
import { documentService } from '../../services/document/document.service';
import { ChunkingOptions } from '../../services/ai/chunking.service';

export interface IngestDocumentEventData {
  documentId: string;
  fileBufferBase64: string;
  chunkingOptions?: ChunkingOptions;
}

export const ingestDocumentFunction = inngest.createFunction(
  {
    name: 'Ingest Document',
    id: 'document/ingest-pipeline',
    retries: 2,
  },
  { event: 'document/ingest' },
  async ({ event, step }) => {
    const { documentId, fileBufferBase64, chunkingOptions } = event.data as IngestDocumentEventData;

    const result = await step.run('Extract, Chunk, Embed and Store Chunks', async () => {
      const buffer = Buffer.from(fileBufferBase64, 'base64');
      return documentService.processAndIngestDocument(documentId, buffer, chunkingOptions);
    });

    return {
      success: true,
      documentId: result.documentId,
      totalChunks: result.totalChunks,
      totalPages: result.totalPages,
    };
  }
);
