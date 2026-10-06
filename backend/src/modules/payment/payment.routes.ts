import { Router } from 'express';
import { authJwt, authApiKey, AuthedRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { createPaymentSchema } from './payment.schema';
import {
  create,
  getOne,
  list,
  verify,
  manual,
  cancel,
} from './payment.controller';
import { paymentLimiter } from '../../middleware/rateLimit';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';

const router = Router();

// Dual auth: JWT (dashboard) or API Key (server-to-server)
const dualAuth = asyncHandler(async (req: AuthedRequest, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized();
  const token = header.slice(7);
  if (token.includes('.')) {
    // API key format: pk_xxx.yyy
    return authApiKey(req, res, next);
  }
  return authJwt(req, res, next);
});

router.get(
  '/balance',
  dualAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.user!.merchantId! },
      select: {
        availableBalance: true,
        pendingBalance: true,
        currency: true,
      },
    });
    res.json({ success: true, data: merchant });
  }),
);

router.get(
  '/stats',
  dualAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const merchantId = req.user!.merchantId!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCount,
      successCount,
      pendingCount,
      failedCount,
      todaySuccess,
      byMethod,
    ] = await Promise.all([
      prisma.payment.count({ where: { merchantId } }),
      prisma.payment.count({ where: { merchantId, status: 'SUCCESS' } }),
      prisma.payment.count({ where: { merchantId, status: 'PENDING' } }),
      prisma.payment.count({ where: { merchantId, status: 'FAILED' } }),
      prisma.payment.aggregate({
        where: { merchantId, status: 'SUCCESS', paidAt: { gte: today } },
        _sum: { amount: true },
      }),
      prisma.payment.groupBy({
        by: ['providerName'],
        where: { merchantId, status: 'SUCCESS' },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalCount,
        successCount,
        pendingCount,
        failedCount,
        todayRevenue: Number(todaySuccess._sum.amount ?? 0),
        byMethod,
      },
    });
  }),
);

router.post('/', dualAuth, paymentLimiter, validateBody(createPaymentSchema), create);
router.get('/', dualAuth, list);
router.get('/:id', dualAuth, getOne);
router.post('/:id/verify', dualAuth, verify);
router.post('/:id/manual-verify', dualAuth, manual);
router.post('/:id/cancel', dualAuth, cancel);

export default router;
