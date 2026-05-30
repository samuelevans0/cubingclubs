// functions/api/admin/push-subscribe.js
// GET  /api/admin/push-subscribe  → returns VAPID public key
// POST /api/admin/push-subscribe  → save or remove push subscription (admin only)

import { getSession, json, cors } from '../../_lib/auth.js';

export async function onRequestGet({ env }) {
  return json({ publicKey: env.VAPID_PUBLIC_KEY || null });
}

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: 'Forbidden' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  if (!body || !body.endpoint) {
    // Empty body = unsubscribe
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?')
      .bind(session.user_id).run();
    return json({ ok: true, subscribed: false });
  }

  const { endpoint, p256dh, auth } = body;
  if (!endpoint || !p256dh || !auth) return json({ error: 'Missing subscription fields' }, 400);

  await env.DB.prepare(`
    INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
  `).bind(session.user_id, endpoint, p256dh, auth).run();

  return json({ ok: true, subscribed: true });
}

export async function onRequestOptions() { return cors(); }
