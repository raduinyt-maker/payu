import { prisma } from '../../lib/prisma';
import { logger } from '../../config/logger';
import { deliverWebhook, WebhookPayload } from './webhook.sender';

export async function dispatchPaymentWebhook(
  merchantId: string,
  payload: WebhookPayload,
) {
  const hooks = await prisma.webhook.findMany({
    where: { merchantId, isActive: true },
  });

  if (hooks.length === 0) {
    // Fallback: use merchant's webhookUrl if set
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    if (merchant?.webhookUrl) {
      await deliverWebhook(
        '',
        merchant.webhookUrl,
        merchant.webhookSecret,
        payload,
      );
    }
    return;
  }

  for (const hook of hooks) {
    if (
      !hook.events.includes(payload.event) &&
      !hook.events.includes('*')
    ) {
      continue;
    }
    try {
      await deliverWebhook(hook.id, hook.url, hook.secret, payload);
    } catch (e) {
      logger.error({ err: e, hookId: hook.id }, 'Webhook dispatch failed');
    }
  }
}
