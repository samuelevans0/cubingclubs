// functions/api/auth/resend-verification.js
// POST /api/auth/resend-verification (authenticated)
import { getSession, generateToken, json, cors } from '../../_lib/auth.js';
import { sendEmail, verificationEmail } from '../../_lib/email.js';

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Not authenticated' }, 401);

  const user = await env.DB.prepare(
    'SELECT id, email, email_verified, verification_token_expires FROM users WHERE id = ?'
  ).bind(session.user_id).first();

  if (!user) return json({ error: 'User not found' }, 404);
  if (user.email_verified) return json({ error: 'Email already verified' }, 400);

  // Rate limit: don't resend if existing token was issued less than 2 minutes ago
  if (user.verification_token_expires) {
    const expiresAt = new Date(user.verification_token_expires + 'Z');
    const issuedAt = new Date(expiresAt.getTime() - 24 * 60 * 60 * 1000);
    if (Date.now() - issuedAt.getTime() < 2 * 60 * 1000) {
      return json({ error: 'Please wait a moment before requesting another email.' }, 429);
    }
  }

  const token = generateToken();
  await env.DB.prepare(
    `UPDATE users SET verification_token = ?, verification_token_expires = datetime('now', '+24 hours')
     WHERE id = ?`
  ).bind(token, user.id).run();

  const appUrl = env.APP_URL || 'https://cubingclubs.net';
  try {
    await sendEmail({
      to: user.email,
      subject: 'Verify your CubingClubs.net email',
      html: verificationEmail(`${appUrl}/verify-email?token=${token}`)
    }, env);
  } catch (err) {
    if (err.status === 429) return json({ error: 'daily_limit' }, 429);
    throw err;
  }

  return json({ ok: true });
}

export async function onRequestOptions() { return cors(); }
