// functions/api/club/toggle-visibility.js
// POST /api/club/toggle-visibility — club owner sets their club visible/hidden

import { getSession, json, cors } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: "Not authenticated" }, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { visible } = body;
  if (visible === undefined) return json({ error: "visible is required" }, 400);

  const result = await env.DB.prepare(
    "UPDATE clubs SET visible = ?, updated_at = datetime('now') WHERE user_id = ?"
  ).bind(visible ? 1 : 0, session.user_id).run();

  if (result.meta.changes === 0) return json({ error: "No club found for this account" }, 404);

  return json({ ok: true, visible: visible ? 1 : 0 });
}

export async function onRequestOptions() {
  return cors();
}
