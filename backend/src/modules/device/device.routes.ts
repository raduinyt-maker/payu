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

router.post(
  '/register',
  validateBody(
    z.object({
      fcmToken: z.string().min(10),
      deviceName: z.string().optional(),
    }),
  ),
  asyncHandler(async (req: AuthedRequest, res) => {
    const device = await prisma.device.upsert({
      where: { fcmToken: req.body.fcmToken },
      create: {
        merchantId: mid(req),
        fcmToken: req.body.fcmToken,
        deviceName: req.body.deviceName,
      },
      update: {
        merchantId: mid(req),
        deviceName: req.body.deviceName,
        lastSeenAt: new Date(),
      },
    });
    res.json({ success: true, data: device });
  }),
);

router.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const devices = await prisma.device.findMany({
      where: { merchantId: mid(req) },
      orderBy: { lastSeenAt: 'desc' },
    });
    res.json({ success: true, data: devices });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.device.deleteMany({
      where: { id: req.params.id, merchantId: mid(req) },
    });
    res.json({ success: true });
  }),
);

export default router;
