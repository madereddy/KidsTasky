import { db } from '../../db.js';

type WebPushModule = {
  setVapidDetails: (email: string, publicKey: string, privateKey: string) => void;
  sendNotification: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<unknown>;
};

let webpushPromise: Promise<WebPushModule | null> | null = null;

async function getWebPush(): Promise<WebPushModule | null> {
  if (!webpushPromise) {
    webpushPromise = import('web-push')
      .then((mod) => (mod.default || mod) as WebPushModule)
      .catch(() => null);
  }
  return webpushPromise;
}

let vapidInitialized = false;

async function initVapid() {
  if (vapidInitialized) return;
  const webpush = await getWebPush();
  if (!webpush) return;

  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || 'mailto:admin@example.com';
  if (pub && priv) {
    webpush.setVapidDetails(email, pub, priv);
    vapidInitialized = true;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<boolean> {
  await initVapid();
  const webpush = await getWebPush();
  if (!webpush) return false;

  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE userId = ?').all(userId) as any[];
  if (!subs.length) return false;

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const err = r.reason as any;
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(subs[i].endpoint);
      }
    }
  });

  return results.some((r) => r.status === 'fulfilled');
}
