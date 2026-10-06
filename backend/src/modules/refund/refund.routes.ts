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
    const refunds = await prisma.refund.findMany({
      where: { merchantId: mid(req) },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: refunds });
  }),
);

router.post(
  '/',
  validateBody(
    z.object({
      paymentId: z.string(),
      amount: z.number().positive(),
      reason: z.string().optional(),
    }),
  ),
  asyncHandler(async (req: AuthedRequest, res) => {
    const merchantId = mid(req);
    const payment = await prisma.payment.findFirst({
      where: { paymentId: req.body.paymentId, merchantId },
    });
    if (!payment) throw ApiError.notFound('Payment not found');
    if (payment.status !== 'SUCCESS') {
      throw ApiError.badRequest('Only successful payments can be refunded');
    }
    if (req.body.amount > Number(payment.amount)) {
      throw ApiError.badRequest('Refund exceeds payment amount');
    }

    const refund = await prisma.refund.create({
      data: {
        paymentId: payment.id,
        merchantId,
        amount: req.body.amount,
        reason: req.body.reason,
        status: 'PENDING',
      },
    });

    res.status(201).json({ success: true, data: refund });
  }),
);

export default router;
