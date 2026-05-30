// functions/[slug].js
// Serves club profile pages at /:slug with full server-side SEO injection:
//   - keyword-rich <title>, meta description, keywords, Open Graph, Twitter Card
//   - comprehensive JSON-LD (SportsClub + LocalBusiness) with geo + meetings
//   - SSR content block replacing the JS loading placeholder so Googlebot reads real content

const STATIC_PAGES = new Set([
  'dashboard', 'signup', 'admin', 'verify-email',
  'forgot-password', 'reset-password', 'club', 'privacy-policy',
]);

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Build every relevant keyword variant for a location
function locationKeywords(name, city, state, country) {
  const loc = [city, state].filter(Boolean);
  const locFull = [city, state, country].filter(Boolean);
  const terms = ['speedcubing', "Rubik's cube", 'cubing', 'Rubik\'s cubing'];
  const types = ['club', 'clubs', 'competition', 'competitions', 'community', 'group'];
  const kws = new Set();

  // Club name itself
  if (name) kws.add(name);

  // Term + type combos
  for (const t of terms) {
    for (const tp of types) {
      kws.add(`${t} ${tp}`);
      for (const l of loc) { kws.add(`${t} ${tp} ${l}`); kws.add(`${t} ${l} ${tp}`); }
      if (country) { kws.add(`${t} ${tp} ${country}`); }
    }
    for (const l of loc) { kws.add(`${t} ${l}`); }
    if (country) kws.add(`${t} ${country}`);
  }

  // Generic location combos
  if (city)  kws.add(`cubing club ${city}`);
  if (state) kws.add(`cubing club ${state}`);
  if (city)  kws.add(`speedcubing ${city}`);
  if (state) kws.add(`speedcubing ${state}`);
  if (city)  kws.add(`Rubik's cube club ${city}`);
  if (state) kws.add(`Rubik's cube club ${state}`);
  if (locFull.length) kws.add(`cubing club near ${locFull.join(', ')}`);
  kws.add('cubing club near me');
  kws.add('speedcubing club near me');

  return [...kws].join(', ');
}

// Build a rich, natural-language description hitting all keyword variants
function buildDescription(club, meetings) {
  const loc = [club.city, club.state, club.country].filter(Boolean).join(', ');
  const cityState = [club.city, club.state].filter(Boolean).join(', ');

  let desc = '';

  if (club.description && club.description.trim().length > 20) {
    // Prepend location context to club's own description
    const base = club.description.length > 120
      ? club.description.slice(0, 117) + '...'
      : club.description;
    desc = `${base} `;
  }

  desc += `${club.name} is a speedcubing and Rubik's Cube club${loc ? ' in ' + loc : ''}.`;

  if (cityState) {
    desc += ` Find Rubik's cube meetings, cubing competitions, and connect with local cubers in ${cityState}.`;
  }

  return desc.trim().slice(0, 300);
}

// Day-of-week map for JSON-LD openingHours
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function meetingToOpeningHours(m) {
  if (!m.date || !m.time) return null;
  try {
    const day = DAYS[new Date(m.date + 'T12:00:00').getDay()];
    const fmt = t => t ? t.slice(0,5) : null;
    const open = fmt(m.time);
    const close = fmt(m.end_time);
    if (!open) return null;
    return close ? `${day} ${open}-${close}` : `${day} ${open}`;
  } catch { return null; }
}


export async function onRequest({ request, env, params }) {
  const slug = params.slug;

  if (!slug || slug.includes('.') || STATIC_PAGES.has(slug)) {
    return env.ASSETS.fetch(request);
  }

  // Fetch club + meetings in parallel
  const [club, meetingsRes] = await Promise.all([
    env.DB.prepare(
      `SELECT id, name, slug, city, state, country, description, logo_url, photo_url,
              meeting_place_name, address, lat, lng,
              website, youtube, instagram, tiktok, facebook, community_group, school_type
       FROM clubs WHERE slug = ? AND approved = 1 AND visible = 1`
    ).bind(slug).first(),
    env.DB.prepare(
      `SELECT meeting_type, date, time, end_time, city, state, country
       FROM meetings WHERE club_id = (
         SELECT id FROM clubs WHERE slug = ? AND approved = 1 AND visible = 1
       ) AND date >= date('now') ORDER BY date ASC, time ASC LIMIT 10`
    ).bind(slug).all(),
  ]);

  if (!club) {
    return new Response(
      '<!DOCTYPE html><html lang="en"><head><title>Club Not Found — CubingClubs.net</title><link rel="canonical" href="https://cubingclubs.net/" /></head><body style="font-family:sans-serif;text-align:center;padding:4rem"><h1>Club not found</h1><p><a href="/">Browse all clubs</a></p></body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  const meetings = meetingsRes?.results ?? [];

  // ── SEO values ────────────────────────────────────────────────────────────
  const loc      = [club.city, club.state, club.country].filter(Boolean).join(', ');
  const cityState = [club.city, club.state].filter(Boolean).join(', ');
  const pageUrl  = `https://cubingclubs.net/${club.slug}`;
  const image    = (club.logo_url  && club.logo_url.startsWith('http'))  ? club.logo_url
                 : (club.photo_url && club.photo_url.startsWith('http')) ? club.photo_url
                 : 'https://cubingclubs.net/logo.png';

  // Title: club name + location + type hint
  const titleLoc = cityState ? `, ${cityState}` : (club.country ? `, ${club.country}` : '');
  const title = `${club.name} — Speedcubing & Rubik's Cube Club${titleLoc} | CubingClubs.net`;

  // Meta description: natural prose covering all keyword variants
  const description = buildDescription(club, meetings);

  // Keywords meta (Bing + others still use this)
  const keywords = locationKeywords(club.name, club.city, club.state, club.country);

  // ── JSON-LD ───────────────────────────────────────────────────────────────
  const sameAs = [
    club.website,
    club.youtube,
    club.instagram  ? `https://instagram.com/${club.instagram.replace(/^@/,'')}` : null,
    club.tiktok     ? `https://tiktok.com/@${club.tiktok.replace(/^@/,'')}` : null,
    club.facebook,
    club.community_group,
  ].filter(u => u && u.startsWith('http'));

  const openingHours = meetings
    .map(meetingToOpeningHours)
    .filter(Boolean)
    .slice(0, 10);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': ['SportsClub', 'LocalBusiness'],
    'name': club.name,
    'description': description,
    'url': pageUrl,
    'image': image,
    'sport': 'Speedcubing',
    'keywords': `speedcubing, Rubik's cube, cubing club, cubing competitions${loc ? ', ' + loc : ''}`,
    ...(loc ? { 'address': {
      '@type': 'PostalAddress',
      ...(club.city    ? { 'addressLocality': club.city }   : {}),
      ...(club.state   ? { 'addressRegion':   club.state }  : {}),
      ...(club.country ? { 'addressCountry':  club.country }: {}),
    }} : {}),
    ...(club.lat && club.lng ? { 'geo': {
      '@type': 'GeoCoordinates',
      'latitude':  club.lat,
      'longitude': club.lng,
    }} : {}),
    ...(sameAs.length       ? { 'sameAs': sameAs }                    : {}),
    ...(openingHours.length ? { 'openingHours': openingHours }        : {}),
    'parentOrganization': {
      '@type': 'Organization',
      'name': 'CubingClubs.net',
      'url': 'https://cubingclubs.net',
    },
  };

  // ── Head injection ────────────────────────────────────────────────────────
  const headInjection = `<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="keywords" content="${esc(keywords)}" />
<link rel="canonical" href="${pageUrl}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:site_name" content="CubingClubs.net" />
<meta property="og:locale" content="en_US" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta name="geo.region" content="${esc([club.state, club.country].filter(Boolean).join('-'))}" />
${club.city ? `<meta name="geo.placename" content="${esc(club.city)}" />` : ''}
${club.lat && club.lng ? `<meta name="geo.position" content="${club.lat};${club.lng}" />
<meta name="ICBM" content="${club.lat}, ${club.lng}" />` : ''}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

  // ── Patch club.html ───────────────────────────────────────────────────────
  const assetUrl = new URL('/club.html', request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl.toString(), { headers: request.headers }));
  let html = await assetResponse.text();

  // Replace generic title + inject all head meta
  html = html.replace('<title>Club — CubingClubs.net</title>', headInjection);

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
    },
  });
}
