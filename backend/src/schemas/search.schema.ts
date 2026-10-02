import { z } from 'zod';

export const searchRequestSchema = z.object({
  query: z.string().trim().min(1, 'Search query cannot be empty.'),
  documentId: z.string().uuid('Invalid document ID format.').optional(),
  limit: z.number().int().min(1).max(50).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
});

export type SearchRequestInput = z.infer<typeof searchRequestSchema>;
