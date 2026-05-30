// functions/api/auth/delete-account.js
// POST /api/auth/delete-account — authenticated user deletes their own account
// Body: { password }

import { getSession, verifyPassword, json, cors } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: "Not authenticated" }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  if (!body.password) return json({ error: "Password is required to confirm account deletion." }, 400);

  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(session.user_id).first();
  if (!user) return json({ error: "User not found" }, 404);

  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) return json({ error: "Incorrect password." }, 401);

  await env.DB.prepare("DELETE FROM meetings WHERE club_id IN (SELECT id FROM clubs WHERE user_id = ?)").bind(session.user_id).run();
  await env.DB.prepare("DELETE FROM clubs WHERE user_id = ?").bind(session.user_id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(session.user_id).run();
  await env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").bind(session.user_id).run();
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(session.user_id).run();

  return json({ ok: true });
}

export async function onRequestOptions() {
  return cors();
}
