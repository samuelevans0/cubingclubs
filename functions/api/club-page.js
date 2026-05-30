// functions/api/club-page.js
// GET /api/club-page?slug=xxx — public club profile + upcoming meetings

import { json, cors } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return json({ error: 'slug required' }, 400);

  const club = await env.DB.prepare(
    `SELECT id, name, city, state, country, logo_url, website, description,
            contact, phone, youtube, instagram, tiktok, facebook, community_group,
            meeting_place_name, school_type, slug, calendar_url
     FROM clubs WHERE slug = ? AND approved = 1 AND visible = 1`
  ).bind(slug).first();

  if (!club) return json({ error: 'Not found' }, 404);

  const { results: meetings } = await env.DB.prepare(
    `SELECT id, meeting_type, date, time, end_time, address, address_line2, city, state, country, notes
     FROM meetings
     WHERE club_id = ? AND date >= date('now')
     ORDER BY date ASC, time ASC
     LIMIT 20`
  ).bind(club.id).all();

  return json({ club, meetings });
}

export async function onRequestOptions() { return cors(); }
