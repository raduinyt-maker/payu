import { Router } from 'express';
import { authJwt, AuthedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';

const router = Router();
router.use(authJwt);

router.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const merchantId = req.user!.merchantId;
    if (!merchantId) throw ApiError.forbidden('Merchant only');
    const limit = Math.min(parseInt(String(req.query.limit ?? '50')), 200);
    const offset = parseInt(String(req.query.offset ?? '0'));

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { payment: { merchantId } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          payment: { select: { paymentId: true, orderId: true } },
        },
      }),
      prisma.transaction.count({ where: { payment: { merchantId } } }),
    ]);

    res.json({ success: true, data: { items, total } });
  }),
);

export default router;
