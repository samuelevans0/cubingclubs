// functions/_lib/webpush.js
// Web Push with aes128gcm (RFC 8291/8188) + VAPID — works on iOS Safari, Chrome, Firefox

function b64uDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

function b64uEncode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function concat(...parts) {
  const arrays = parts.map(p => p instanceof Uint8Array ? p : new Uint8Array(p));
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

async function hmacSha256(keyBytes, data) {
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

// Encrypt using aes128gcm (RFC 8188) with key agreement per RFC 8291.
// iOS Safari requires this encoding; the older aesgcm encoding does not work on iOS.
async function encryptPayload(plaintext, p256dhB64u, authB64u) {
  const enc = new TextEncoder();
  const receiverPub = b64uDecode(p256dhB64u);
  const authSecret  = b64uDecode(authB64u);
  const plain = typeof plaintext === 'string' ? enc.encode(plaintext) : new Uint8Array(plaintext);

  // Generate ephemeral sender key pair
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const senderPub = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));

  // ECDH shared secret
  const receiverKey = await crypto.subtle.importKey(
    'raw', receiverPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverKey }, ephemeral.privateKey, 256
  ));

  // RFC 8291 §3.3: IKM = HKDF(salt=auth_secret, IKM=shared_secret,
  //                             info="WebPush: info\0"||receiver_pub||sender_pub, L=32)
  const keyInfo = concat(enc.encode('WebPush: info\0'), receiverPub, senderPub);
  const sharedKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: keyInfo },
    sharedKey, 256
  ));

  // RFC 8188 §2.1: random 16-byte salt, then derive CEK (16 bytes) and nonce (12 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const ikmKey1 = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: aes128gcm\0') },
    ikmKey1, 128
  ));

  const ikmKey2 = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: nonce\0') },
    ikmKey2, 96
  ));

  // RFC 8188 §2: pad plaintext with a 0x02 delimiter byte, then AES-128-GCM encrypt
  const padded = concat(plain, new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded)
  );

  // RFC 8188 §2.1 header: salt(16) || rs(4, BE=4096) || idlen(1=65) || sender_pub(65)
  const header = new Uint8Array(86);
  header.set(salt, 0);
  header[16] = 0x00; header[17] = 0x00; header[18] = 0x10; header[19] = 0x00; // rs = 4096
  header[20] = 65;
  header.set(senderPub, 21);

  return concat(header, ciphertext);
}

// Build a VAPID Authorization header value.
async function buildVapidAuth(endpoint, privateKeyB64u, publicKeyB64u, subject) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header  = b64uEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64uEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: subject
  })));
  const signingInput = `${header}.${payload}`;

  const pubBytes = b64uDecode(publicKeyB64u);
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC', crv: 'P-256',
      d: privateKeyB64u,
      x: b64uEncode(pubBytes.slice(1, 33)),
      y: b64uEncode(pubBytes.slice(33, 65))
    },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );

  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  ));

  return `vapid t=${signingInput}.${b64uEncode(sig)},k=${publicKeyB64u}`;
}

// Send a push notification to a single subscription { endpoint, p256dh, auth }.
export async function sendPush(subscription, payload, env) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;

  const subject = env.VAPID_SUBJECT || 'mailto:cubingclubs@gmail.com';
  const { endpoint, p256dh, auth } = subscription;

  const vapidAuth = await buildVapidAuth(endpoint, env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY, subject);
  const body = await encryptPayload(JSON.stringify(payload), p256dh, auth);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': vapidAuth,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body,
  });

  if (!res.ok && res.status !== 201) {
    console.error(`Push failed for ${endpoint}: HTTP ${res.status} ${await res.text().catch(() => '')}`);
  }
}

// Send to all subscriptions in the DB (admins, and any club owners who opted in).
export async function notifyAdmins(payload, env) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;
  try {
    const { results } = await env.DB.prepare(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions'
    ).all();
    await Promise.allSettled((results || []).map(s => sendPush(s, payload, env)));
  } catch (e) {
    console.error('notifyAdmins error:', e);
  }
}
