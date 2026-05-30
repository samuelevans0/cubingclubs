// functions/api/auth/change-password.js
// POST /api/auth/change-password (authenticated) — { current_password, new_password }
import { getSession, verifyPassword, hashPassword, json, cors } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Not authenticated' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { current_password, new_password } = body;
  if (!current_password || !new_password) return json({ error: 'Both passwords required' }, 400);
  if (new_password.length < 8) return json({ error: 'New password must be at least 8 characters' }, 400);

  const user = await env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE id = ?'
  ).bind(session.user_id).first();

  if (!user || !(await verifyPassword(current_password, user.password_hash))) {
    return json({ error: 'Current password is incorrect' }, 401);
  }

  const hash = await hashPassword(new_password);
  await env.DB.prepare(
    'UPDATE users SET password_hash = ? WHERE id = ?'
  ).bind(hash, user.id).run();

  return json({ ok: true });
}

export async function onRequestOptions() { return cors(); }
