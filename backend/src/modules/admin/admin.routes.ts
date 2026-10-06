import { Router } from 'express';
import { authJwt, requireRole, AuthedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';

const router = Router();
router.use(authJwt);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [
      merchants,
      activeMerchants,
      totalTx,
      successTx,
      failedTx,
      volume,
      pendingPayouts,
    ] = await Promise.all([
      prisma.merchant.count(),
      prisma.merchant.count({ where: { isActive: true } }),
      prisma.payment.count(),
      prisma.payment.count({ where: { status: 'SUCCESS' } }),
      prisma.payment.count({ where: { status: 'FAILED' } }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      prisma.payout.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        merchants,
        activeMerchants,
        totalTx,
        successTx,
        failedTx,
        totalVolume: Number(volume._sum.amount ?? 0),
        pendingPayouts: Number(pendingPayouts._sum.amount ?? 0),
      },
    });
  }),
);

router.get(
  '/merchants',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50')), 200);
    const offset = parseInt(String(req.query.offset ?? '0'));
    const [items, total] = await Promise.all([
      prisma.merchant.findMany({
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.merchant.count(),
    ]);
    res.json({ success: true, data: { items, total } });
  }),
);

router.post(
  '/merchants/:id/toggle',
  asyncHandler(async (req, res) => {
    const m = await prisma.merchant.findUnique({ where: { id: req.params.id } });
    if (!m) throw ApiError.notFound('Merchant not found');
    const updated = await prisma.merchant.update({
      where: { id: m.id },
      data: { isActive: !m.isActive },
    });
    res.json({ success: true, data: updated });
  }),
);

router.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50')), 200);
    const offset = parseInt(String(req.query.offset ?? '0'));
    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          merchant: { select: { businessName: true } },
        },
      }),
      prisma.payment.count(),
    ]);
    res.json({ success: true, data: { items, total } });
  }),
);

router.get(
  '/webhooks/deliveries',
  asyncHandler(async (_req, res) => {
    const deliveries = await prisma.webhookDelivery.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ success: true, data: deliveries });
  }),
);

router.get(
  '/payouts',
  asyncHandler(async (_req, res) => {
    const payouts = await prisma.payout.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        merchant: { select: { businessName: true } },
      },
    });
    res.json({ success: true, data: payouts });
  }),
);

router.post(
  '/payouts/:id/approve',
  asyncHandler(async (req, res) => {
    const payout = await prisma.payout.findUnique({
      where: { id: req.params.id },
    });
    if (!payout) throw ApiError.notFound('Payout not found');
    const updated = await prisma.payout.update({
      where: { id: payout.id },
      data: { status: 'PAID' },
    });
    res.json({ success: true, data: updated });
  }),
);

router.get(
  '/audit-logs',
  asyncHandler(async (_req, res) => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { email: true } } },
    });
    res.json({ success: true, data: logs });
  }),
);

export default router;
