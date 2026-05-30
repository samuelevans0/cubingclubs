// functions/api/admin/create-club.js
// POST /api/admin/create-club — admin creates a club not tied to any user account
// Body: { name, city, country, ...any other club fields }

import { getSession, json, cors } from '../../_lib/auth.js';

async function generateSlug(name, db) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 55);
  if (!base) return '';
  let candidate = base, n = 1;
  while (true) {
    const taken = await db.prepare('SELECT id FROM clubs WHERE slug = ?').bind(candidate).first();
    if (!taken) return candidate;
    candidate = base + n++;
  }
}

async function geocode(body) {
  try {
    const params = new URLSearchParams({ format: 'json', limit: '1' });
    const street = [body.address, body.address_line2].filter(Boolean).join(', ');
    if (street)          params.set('street',     street);
    if (body.city)       params.set('city',        body.city);
    if (body.state)      params.set('state',       body.state);
    if (body.postal_code)params.set('postalcode',  body.postal_code);
    if (body.country)    params.set('country',     body.country);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'CubingClubs/1.0 (cubingclubs.net)' }
    });
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { return null; }
}

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: 'Unauthorized' }, 403);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  if (!body.name) return json({ error: 'Club name is required' }, 400);

  // Auto-geocode if no coordinates provided
  if (!body.lat && !body.lng && (body.address || body.city || body.country)) {
    const geo = await geocode(body);
    if (geo) { body.lat = geo.lat; body.lng = geo.lng; }
  }

  const slug = body.slug || await generateSlug(body.name, env.DB);

  const result = await env.DB.prepare(
    `INSERT INTO clubs (
      user_id, name, slug, meeting_place_name, address, address_line2, city, state, country,
      postal_code, school_type, lat, lng, website, description, logo_url, photo_url, contact,
      youtube, instagram, tiktok, facebook, community_group, phone,
      approved, visible
    ) VALUES (
      NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1
    )`
  ).bind(
    body.name || '',
    slug,
    body.meeting_place_name || '',
    body.address        || '',
    body.address_line2  || '',
    body.city           || '',
    body.state          || '',
    body.country        || '',
    body.postal_code    || '',
    body.school_type    || '',
    body.lat  ?? null,
    body.lng  ?? null,
    body.website        || '',
    body.description    || '',
    body.logo_url       || '',
    body.photo_url      || '',
    body.contact        || '',
    body.youtube        || '',
    body.instagram      || '',
    body.tiktok         || '',
    body.facebook       || '',
    body.community_group|| '',
    body.phone          || ''
  ).run();

  const club = await env.DB.prepare(
    'SELECT * FROM clubs WHERE id = ?'
  ).bind(result.meta.last_row_id).first();

  return json({ ok: true, club });
}

export async function onRequestOptions() { return cors(); }
