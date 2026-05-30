// functions/api/auth/forgot-password.js
// POST /api/auth/forgot-password — { email, turnstile_token }
import { generateToken, json, cors } from '../../_lib/auth.js';
import { verifyTurnstile } from '../../_lib/turnstile.js';
import { sendEmail, passwordResetEmail } from '../../_lib/email.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { email, turnstile_token } = body;
  if (!email) return json({ error: 'Email required' }, 400);

  const ok = await verifyTurnstile(turnstile_token, env);
  if (!ok) return json({ error: 'Human verification failed. Please try again.' }, 400);

  // Always return success to avoid revealing whether an account exists
  const user = await env.DB.prepare(
    'SELECT id, email, reset_token_expires FROM users WHERE email = ?'
  ).bind(email.toLowerCase().trim()).first();

  if (user) {
    // Rate limit: max one reset email per 5 minutes
    if (user.reset_token_expires) {
      const expiresAt = new Date(user.reset_token_expires + 'Z');
      const issuedAt = new Date(expiresAt.getTime() - 60 * 60 * 1000);
      if (Date.now() - issuedAt.getTime() < 5 * 60 * 1000) {
        return json({ ok: true }); // Silently rate-limit
      }
    }

    const token = generateToken();
    await env.DB.prepare(
      `UPDATE users SET reset_token = ?, reset_token_expires = datetime('now', '+1 hour') WHERE id = ?`
    ).bind(token, user.id).run();

    const appUrl = env.APP_URL || 'https://cubingclubs.net';
    sendEmail({
      to: user.email,
      subject: 'Reset your CubingClubs.net password',
      html: passwordResetEmail(`${appUrl}/reset-password?token=${token}`)
    }, env).catch(err => console.error('Reset email failed:', err));
  }

  return json({ ok: true });
}

export async function onRequestOptions() { return cors(); }
