// functions/api/admin/club/update.js
// POST /api/admin/club/update — admin edits any club by id
// Body: { club_id, ...fields }

import { getSession, json, cors } from "../../../_lib/auth.js";

const ALLOWED_FIELDS = [
  "name", "slug", "meeting_place_name", "address", "city", "state", "country", "lat", "lng",
  "website", "description", "logo_url", "contact",
  "youtube", "instagram", "tiktok", "facebook", "community_group", "phone",
  "approved", "visible", "denial_message",
  "def_time", "def_end_time", "def_location_name", "def_address", "def_address_line2", "def_city", "def_state", "def_country"
];

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: "Unauthorized" }, 403);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { club_id, ...fields } = body;
  if (!club_id) return json({ error: "club_id is required" }, 400);

  const updates = [];
  const values = [];
  for (const field of ALLOWED_FIELDS) {
    if (fields[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(fields[field]);
    }
  }

  if (updates.length === 0) return json({ error: "No fields to update" }, 400);

  updates.push("updated_at = datetime('now')");
  values.push(club_id);

  await env.DB.prepare(
    `UPDATE clubs SET ${updates.join(", ")} WHERE id = ?`
  ).bind(...values).run();

  const club = await env.DB.prepare(
    "SELECT c.*, u.email AS user_email FROM clubs c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?"
  ).bind(club_id).first();

  return json({ ok: true, club });
}

export async function onRequestOptions() {
  return cors();
}
