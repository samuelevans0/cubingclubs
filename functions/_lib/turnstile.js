// functions/_lib/turnstile.js
// Cloudflare Turnstile server-side verification

export async function verifyTurnstile(token, env) {
  // Dev mode: skip if no secret configured
  if (!env.TURNSTILE_SECRET) return true;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(env.TURNSTILE_SECRET)}&response=${encodeURIComponent(token || '')}`,
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false; // Fail closed — if verification can't be confirmed, don't treat the request as human
  }
}
