// functions/api/admin/user/change-email.js
// POST /api/admin/user/change-email — admin changes any user's email
// Body: { user_id, new_email }

import { getSession, json, cors } from '../../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: 'Unauthorized' }, 403);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { user_id, new_email } = body;
  if (!user_id || !new_email) return json({ error: 'user_id and new_email required' }, 400);

  const normalized = new_email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return json({ error: 'Invalid email address' }, 400);
  }

  const taken = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ? AND id != ?'
  ).bind(normalized, user_id).first();
  if (taken) return json({ error: 'That email is already in use' }, 400);

  await env.DB.prepare(
    'UPDATE users SET email = ?, email_verified = 1, pending_email = NULL, email_change_token = NULL WHERE id = ?'
  ).bind(normalized, user_id).run();

  return json({ ok: true, email: normalized });
}

export async function onRequestOptions() { return cors(); }
