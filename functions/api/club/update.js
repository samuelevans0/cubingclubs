// functions/api/club/update.js
// POST /api/club/update — create or update the logged-in user's club

import { getSession, json, cors } from "../../_lib/auth.js";
import { notifyAdmins } from "../../_lib/webpush.js";

const ALLOWED_FIELDS = [
  "name", "slug", "meeting_place_name", "address", "address_line2", "city", "state", "country", "lat", "lng",
  "postal_code", "school_type",
  "website", "description", "logo_url", "photo_url", "contact",
  "youtube", "instagram", "tiktok", "facebook", "community_group", "phone",
  "def_time", "def_end_time", "def_location_name", "def_address", "def_address_line2", "def_city", "def_state", "def_country"
];

const SOCIAL_DOMAINS = {
  youtube:   ["youtube.com", "youtu.be"],
  instagram: ["instagram.com"],
  tiktok:    ["tiktok.com"],
  facebook:  ["facebook.com"],
};

function validateSocials(body) {
  for (const [field, domains] of Object.entries(SOCIAL_DOMAINS)) {
    const val = body[field];
    if (!val) continue;
    const ok = domains.some(d => val.includes(d));
    if (!ok) return `${field} URL must be a ${domains[0]} link`;
  }
  return null;
}

async function generateSlug(name, db) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 55);
  if (!base) return '';
  let candidate = base;
  let n = 1;
  while (true) {
    const taken = await db.prepare('SELECT id FROM clubs WHERE slug = ?').bind(candidate).first();
    if (!taken) return candidate;
    candidate = base + n;
    n++;
  }
}

async function geocode(body) {
  try {
    const params = new URLSearchParams({ format: "json", limit: "1" });
    const street = [body.address, body.address_line2].filter(Boolean).join(", ");
    if (street) params.set("street", street);
    if (body.city) params.set("city", body.city);
    if (body.state) params.set("state", body.state);
    if (body.postal_code) params.set("postalcode", body.postal_code);
    if (body.country) params.set("country", body.country);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "CubingClubs/1.0 (cubingclubs.net)" }
    });
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ error: "Not authenticated" }, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  if (!session.email_verified) return json({ error: "Please verify your email address before saving your club." }, 403);

  if (!body.name) return json({ error: "Club name is required" }, 400);

  // Field length caps — prevent oversized payloads from bloating D1
  const LIMITS = {
    name: 120, slug: 60, meeting_place_name: 200,
    address: 200, address_line2: 200, city: 100, state: 100,
    country: 100, postal_code: 20, school_type: 50,
    website: 500, description: 5000, logo_url: 500, photo_url: 500,
    contact: 200, youtube: 500, instagram: 500, tiktok: 500,
    facebook: 500, community_group: 500, phone: 30,
    def_time: 10, def_end_time: 10, def_location_name: 200,
    def_address: 200, def_address_line2: 200,
    def_city: 100, def_state: 100, def_country: 100,
  };
  for (const [field, max] of Object.entries(LIMITS)) {
    if (typeof body[field] === 'string' && body[field].length > max) {
      return json({ error: `${field} exceeds maximum length of ${max} characters` }, 400);
    }
  }

  const socialErr = validateSocials(body);
  if (socialErr) return json({ error: socialErr }, 400);

  const hasContact = body.contact || body.phone || body.instagram || body.facebook || body.tiktok;
  if (!hasContact) return json({ error: "Please provide at least one way to contact your club (email, phone, Instagram, Facebook, or TikTok)." }, 400);

  if (!body.description || body.description.trim().length < 25) return json({ error: "Description must be at least 25 characters." }, 400);

  // Validate + uniqueness-check slug
  if (body.slug !== undefined) {
    body.slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    if (body.slug) {
      const existingSlug = await env.DB.prepare(
        'SELECT id FROM clubs WHERE slug = ? AND user_id != ?'
      ).bind(body.slug, session.user_id).first();
      if (existingSlug) return json({ error: 'That profile URL is already taken.' }, 409);
    }
  }

  if (body.address || body.city || body.postal_code) {
    const geo = await geocode(body);
    if (geo) {
      body.lat = geo.lat;
      body.lng = geo.lng;
    }
  }

  const existing = await env.DB.prepare(
    "SELECT id FROM clubs WHERE user_id = ?"
  ).bind(session.user_id).first();

  if (existing) {
    const updates = [];
    const values = [];
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }
    updates.push("updated_at = datetime('now')");
    values.push(session.user_id);
    await env.DB.prepare(
      `UPDATE clubs SET ${updates.join(", ")} WHERE user_id = ?`
    ).bind(...values).run();
  } else {
    const autoSlug = body.slug || await generateSlug(body.name, env.DB);
    await env.DB.prepare(
      `INSERT INTO clubs (user_id, name, slug, meeting_place_name, address, address_line2, city, state, country, postal_code, school_type, lat, lng,
        website, description, logo_url, contact,
        youtube, instagram, tiktok, facebook, community_group, phone, approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(
      session.user_id,
      body.name || "", autoSlug, body.meeting_place_name || "", body.address || "", body.address_line2 || "",
      body.city || "", body.state || "", body.country || "",
      body.postal_code || "", body.school_type || "",
      body.lat || null, body.lng || null,
      body.website || "", body.description || "",
      body.logo_url || "", body.contact || "",
      body.youtube || "", body.instagram || "",
      body.tiktok || "", body.facebook || "",
      body.community_group || "", body.phone || ""
    ).run();

    // Notify admins — use waitUntil so the Worker doesn't terminate early
    waitUntil(notifyAdmins({
      title: "New Club Submission",
      body: `${body.name} submitted by ${session.email}`
    }, env).catch(() => {}));
  }

  const club = await env.DB.prepare(
    "SELECT * FROM clubs WHERE user_id = ?"
  ).bind(session.user_id).first();

  return json({ ok: true, club });
}

export async function onRequestOptions() {
  return cors();
}
