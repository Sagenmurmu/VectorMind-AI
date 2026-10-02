import { z } from 'zod';

export const chatRequestSchema = z.object({
  query: z.string().trim().min(1, 'Query message cannot be empty.'),
  conversationId: z.string().uuid('Invalid conversation ID format.').optional(),
  documentId: z.string().uuid('Invalid document ID format.').optional(),
  topK: z.number().int().min(1).max(20).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
