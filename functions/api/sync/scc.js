// POST /api/sync/scc
// Called by sodacitycubing.com after any meeting change.
// Replaces all meetings for the SCC club (id=1) with the provided list.

import { json } from "../../_lib/auth.js";

const SCC_CLUB_ID = 1;

export async function onRequestPost({ request, env }) {
  // Verify shared secret
  const secret = request.headers.get('X-Sync-Secret');
  if (!secret || secret !== env.SCC_SYNC_SECRET) {
    return json({ error: 'Unauthorized' }, 403);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const meetings = Array.isArray(body.meetings) ? body.meetings : [];

  // Wipe existing SCC meetings and re-insert the full list from SCC
  const statements = [
    env.DB.prepare("DELETE FROM meetings WHERE club_id = ?").bind(SCC_CLUB_ID),
    ...meetings.map(m =>
      env.DB.prepare(
        `INSERT INTO meetings
           (club_id, meeting_type, date, time, end_time,
            location_name, address, address_line2, city, state, country, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        SCC_CLUB_ID,
        'Club Meeting',
        m.date,
        m.start_time  || '',
        m.end_time    || '',
        m.location_name || '',
        m.address     || '',
        '',
        'Columbia',
        'South Carolina',
        'United States',
        m.notes || ''
      )
    )
  ];

  await env.DB.batch(statements);

  return json({ ok: true, synced: meetings.length });
}
