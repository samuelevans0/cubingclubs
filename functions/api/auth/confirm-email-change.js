// functions/api/auth/confirm-email-change.js
// GET /api/auth/confirm-email-change?token=xxx
import { json, cors } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return json({ error: 'Missing token' }, 400);

  const user = await env.DB.prepare(
    `SELECT id, pending_email FROM users
     WHERE email_change_token = ? AND email_change_token_expires > datetime('now')`
  ).bind(token).first();

  if (!user || !user.pending_email) return json({ error: 'Invalid or expired confirmation link.' }, 400);

  await env.DB.prepare(
    `UPDATE users SET email = ?, pending_email = '', email_change_token = '',
     email_change_token_expires = '', email_verified = 1 WHERE id = ?`
  ).bind(user.pending_email, user.id).run();

  return json({ ok: true, email: user.pending_email });
}

export async function onRequestOptions() { return cors(); }
