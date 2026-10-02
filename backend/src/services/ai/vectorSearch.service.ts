import { prisma } from '../../db/prisma';
import { embeddingService } from './embedding.service';

export interface SearchOptions {
  limit?: number;
  documentId?: string;
  minSimilarity?: number;
}

export interface SearchResultItem {
  chunkId: string;
  content: string;
  documentId: string;
  documentTitle: string;
  fileName: string;
  sourceType: string;
  chunkIndex: number;
  pageNumber: number | null;
  similarity: number;
  distance: number;
  metadata: Record<string, unknown>;
}

export class VectorSearchService {
  private static readonly DEFAULT_LIMIT = 5;

  /**
   * Performs semantic vector search over document_chunks using HNSW cosine index.
   */
  public async search(
    queryText: string,
    options: SearchOptions = {}
  ): Promise<SearchResultItem[]> {
    const limit = options.limit || VectorSearchService.DEFAULT_LIMIT;
    const documentIdFilter = options.documentId || null;

    // 1. Generate query embedding
    const queryEmbedding = await embeddingService.embedQuery(queryText);
    const vectorJson = `[${queryEmbedding.join(',')}]`;

    // 2. Query document_chunks using HNSW halfvec cosine distance
    const rawResults = await prisma.$queryRawUnsafe<
      Array<{
        chunkId: string;
        content: string;
        chunkIndex: number;
        pageNumber: number | null;
        metadata: any;
        documentId: string;
        documentTitle: string;
        fileName: string;
        sourceType: string;
        distance: number;
      }>
    >(
      `SELECT
        c."id" AS "chunkId",
        c."content",
        c."chunkIndex",
        c."pageNumber",
        c."metadata",
        d."id" AS "documentId",
        d."title" AS "documentTitle",
        d."fileName",
        d."sourceType",
        (c."embedding"::halfvec(3072) <=> $1::halfvec(3072)) AS "distance"
      FROM "document_chunks" c
      JOIN "documents" d ON c."documentId" = d."id"
      WHERE ($2::text IS NULL OR c."documentId" = $2)
      ORDER BY "distance" ASC
      LIMIT $3`,
      vectorJson,
      documentIdFilter,
      limit
    );

    // 3. Map into structured result with similarity score
    const results: SearchResultItem[] = rawResults.map((row) => {
      const distance = typeof row.distance === 'number' ? row.distance : parseFloat(String(row.distance));
      const similarity = Math.max(0, Math.min(1, 1 - distance));

      return {
        chunkId: row.chunkId,
        content: row.content,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        fileName: row.fileName,
        sourceType: row.sourceType,
        chunkIndex: row.chunkIndex,
        pageNumber: row.pageNumber,
        similarity: parseFloat(similarity.toFixed(4)),
        distance: parseFloat(distance.toFixed(4)),
        metadata: (row.metadata as Record<string, unknown>) || {},
      };
    });

    if (options.minSimilarity !== undefined) {
      return results.filter((r) => r.similarity >= options.minSimilarity!);
    }

    return results;
  }
}

export const vectorSearchService = new VectorSearchService();
