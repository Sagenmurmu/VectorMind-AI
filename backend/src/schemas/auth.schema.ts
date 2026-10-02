import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address format.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password cannot exceed 128 characters.'),
  name: z.string().trim().min(1, 'Name cannot be empty.').max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address format.'),
  password: z.string().min(1, 'Password is required.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
