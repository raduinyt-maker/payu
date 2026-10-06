import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimit';
import authRoutes from './modules/auth/auth.routes';
import apikeyRoutes from './modules/apikey/apikey.routes';
import paymentRoutes from './modules/payment/payment.routes';
import transactionRoutes from './modules/transaction/transaction.routes';
import webhookRoutes from './modules/webhook/webhook.routes';
import merchantRoutes from './modules/merchant/merchant.routes';
import notificationRoutes from './modules/notification/notification.routes';
import deviceRoutes from './modules/device/device.routes';
import supportRoutes from './modules/support/support.routes';
import refundRoutes from './modules/refund/refund.routes';
import payoutRoutes from './modules/payout/payout.routes';
import adminRoutes from './modules/admin/admin.routes';
import checkoutRoutes from './modules/checkout/checkout.routes';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: [
        env.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:4173',
      ],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  // Health check (no rate limit, no auth)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(generalLimiter);

  // Public checkout (no auth)
  app.use('/checkout', checkoutRoutes);

  // Authenticated routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/keys', apikeyRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/transactions', transactionRoutes);
  app.use('/api/v1/webhooks', webhookRoutes);
  app.use('/api/v1/merchant', merchantRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/devices', deviceRoutes);
  app.use('/api/v1/support', supportRoutes);
  app.use('/api/v1/refunds', refundRoutes);
  app.use('/api/v1/payouts', payoutRoutes);
  app.use('/api/v1/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
