import pino from 'pino';
import { env } from './env';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.otp',
  'req.body.pin',
  'password',
  'passwordHash',
  'apiKey',
  'secret',
];

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: { paths: redactPaths, censor: '[REDACTED]' },
});
