// functions/api/admin/privacy-policy.js
// GET  /api/admin/privacy-policy — admin: read current policy
// POST /api/admin/privacy-policy — admin: save new policy content

import { getSession, json, cors } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: "Unauthorized" }, 403);

  try {
    const row = await env.DB.prepare(
      "SELECT value FROM site_settings WHERE key = 'privacy_policy'"
    ).first();
    return json({ content: row?.value || "" });
  } catch {
    return json({ content: "" });
  }
}

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: "Unauthorized" }, 403);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { content } = body;
  if (typeof content !== "string") return json({ error: "content is required" }, 400);

  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')"
  ).run();

  await env.DB.prepare(
    "INSERT OR REPLACE INTO site_settings (key, value) VALUES ('privacy_policy', ?)"
  ).bind(content).run();

  return json({ ok: true });
}

export async function onRequestOptions() {
  return cors();
}
