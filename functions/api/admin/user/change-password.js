// functions/api/admin/user/change-password.js
// POST /api/admin/user/change-password — admin sets any user's password
// Body: { user_id, new_password }

import { getSession, hashPassword, json, cors } from '../../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: 'Unauthorized' }, 403);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { user_id, new_password } = body;
  if (!user_id || !new_password) return json({ error: 'user_id and new_password required' }, 400);
  if (new_password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

  const hash = await hashPassword(new_password);

  await env.DB.prepare(
    'UPDATE users SET password_hash = ? WHERE id = ?'
  ).bind(hash, user_id).run();

  // Invalidate all existing sessions for this user so they must log in again
  await env.DB.prepare(
    'DELETE FROM sessions WHERE user_id = ?'
  ).bind(user_id).run();

  return json({ ok: true });
}

export async function onRequestOptions() { return cors(); }
