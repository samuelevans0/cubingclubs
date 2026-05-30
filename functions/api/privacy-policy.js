// functions/api/privacy-policy.js
// GET /api/privacy-policy — public: returns current privacy policy content

import { json, cors } from "../_lib/auth.js";

export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM site_settings WHERE key = 'privacy_policy'"
    ).first();
    return json({ content: row?.value || "" });
  } catch {
    return json({ content: "" });
  }
}

export async function onRequestOptions() {
  return cors();
}
