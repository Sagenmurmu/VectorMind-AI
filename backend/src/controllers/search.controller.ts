import { Request, Response, NextFunction } from 'express';
import { vectorSearchService } from '../services/ai/vectorSearch.service';

export class SearchController {
  /**
   * POST /api/v1/search
   * Performs semantic vector search over ingested document chunks.
   */
  public static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, limit, documentId, minSimilarity } = req.body;

      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({
          success: false,
          error: 'Field "query" is required and must be a non-empty string.',
        });
        return;
      }

      const parsedLimit = limit ? parseInt(String(limit), 10) : undefined;
      const parsedMinSim = minSimilarity !== undefined ? parseFloat(String(minSimilarity)) : undefined;

      const results = await vectorSearchService.search(query.trim(), {
        limit: parsedLimit,
        documentId: documentId ? String(documentId) : undefined,
        minSimilarity: parsedMinSim,
        userId: req.user?.id,
      });

      res.status(200).json({
        success: true,
        query: query.trim(),
        count: results.length,
        results,
      });
    } catch (error) {
      next(error);
    }
  }
}
