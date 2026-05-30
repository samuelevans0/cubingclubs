// functions/api/auth/verify-email.js
// GET /api/auth/verify-email?token=xxx
import { json, cors } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return json({ error: 'Missing token' }, 400);

  const user = await env.DB.prepare(
    `SELECT id FROM users
     WHERE verification_token = ? AND verification_token_expires > datetime('now')`
  ).bind(token).first();

  if (!user) return json({ error: 'Invalid or expired verification link.' }, 400);

  await env.DB.prepare(
    `UPDATE users SET email_verified = 1, verification_token = '', verification_token_expires = ''
     WHERE id = ?`
  ).bind(user.id).run();

  return json({ ok: true });
}

export async function onRequestOptions() { return cors(); }
