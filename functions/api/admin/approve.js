// functions/api/admin/approve.js
// POST /api/admin/approve — admin approves or denies a club
// Approve: { club_id, approved: true }
// Deny:    { club_id, approved: false, message: "reason" }

import { getSession, json, cors } from "../../_lib/auth.js";
import { sendEmail, clubApprovedEmail, clubDeniedEmail } from "../../_lib/email.js";
import { sendPush } from "../../_lib/webpush.js";

export async function onRequestPost({ request, env, waitUntil }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.is_admin) return json({ error: "Unauthorized" }, 403);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { club_id, approved, message = "" } = body;
  if (club_id === undefined || approved === undefined) {
    return json({ error: "club_id and approved are required" }, 400);
  }

  if (approved) {
    await env.DB.prepare(
      "UPDATE clubs SET approved = 1, denial_message = '' WHERE id = ?"
    ).bind(club_id).run();
  } else {
    await env.DB.prepare(
      "UPDATE clubs SET approved = 0, denial_message = ? WHERE id = ?"
    ).bind(message, club_id).run();
  }

  // Fetch club + owner email for notifications
  const row = await env.DB.prepare(
    `SELECT c.name, c.slug, u.email
     FROM clubs c JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`
  ).bind(club_id).first();

  if (row) {
    const appUrl = env.APP_URL || "https://cubingclubs.net";
    const clubUrl = row.slug ? `${appUrl}/${row.slug}` : `${appUrl}/dashboard`;

    // Send email notification to club owner
    waitUntil(
      (async () => {
        try {
          if (approved) {
            await sendEmail({
              to: row.email,
              subject: `Your club "${row.name}" has been approved!`,
              html: clubApprovedEmail(row.name, clubUrl),
            }, env);
          } else {
            await sendEmail({
              to: row.email,
              subject: `Update on your club submission — ${row.name}`,
              html: clubDeniedEmail(row.name, message),
            }, env);
          }
        } catch (e) {
          console.error("approve email error:", e);
        }

        // Send push notification to club owner if they have a subscription
        try {
          const sub = await env.DB.prepare(
            `SELECT ps.endpoint, ps.p256dh, ps.auth
             FROM push_subscriptions ps
             JOIN clubs c ON c.user_id = ps.user_id
             WHERE c.id = ?`
          ).bind(club_id).first();

          if (sub) {
            await sendPush(sub, {
              title: approved ? "Club approved!" : "Club submission update",
              body: approved
                ? `${row.name} is now live on CubingClubs.net.`
                : `${row.name} was not approved. Check your email for details.`,
              url: "/dashboard",
            }, env);
          }
        } catch (e) {
          console.error("approve push error:", e);
        }
      })()
    );
  }

  return json({ ok: true, club_id, approved });
}

export async function onRequestOptions() {
  return cors();
}
