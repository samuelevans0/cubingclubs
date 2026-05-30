// functions/api/admin/create-user.js
// POST /api/admin/create-user — admin only, creates a new user account
//
// Requires either:
//   a) A valid admin session cookie, OR
//   b) The ADMIN_SECRET env variable passed as X-Admin-Secret header
//      (useful for CLI/curl usage before any accounts exist)
//
// Body: { email, password, is_admin? }

import { hashPassword, getSession, json, cors } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  // Allow bootstrap via secret header (set ADMIN_SECRET in Cloudflare dashboard)
  const headerSecret = request.headers.get("X-Admin-Secret");
  const validSecret = env.ADMIN_SECRET && headerSecret === env.ADMIN_SECRET;

  if (!validSecret) {
    const session = await getSession(request, env.DB);
    if (!session || !session.is_admin) {
      return json({ error: "Unauthorized" }, 403);
    }
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { email, password, is_admin = 0 } = body;
  if (!email || !password) return json({ error: "Email and password required" }, 400);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

  const existing = await env.DB.prepare(
    "SELECT id FROM users WHERE email = ?"
  ).bind(email.toLowerCase().trim()).first();

  if (existing) return json({ error: "A user with that email already exists" }, 409);

  const hash = await hashPassword(password);

  const result = await env.DB.prepare(
    "INSERT INTO users (email, password_hash, is_admin) VALUES (?, ?, ?)"
  ).bind(email.toLowerCase().trim(), hash, is_admin ? 1 : 0).run();

  return json({ ok: true, user_id: result.meta.last_row_id, email });
}

export async function onRequestOptions() {
  return cors();
}
