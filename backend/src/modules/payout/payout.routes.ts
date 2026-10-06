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
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const payouts = await prisma.payout.findMany({
      where: { merchantId: mid(req) },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: payouts });
  }),
);

router.post(
  '/',
  validateBody(
    z.object({
      amount: z.number().positive(),
      method: z.string().min(2),
      accountInfo: z.record(z.any()),
      note: z.string().optional(),
    }),
  ),
  asyncHandler(async (req: AuthedRequest, res) => {
    const merchant = await prisma.merchant.findUnique({
      where: { id: mid(req) },
    });
    if (!merchant) throw ApiError.notFound('Merchant not found');
    if (Number(merchant.availableBalance) < req.body.amount) {
      throw ApiError.badRequest('Insufficient balance');
    }

    const payout = await prisma.payout.create({
      data: {
        merchantId: merchant.id,
        amount: req.body.amount,
        method: req.body.method,
        accountInfo: req.body.accountInfo,
        note: req.body.note,
        status: 'PENDING',
      },
    });

    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { availableBalance: { decrement: req.body.amount } },
    });

    res.status(201).json({ success: true, data: payout });
  }),
);

export default router;
