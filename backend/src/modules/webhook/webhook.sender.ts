import { prisma } from '../../lib/prisma';
import { hmacSha256 } from '../../lib/crypto';
import { logger } from '../../config/logger';

export interface WebhookPayload {
  event: string;
  payment_id: string;
  transaction_id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  timestamp: string;
}

export async function deliverWebhook(
  webhookId: string,
  url: string,
  secret: string,
  payload: WebhookPayload,
) {
  const body = JSON.stringify(payload);
  const signature = hmacSha256(secret, body);

  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: webhookId || 'inline',
      paymentId: payload.payment_id,
      event: payload.event,
      payload: payload as any,
      signature,
      status: 'PENDING',
    },
  });

  await attemptDelivery(delivery.id, url, body, signature);
}

async function attemptDelivery(
  deliveryId: string,
  url: string,
  body: string,
  signature: string,
) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });
  if (!delivery) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': delivery.event,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const responseBody = await res.text().catch(() => '');
    const ok = res.status >= 200 && res.status < 300;

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: ok ? 'SUCCESS' : 'RETRYING',
        attempts: { increment: 1 },
        responseCode: res.status,
        responseBody: responseBody.slice(0, 2000),
        deliveredAt: ok ? new Date() : null,
        nextRetryAt: ok ? null : nextBackoff(delivery.attempts + 1),
      },
    });

    logger.info(
      { deliveryId, status: res.status, ok },
      'Webhook delivery attempted',
    );
  } catch (e) {
    logger.warn({ err: e, deliveryId }, 'Webhook delivery failed');
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'RETRYING',
        attempts: { increment: 1 },
        nextRetryAt: nextBackoff(delivery.attempts + 1),
        responseBody: String(e).slice(0, 2000),
      },
    });
  }
}

function nextBackoff(attempt: number): Date {
  // exponential: 1m, 2m, 4m, 8m, 16m, 32m, 64m (cap)
  const minutes = Math.min(Math.pow(2, attempt - 1), 64);
  return new Date(Date.now() + minutes * 60_000);
}
