import { Router } from 'express';
import { z } from 'zod';
import { authJwt, AuthedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';

const router = Router();
router.use(authJwt);

function mid(req: AuthedRequest): string {
  if (!req.user?.merchantId) throw ApiError.forbidden('Merchant only');
  return req.user.merchantId;
}

router.get(
  '/profile',
  asyncHandler(async (req: AuthedRequest, res) => {
    const merchant = await prisma.merchant.findUnique({
      where: { id: mid(req) },
      include: { user: { select: { email: true, name: true } } },
    });
    res.json({ success: true, data: merchant });
  }),
);

router.patch(
  '/profile',
  validateBody(
    z.object({
      businessName: z.string().min(2).optional(),
      businessPhone: z.string().optional(),
      businessEmail: z.string().email().optional(),
      website: z.string().url().optional(),
      logoUrl: z.string().url().optional(),
      webhookUrl: z.string().url().optional(),
    }),
  ),
  asyncHandler(async (req: AuthedRequest, res) => {
    const updated = await prisma.merchant.update({
      where: { id: mid(req) },
      data: req.body,
    });
    res.json({ success: true, data: updated });
  }),
);

export default router;
