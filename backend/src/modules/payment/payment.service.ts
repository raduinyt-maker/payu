import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import {
  genPaymentId,
  genTransactionId,
  genCheckoutToken,
} from '../../utils/ids';
import { env } from '../../config/env';
import { getProvider } from '../../providers';
import { dispatchPaymentWebhook } from '../webhook/webhook.service';
import { logger } from '../../config/logger';
import { PaymentStatus } from '@prisma/client';

export async function createPayment(
  merchantId: string,
  input: {
    amount: number;
    currency: string;
    orderId: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    description?: string;
    successUrl?: string;
    cancelUrl?: string;
    webhookUrl?: string;
    expiresInMinutes: number;
  },
  idempotencyKey?: string,
) {
  const existing = await prisma.payment.findFirst({
    where: { merchantId, orderId: input.orderId },
  });
  if (existing) {
    throw ApiError.conflict('Order ID already used', 'DUPLICATE_ORDER');
  }

  const paymentId = genPaymentId();
  const transactionId = genTransactionId();
  const checkoutToken = genCheckoutToken();
  const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60_000);

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });
  if (!merchant) throw ApiError.notFound('Merchant not found');

  const provider = getProvider();

  const created = await prisma.payment.create({
    data: {
      paymentId,
      transactionId,
      merchantId,
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      description: input.description,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      webhookUrl: input.webhookUrl,
      providerName: provider.name,
      expiresAt,
      checkoutToken,
      idempotencyKey,
      transactions: {
        create: {
          status: 'PENDING',
          amount: input.amount,
          currency: input.currency,
          message: 'Payment created',
        },
      },
    },
  });

  let providerResult;
  try {
    providerResult = await provider.createPayment({
      paymentId,
      amount: input.amount,
      currency: input.currency,
      orderId: input.orderId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      description: input.description,
      returnUrl: `${env.BACKEND_URL}/checkout/${checkoutToken}`,
    });
  } catch (e) {
    logger.error({ err: e }, 'Provider createPayment failed');
    providerResult = {
      providerRef: `fallback_${paymentId}`,
      status: 'PENDING' as const,
    };
  }

  const updated = await prisma.payment.update({
    where: { id: created.id },
    data: { providerRef: providerResult.providerRef },
  });

  return {
    ...updated,
    checkoutUrl: `${env.BACKEND_URL}/checkout/${checkoutToken}`,
    providerRedirectUrl: providerResult.redirectUrl,
  };
}

export async function getPayment(merchantId: string, id: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      merchantId,
      OR: [{ id }, { paymentId: id }, { transactionId: id }],
    },
    include: {
      transactions: { orderBy: { createdAt: 'desc' } },
      refunds: true,
    },
  });
  if (!payment) throw ApiError.notFound('Payment not found');
  return payment;
}

export async function listPayments(
  merchantId: string,
  opts: {
    status?: PaymentStatus;
    limit: number;
    offset: number;
    search?: string;
  },
) {
  const where: any = { merchantId };
  if (opts.status) where.status = opts.status;
  if (opts.search) {
    where.OR = [
      { orderId: { contains: opts.search, mode: 'insensitive' } },
      { paymentId: { contains: opts.search, mode: 'insensitive' } },
      { customerPhone: { contains: opts.search } },
      { customerEmail: { contains: opts.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts.limit,
      skip: opts.offset,
    }),
    prisma.payment.count({ where }),
  ]);

  return { items, total };
}

export async function verifyPaymentStatus(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { paymentId },
    include: { merchant: true },
  });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status === 'SUCCESS') return payment;

  if (payment.expiresAt < new Date() && payment.status === 'PENDING') {
    return prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'EXPIRED',
        transactions: {
          create: {
            status: 'EXPIRED',
            amount: payment.amount,
            currency: payment.currency,
            message: 'Payment expired',
          },
        },
      },
    });
  }

  const provider = getProvider(payment.providerName);
  const result = await provider.verifyPayment(
    payment.paymentId,
    payment.providerRef ?? undefined,
  );

  if (result.status === payment.status) return payment;

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: result.status,
      paidAt: result.status === 'SUCCESS' ? new Date() : payment.paidAt,
      transactions: {
        create: {
          status: result.status,
          amount: payment.amount,
          currency: payment.currency,
          message: `Provider status: ${result.status}`,
        },
      },
    },
  });

  if (result.status === 'SUCCESS' && payment.status !== 'SUCCESS') {
    await prisma.merchant.update({
      where: { id: payment.merchantId },
      data: { availableBalance: { increment: payment.amount } },
    });

    await prisma.notification.create({
      data: {
        merchantId: payment.merchantId,
        title: 'Payment received',
        body: `Payment ${payment.paymentId} of ${payment.amount} ${payment.currency} received`,
        type: 'PAYMENT_SUCCESS',
        data: { paymentId: payment.paymentId },
      },
    });

    await dispatchPaymentWebhook(payment.merchantId, {
      event: 'payment.success',
      payment_id: payment.paymentId,
      transaction_id: payment.transactionId,
      order_id: payment.orderId,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    });
  }

  return updated;
}

export async function manualVerify(
  merchantId: string,
  paymentId: string,
  authorizationCode: string,
) {
  const payment = await prisma.payment.findFirst({
    where: { paymentId, merchantId },
  });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status === 'SUCCESS') return payment;
  if (payment.status === 'EXPIRED' || payment.status === 'CANCELLED') {
    throw ApiError.badRequest('Payment is not verifiable');
  }
  if (payment.providerName !== 'manual') {
    throw ApiError.badRequest(
      'Manual verification only for manual provider',
    );
  }
  if (!authorizationCode || authorizationCode.length < 4) {
    throw ApiError.badRequest('Invalid authorization code');
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'SUCCESS',
      paidAt: new Date(),
      transactions: {
        create: {
          status: 'SUCCESS',
          amount: payment.amount,
          currency: payment.currency,
          message: 'Manually verified by merchant',
        },
      },
    },
  });

  await prisma.merchant.update({
    where: { id: payment.merchantId },
    data: { availableBalance: { increment: payment.amount } },
  });

  await prisma.notification.create({
    data: {
      merchantId: payment.merchantId,
      title: 'Payment verified manually',
      body: `Payment ${payment.paymentId} marked SUCCESS`,
      type: 'PAYMENT_SUCCESS',
      data: { paymentId: payment.paymentId },
    },
  });

  await dispatchPaymentWebhook(payment.merchantId, {
    event: 'payment.success',
    payment_id: payment.paymentId,
    transaction_id: payment.transactionId,
    order_id: payment.orderId,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function cancelPayment(merchantId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { paymentId, merchantId },
  });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status === 'SUCCESS' || payment.status === 'REFUNDED') {
    throw ApiError.badRequest('Cannot cancel a completed payment');
  }
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'CANCELLED',
      transactions: {
        create: {
          status: 'CANCELLED',
          amount: payment.amount,
          currency: payment.currency,
          message: 'Cancelled by merchant',
        },
      },
    },
  });
  await dispatchPaymentWebhook(payment.merchantId, {
    event: 'payment.cancelled',
    payment_id: payment.paymentId,
    transaction_id: payment.transactionId,
    order_id: payment.orderId,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: 'CANCELLED',
    timestamp: new Date().toISOString(),
  });
  return updated;
}
