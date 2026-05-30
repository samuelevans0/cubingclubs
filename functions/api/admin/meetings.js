// functions/api/admin/meetings.js
// GET|POST|PUT|DELETE /api/admin/meetings — admin manages meetings for any club

import { getSession, json, cors } from "../../_lib/auth.js";

export function onRequestOptions() {
  return cors();
}

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: "Unauthorized" }, 403);

  const url = new URL(request.url);
  const club_id = parseInt(url.searchParams.get("club_id"));
  if (!club_id) return json({ error: "club_id is required" }, 400);

  const { results } = await env.DB.prepare(
    "SELECT * FROM meetings WHERE club_id = ? ORDER BY date ASC, time ASC"
  ).bind(club_id).all();
  return json({ meetings: results });
}

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: "Unauthorized" }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { club_id } = body;
  if (!club_id) return json({ error: "club_id is required" }, 400);
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
    return json({ error: "Valid date (YYYY-MM-DD) is required" }, 400);

  const result = await env.DB.prepare(
    `INSERT INTO meetings (club_id, meeting_type, date, time, end_time, location_name, address, address_line2, city, state, country, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    club_id, body.meeting_type || '', body.date,
    body.time || '', body.end_time || '', body.location_name || '',
    body.address || '', body.address_line2 || '',
    body.city || '', body.state || '', body.country || '', body.notes || ''
  ).run();

  const meeting = await env.DB.prepare("SELECT * FROM meetings WHERE id = ?")
    .bind(result.meta.last_row_id).first();
  return json({ ok: true, meeting });
}

export async function onRequestPut({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: "Unauthorized" }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  if (!body.id) return json({ error: "id is required" }, 400);
  if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
    return json({ error: "Valid date (YYYY-MM-DD) is required" }, 400);

  const exists = await env.DB.prepare("SELECT id FROM meetings WHERE id = ?").bind(body.id).first();
  if (!exists) return json({ error: "Meeting not found" }, 404);

  await env.DB.prepare(
    `UPDATE meetings SET meeting_type=?, date=?, time=?, end_time=?,
     location_name=?, address=?, address_line2=?, city=?, state=?, country=?, notes=?
     WHERE id = ?`
  ).bind(
    body.meeting_type || '', body.date || '', body.time || '', body.end_time || '',
    body.location_name || '', body.address || '', body.address_line2 || '',
    body.city || '', body.state || '', body.country || '', body.notes || '',
    body.id
  ).run();

  const meeting = await env.DB.prepare("SELECT * FROM meetings WHERE id = ?").bind(body.id).first();
  return json({ ok: true, meeting });
}

export async function onRequestDelete({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: "Unauthorized" }, 403);

  const url = new URL(request.url);
  const id = parseInt(url.searchParams.get("id"));
  if (!id) return json({ error: "id is required" }, 400);

  const exists = await env.DB.prepare("SELECT id FROM meetings WHERE id = ?").bind(id).first();
  if (!exists) return json({ error: "Meeting not found" }, 404);

  await env.DB.prepare("DELETE FROM meetings WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
