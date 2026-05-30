// functions/api/geo.js
// Returns the user's approximate location from Cloudflare's edge geo data.
// No external API needed — Cloudflare provides this automatically.

export function onRequestGet({ request }) {
  const cf = request.cf || {};
  const lat = cf.latitude != null ? parseFloat(cf.latitude) : null;
  const lng = cf.longitude != null ? parseFloat(cf.longitude) : null;
  return new Response(JSON.stringify({
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    country: cf.country || null,
    city: cf.city || null,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    }
  });
}
