// functions/api/admin/users.js
// GET /api/admin/users — admin: list all users with their club info

import { getSession, json, cors } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: "Unauthorized" }, 403);

  const { results } = await env.DB.prepare(
    `SELECT u.id, u.email, u.is_admin, u.created_at,
            c.id AS club_id, c.name AS club_name,
            c.approved AS club_approved, c.visible AS club_visible
     FROM users u
     LEFT JOIN clubs c ON c.user_id = u.id
     ORDER BY u.created_at DESC`
  ).all();

  return json(results);
}

export async function onRequestOptions() {
  return cors();
}
