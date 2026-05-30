// functions/api/auth/change-email.js
// POST /api/auth/change-email (authenticated) — { new_email, password }
import { getSession, verifyPassword, generateToken, json, cors } from '../../_lib/auth.js';
import { sendEmail, emailChangeEmail } from '../../_lib/email.js';

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Not authenticated' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { new_email, password } = body;
  if (!new_email || !password) return json({ error: 'New email and password required' }, 400);

  const normalized = new_email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return json({ error: 'Invalid email address' }, 400);
  }

  const user = await env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE id = ?'
  ).bind(session.user_id).first();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ error: 'Password is incorrect' }, 401);
  }

  // Check new email not already in use
  const taken = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ? AND id != ?'
  ).bind(normalized, session.user_id).first();
  if (taken) return json({ error: 'That email address is already in use' }, 400);

  const token = generateToken();
  await env.DB.prepare(
    `UPDATE users SET pending_email = ?, email_change_token = ?,
     email_change_token_expires = datetime('now', '+24 hours') WHERE id = ?`
  ).bind(normalized, token, session.user_id).run();

  const appUrl = env.APP_URL || 'https://cubingclubs.net';
  await sendEmail({
    to: normalized,
    subject: 'Confirm your new CubingClubs.net email',
    html: emailChangeEmail(`${appUrl}/verify-email?token=${token}&change=1`, normalized)
  }, env);

  return json({ ok: true });
}

export async function onRequestOptions() { return cors(); }
