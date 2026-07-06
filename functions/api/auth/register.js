// functions/api/auth/register.js
import { hashPassword, generateToken, json, cors } from '../../_lib/auth.js';
import { verifyTurnstile } from '../../_lib/turnstile.js';
import { sendEmail, verificationEmail } from '../../_lib/email.js';

export async function onRequestPost({ request, env, waitUntil }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { email, password, turnstile_token } = body;
  if (!email || !password) return json({ error: 'Email and password required' }, 400);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email.trim())) {
    return json({ error: 'Please enter a valid email address' }, 400);
  }
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

  const ok = await verifyTurnstile(turnstile_token, env);
  if (!ok) return json({ error: 'Human verification failed. Please try again.' }, 400);

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(normalizedEmail).first();
  if (existing) return json({ error: 'An account with this email already exists' }, 400);

  const hash = await hashPassword(password);
  const verifyToken = generateToken();
  const result = await env.DB.prepare(
    `INSERT INTO users (email, password_hash, is_admin, email_verified, verification_token, verification_token_expires)
     VALUES (?, ?, 0, 0, ?, datetime('now', '+24 hours'))`
  ).bind(normalizedEmail, hash, verifyToken).run();

  const userId = result.meta.last_row_id;
  const sessionToken = generateToken();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))"
  ).bind(sessionToken, userId).run();

  // Send verification email — waitUntil keeps the worker alive until it completes
  const appUrl = env.APP_URL || 'https://cubingclubs.net';
  waitUntil(sendEmail({
    to: normalizedEmail,
    subject: 'Verify your CubingClubs.net email',
    html: verificationEmail(`${appUrl}/verify-email?token=${verifyToken}`)
  }, env).catch(err => console.error('Verify email send failed:', err)));

  return new Response(JSON.stringify({
    ok: true,
    user: { id: userId, email: normalizedEmail, is_admin: 0, email_verified: 0 },
    club: null
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}`,
      'Access-Control-Allow-Origin': 'https://cubingclubs.net'
    }
  });
}

export async function onRequestOptions() { return cors(); }
