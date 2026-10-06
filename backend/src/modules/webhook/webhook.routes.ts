import { Router } from 'express';
import { z } from 'zod';
import { authJwt, AuthedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import { randomToken } from '../../lib/crypto';

const router = Router();
router.use(authJwt);

function merchantId(req: AuthedRequest): string {
  if (!req.user?.merchantId) throw ApiError.forbidden('Merchant only');
  return req.user.merchantId;
}

router.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const list = await prisma.webhook.findMany({
      where: { merchantId: merchantId(req) },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: list });
  }),
);

router.post(
  '/',
  validateBody(
    z.object({
      url: z.string().url(),
      events: z.array(z.string()).default(['*']),
    }),
  ),
  asyncHandler(async (req: AuthedRequest, res) => {
    const hook = await prisma.webhook.create({
      data: {
        merchantId: merchantId(req),
        url: req.body.url,
        events: req.body.events,
        secret: randomToken(32),
      },
    });
    res.status(201).json({ success: true, data: hook });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const hook = await prisma.webhook.findFirst({
      where: { id: req.params.id, merchantId: merchantId(req) },
    });
    if (!hook) throw ApiError.notFound('Webhook not found');
    await prisma.webhook.delete({ where: { id: hook.id } });
    res.json({ success: true });
  }),
);

router.get(
  '/:id/deliveries',
  asyncHandler(async (req: AuthedRequest, res) => {
    const hook = await prisma.webhook.findFirst({
      where: { id: req.params.id, merchantId: merchantId(req) },
    });
    if (!hook) throw ApiError.notFound('Webhook not found');
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: hook.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: deliveries });
  }),
);

export default router;
