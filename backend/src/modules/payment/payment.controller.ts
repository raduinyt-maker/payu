import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AuthedRequest } from '../../middleware/auth';
import { ApiError } from '../../utils/ApiError';
import { withIdempotency } from '../../lib/idempotency';
import {
  createPayment,
  getPayment,
  listPayments,
  verifyPaymentStatus,
  manualVerify,
  cancelPayment,
} from './payment.service';
import { PaymentStatus } from '@prisma/client';

function mid(req: AuthedRequest): string {
  if (!req.user?.merchantId) throw ApiError.forbidden('Merchant only');
  return req.user.merchantId;
}

export const create = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const idem = req.header('Idempotency-Key');
  const result = await withIdempotency(idem, 'payment.create', async () =>
    createPayment(mid(req), req.body, idem),
  );
  res.status(201).json({ success: true, data: result });
});

export const getOne = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const p = await getPayment(mid(req), req.params.id);
  res.json({ success: true, data: p });
});

export const list = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '20')), 100);
  const offset = parseInt(String(req.query.offset ?? '0'));
  const status = req.query.status as PaymentStatus | undefined;
  const search = req.query.q as string | undefined;
  const result = await listPayments(mid(req), { status, limit, offset, search });
  res.json({ success: true, data: result });
});

export const verify = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const p = await getPayment(mid(req), req.params.id);
  const updated = await verifyPaymentStatus(p.paymentId);
  res.json({ success: true, data: updated });
});

export const manual = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { authorizationCode } = req.body as { authorizationCode?: string };
  if (!authorizationCode) {
    throw ApiError.badRequest('authorizationCode required');
  }
  const updated = await manualVerify(mid(req), req.params.id, authorizationCode);
  res.json({ success: true, data: updated });
});

export const cancel = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const updated = await cancelPayment(mid(req), req.params.id);
  res.json({ success: true, data: updated });
});
