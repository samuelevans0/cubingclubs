// functions/api/admin/delete-club.js
// POST /api/admin/delete-club — admin deletes a club (keeps the user account)
// Body: { club_id }

import { getSession, json, cors } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: "Unauthorized" }, 403);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { club_id } = body;
  if (!club_id) return json({ error: "club_id is required" }, 400);

  await env.DB.prepare("DELETE FROM clubs WHERE id = ?").bind(club_id).run();

  return json({ ok: true, club_id });
}

export async function onRequestOptions() {
  return cors();
}
