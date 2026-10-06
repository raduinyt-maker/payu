import { z } from 'zod';

export const createPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('BDT'),
  orderId: z.string().min(1),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  description: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  webhookUrl: z.string().url().optional(),
  expiresInMinutes: z.number().int().positive().default(30),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
