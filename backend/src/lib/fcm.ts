import admin from 'firebase-admin';
import { env } from '../config/env';
import { logger } from '../config/logger';

let initialized = false;

export function initFcm(): void {
  if (initialized) return;
  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY) {
    logger.warn('FCM not configured, skipping initialization');
    return;
  }
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FCM_PROJECT_ID,
        clientEmail: env.FCM_CLIENT_EMAIL,
        privateKey: env.FCM_PRIVATE_KEY,
      }),
    });
    initialized = true;
    logger.info('FCM initialized');
  } catch (e) {
    logger.error({ err: e }, 'FCM init failed');
  }
}

export async function sendPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (!initialized) return;
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data,
    });
  } catch (e) {
    logger.error({ err: e, token }, 'FCM send failed');
  }
}
