import { prisma } from './prisma';

export async function withIdempotency<T>(
  key: string | undefined,
  scope: string,
  handler: () => Promise<T>,
): Promise<T> {
  if (!key) return handler();

  const composite = `${scope}:${key}`;
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: composite },
  });

  if (existing && existing.expiresAt > new Date()) {
    return existing.response as T;
  }

  const result = await handler();
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);

  await prisma.idempotencyKey.upsert({
    where: { key: composite },
    create: {
      key: composite,
      scope,
      response: result as any,
      expiresAt,
    },
    update: { response: result as any, expiresAt },
  });

  return result;
}
