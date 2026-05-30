// functions/api/auth/login.js
import { verifyPassword, generateToken, json, cors } from '../../_lib/auth.js';
import { verifyTurnstile } from '../../_lib/turnstile.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { email, password, turnstile_token } = body;
  if (!email || !password) return json({ error: 'Email and password required' }, 400);

  const ok = await verifyTurnstile(turnstile_token, env);
  if (!ok) return json({ error: 'Human verification failed. Please try again.' }, 400);

  const user = await env.DB.prepare(
    'SELECT id, email, password_hash, is_admin, email_verified FROM users WHERE email = ?'
  ).bind(email.toLowerCase().trim()).first();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ error: 'Invalid email or password' }, 401);
  }

  const token = generateToken();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))"
  ).bind(token, user.id).run();

  const club = await env.DB.prepare(
    'SELECT * FROM clubs WHERE user_id = ?'
  ).bind(user.id).first();

  return new Response(JSON.stringify({
    ok: true,
    user: { id: user.id, email: user.email, is_admin: user.is_admin, email_verified: user.email_verified },
    club: club || null
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}`,
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function onRequestOptions() { return cors(); }
