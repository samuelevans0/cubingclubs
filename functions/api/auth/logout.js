// functions/api/auth/logout.js
// POST /api/auth/logout — clears session

import { json, cors } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([a-f0-9]+)/);
  if (match) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(match[1]).run();
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    }
  });
}

export async function onRequestOptions() {
  return cors();
}
