import { z } from 'zod';

export const createConversationSchema = z.object({
  title: z.string().trim().max(200).optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty.').max(200),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
