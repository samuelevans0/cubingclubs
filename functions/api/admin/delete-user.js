// functions/api/admin/delete-user.js
// POST /api/admin/delete-user — admin deletes a user and all their data
// Body: { user_id }

import { getSession, json, cors } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: "Unauthorized" }, 403);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { user_id } = body;
  if (!user_id) return json({ error: "user_id is required" }, 400);
  if (user_id === session.user_id) return json({ error: "Cannot delete your own account" }, 400);

  await env.DB.prepare("DELETE FROM clubs WHERE user_id = ?").bind(user_id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user_id).run();
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user_id).run();

  return json({ ok: true, user_id });
}

export async function onRequestOptions() {
  return cors();
}
