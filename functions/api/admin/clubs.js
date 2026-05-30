// functions/api/admin/clubs.js
// GET /api/admin/clubs — admin: list all clubs with owner email

import { getSession, json, cors } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: "Unauthorized" }, 403);

  const { results } = await env.DB.prepare(
    `SELECT c.*, u.email AS user_email
     FROM clubs c
     LEFT JOIN users u ON u.id = c.user_id
     ORDER BY c.approved ASC, c.created_at DESC`
  ).all();

  return json(results);
}

export async function onRequestOptions() {
  return cors();
}
