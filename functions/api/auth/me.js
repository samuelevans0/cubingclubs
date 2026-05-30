// functions/api/auth/me.js
import { getSession, json, cors } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Not authenticated' }, 401);

  const club = await env.DB.prepare(
    'SELECT * FROM clubs WHERE user_id = ?'
  ).bind(session.user_id).first();

  return json({
    user: {
      id: session.user_id,
      email: session.email,
      is_admin: session.is_admin,
      email_verified: session.email_verified
    },
    club: club || null
  });
}

export async function onRequestOptions() { return cors(); }
