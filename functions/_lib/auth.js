// functions/_lib/auth.js
// Shared auth helpers

// Hash password with per-user random salt (format: "v2:{saltHex}:{hashB64}")
// Backwards-compatible with old static-salt hashes during verify.
export async function hashPassword(password) {
  const enc = new TextEncoder();
  const saltArr = new Uint8Array(16);
  crypto.getRandomValues(saltArr);
  const saltHex = Array.from(saltArr).map(b => b.toString(16).padStart(2, '0')).join('');
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltArr, iterations: 100000 },
    key, 256
  );
  return `v2:${saltHex}:${btoa(String.fromCharCode(...new Uint8Array(bits)))}`;
}

export async function verifyPassword(password, storedHash) {
  const enc = new TextEncoder();
  if (!storedHash) return false;
  if (!storedHash.startsWith('v2:')) {
    // Legacy: static salt
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('globalcubing-salt-v1'), iterations: 100000 },
      key, 256
    );
    return btoa(String.fromCharCode(...new Uint8Array(bits))) === storedHash;
  }
  const [, saltHex, hashB64] = storedHash.split(':');
  const saltArr = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltArr, iterations: 100000 },
    key, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits))) === hashB64;
}

export function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getSession(request, DB) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([a-f0-9]+)/);
  if (!match) return null;
  const session = await DB.prepare(
    `SELECT s.user_id, u.email, u.is_admin, u.email_verified
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(match[1]).first();
  return session || null;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

export function cors() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
