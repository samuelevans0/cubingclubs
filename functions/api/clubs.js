// functions/api/clubs.js
// GET /api/clubs — returns all approved+visible clubs with next upcoming meeting

import { json, cors } from "../_lib/auth.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.slug, c.meeting_place_name, c.city, c.state, c.country,
            c.lat, c.lng, c.address, c.website, c.description, c.logo_url, c.contact,
            c.youtube, c.instagram, c.tiktok, c.facebook,
            c.community_group, c.phone, c.school_type,
            m.date  AS next_meeting_date,
            m.time  AS next_meeting_time,
            m.meeting_type AS next_meeting_type
     FROM clubs c
     LEFT JOIN meetings m ON m.id = (
       SELECT id FROM meetings
       WHERE club_id = c.id AND date >= date('now')
       ORDER BY date ASC, time ASC
       LIMIT 1
     )
     WHERE c.approved = 1 AND c.visible = 1
     ORDER BY c.name ASC`
  ).all();
  return json(results);
}

export async function onRequestOptions() {
  return cors();
}
