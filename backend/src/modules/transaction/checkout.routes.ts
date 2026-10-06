import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import { verifyPaymentStatus } from '../payment/payment.service';

const router = Router();

// Public checkout info (no auth — accessed from checkout page)
router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({
      where: { checkoutToken: req.params.token },
      include: {
        merchant: { select: { businessName: true, logoUrl: true } },
      },
    });
    if (!payment) throw ApiError.notFound('Checkout not found');

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        transactionId: payment.transactionId,
        orderId: payment.orderId,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        expiresAt: payment.expiresAt,
        merchant: payment.merchant,
        customerName: payment.customerName,
        description: payment.description,
        successUrl: payment.successUrl,
        cancelUrl: payment.cancelUrl,
      },
    });
  }),
);

// Poll payment status
router.get(
  '/:token/status',
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({
      where: { checkoutToken: req.params.token },
    });
    if (!payment) throw ApiError.notFound('Checkout not found');

    if (payment.status === 'PENDING') {
      try {
        await verifyPaymentStatus(payment.paymentId);
      } catch {
        // ignore verification errors, return current state
      }
    }

    const fresh = await prisma.payment.findUnique({
      where: { id: payment.id },
      select: { status: true, paidAt: true },
    });
    res.json({ success: true, data: fresh });
  }),
);

export default router;
