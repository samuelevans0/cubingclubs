// functions/api/admin/test-email.js
// GET /api/admin/test-email — admin-only, sends a test email and returns result
import { getSession, json } from '../../_lib/auth.js';
import { sendEmail } from '../../_lib/email.js';

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: 'Unauthorized' }, 403);

  const hasKey = !!env.RESEND_API_KEY;
  const from = env.EMAIL_FROM || 'CubingClubs.net <noreply@globalcubing.com>';

  if (!hasKey) {
    return json({ error: 'RESEND_API_KEY is not set or empty', hasKey, from });
  }

  try {
    await sendEmail({
      to: session.email,
      subject: 'CubingClubs.net — test email',
      html: '<p>This is a test email from the CubingClubs.net diagnostic endpoint.</p>'
    }, env);
    return json({ ok: true, sentTo: session.email, from });
  } catch (err) {
    return json({ error: err.message, status: err.status, from });
  }
}
