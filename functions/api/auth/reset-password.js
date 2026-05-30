// functions/api/auth/reset-password.js
// POST /api/auth/reset-password — { token, password }
import { hashPassword, json, cors } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { token, password } = body;
  if (!token || !password) return json({ error: 'Token and password required' }, 400);
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

  const user = await env.DB.prepare(
    `SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > datetime('now')`
  ).bind(token).first();

  if (!user) return json({ error: 'Invalid or expired reset link.' }, 400);

  const hash = await hashPassword(password);
  await env.DB.prepare(
    `UPDATE users SET password_hash = ?, reset_token = '', reset_token_expires = '' WHERE id = ?`
  ).bind(hash, user.id).run();

  // Invalidate all existing sessions so old password can't be used
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();

  return json({ ok: true });
}

export async function onRequestOptions() { return cors(); }
