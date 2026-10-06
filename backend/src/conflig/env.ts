import dotenv from 'dotenv';
dotenv.config();

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env: ${key}`);
  }
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '4000', 10),
  DATABASE_URL: required('DATABASE_URL'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '15m',
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '30d',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL ?? 'http://localhost:4000',
  WEBHOOK_SECRET: required('WEBHOOK_SECRET'),
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER ?? 'manual',
  PAYMENT_PROVIDER_API_URL: process.env.PAYMENT_PROVIDER_API_URL ?? '',
  PAYMENT_PROVIDER_API_KEY: process.env.PAYMENT_PROVIDER_API_KEY ?? '',
  PAYMENT_PROVIDER_SECRET: process.env.PAYMENT_PROVIDER_SECRET ?? '',
  FCM_PROJECT_ID: process.env.FCM_PROJECT_ID ?? '',
  FCM_CLIENT_EMAIL: process.env.FCM_CLIENT_EMAIL ?? '',
  FCM_PRIVATE_KEY: (process.env.FCM_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL ?? 'admin@example.com',
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!',
};
