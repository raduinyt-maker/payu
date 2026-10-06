import { Router } from 'express';
import { authJwt, AuthedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
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
    const items = await prisma.notification.findMany({
      where: { merchantId: mid(req) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: items });
  }),
);

router.post(
  '/:id/read',
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.notification.updateMany({
      where: { id: req.params.id, merchantId: mid(req) },
      data: { isRead: true },
    });
    res.json({ success: true });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.notification.updateMany({
      where: { merchantId: mid(req), isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
  }),
);

export default router;
