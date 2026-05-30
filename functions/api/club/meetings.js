// functions/api/club/meetings.js
// GET|POST|PUT|DELETE /api/club/meetings — club owner manages their meetings

import { getSession, json } from '../../_lib/auth.js';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function getClub(session, db) {
  return db.prepare('SELECT id FROM clubs WHERE user_id = ?').bind(session.user_id).first();
}

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Not authenticated' }, 401);

  const club = await getClub(session, env.DB);
  if (!club) return json({ meetings: [] });

  const url = new URL(request.url);
  const includePast = url.searchParams.get('past') === '1';

  const query = includePast
    ? "SELECT * FROM meetings WHERE club_id = ? AND date < date('now') ORDER BY date DESC, time DESC"
    : "SELECT * FROM meetings WHERE club_id = ? AND date >= date('now') ORDER BY date ASC, time ASC";

  const { results } = await env.DB.prepare(query).bind(club.id).all();
  return json({ meetings: results });
}

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Not authenticated' }, 401);

  const club = await getClub(session, env.DB);
  if (!club) return json({ error: 'No club found' }, 404);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
    return json({ error: 'Valid date (YYYY-MM-DD) is required' }, 400);

  const today = new Date().toISOString().split('T')[0];
  if (body.date < today)
    return json({ error: 'Meeting date cannot be in the past.' }, 400);

  const result = await env.DB.prepare(
    `INSERT INTO meetings (club_id, meeting_type, date, time, end_time, location_name, address, address_line2, city, state, country, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    club.id,
    body.meeting_type || '',
    body.date,
    body.time || '',
    body.end_time || '',
    body.location_name || '',
    body.address || '',
    body.address_line2 || '',
    body.city || '',
    body.state || '',
    body.country || '',
    body.notes || ''
  ).run();

  const meeting = await env.DB.prepare('SELECT * FROM meetings WHERE id = ?')
    .bind(result.meta.last_row_id).first();
  return json({ ok: true, meeting });
}

export async function onRequestPut({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Not authenticated' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  if (!body.id) return json({ error: 'id is required' }, 400);
  if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
    return json({ error: 'Valid date (YYYY-MM-DD) is required' }, 400);

  const owned = await env.DB.prepare(
    `SELECT m.id FROM meetings m JOIN clubs c ON c.id = m.club_id
     WHERE m.id = ? AND c.user_id = ?`
  ).bind(body.id, session.user_id).first();
  if (!owned) return json({ error: 'Meeting not found' }, 404);

  await env.DB.prepare(
    `UPDATE meetings SET meeting_type=?, date=?, time=?, end_time=?,
     location_name=?, address=?, address_line2=?, city=?, state=?, country=?, notes=?
     WHERE id = ?`
  ).bind(
    body.meeting_type || '',
    body.date || '',
    body.time || '',
    body.end_time || '',
    body.location_name || '',
    body.address || '',
    body.address_line2 || '',
    body.city || '',
    body.state || '',
    body.country || '',
    body.notes || '',
    body.id
  ).run();

  const meeting = await env.DB.prepare('SELECT * FROM meetings WHERE id = ?').bind(body.id).first();
  return json({ ok: true, meeting });
}

export async function onRequestDelete({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: 'Not authenticated' }, 401);

  const url = new URL(request.url);
  const id = parseInt(url.searchParams.get('id'));
  if (!id) return json({ error: 'id is required' }, 400);

  const owned = await env.DB.prepare(
    `SELECT m.id FROM meetings m JOIN clubs c ON c.id = m.club_id
     WHERE m.id = ? AND c.user_id = ?`
  ).bind(id, session.user_id).first();
  if (!owned) return json({ error: 'Meeting not found' }, 404);

  await env.DB.prepare('DELETE FROM meetings WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
