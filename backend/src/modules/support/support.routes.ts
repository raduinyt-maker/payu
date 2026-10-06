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

router.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const tickets = await prisma.supportTicket.findMany({
      where: { merchantId: mid(req) },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: tickets });
  }),
);

router.post(
  '/',
  validateBody(
    z.object({
      subject: z.string().min(3),
      message: z.string().min(10),
      priority: z.string().default('NORMAL'),
    }),
  ),
  asyncHandler(async (req: AuthedRequest, res) => {
    const ticket = await prisma.supportTicket.create({
      data: {
        merchantId: mid(req),
        subject: req.body.subject,
        message: req.body.message,
        priority: req.body.priority,
      },
    });
    res.status(201).json({ success: true, data: ticket });
  }),
);

export default router;
