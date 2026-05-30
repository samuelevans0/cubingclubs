// functions/_lib/email.js
// Transactional email via Resend (resend.com)

const S = `
body{font-family:Arial,sans-serif;background:#F6F7F9;margin:0;padding:40px 20px}
.w{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #E4E7EC}
.logo{text-align:center;margin-bottom:28px}
.li{display:inline-block;background:#1A56DB;border-radius:10px;padding:10px 12px;margin-bottom:8px}
.lt{font-size:18px;font-weight:700;color:#111827}
.lt span{color:#1A56DB}
h1{font-size:22px;color:#111827;margin:0 0 10px}
p{color:#4B5563;font-size:15px;line-height:1.6;margin:0 0 20px}
.btn{display:block;text-align:center;background:#1A56DB;color:#fff!important;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:600;font-size:15px;margin-bottom:20px}
.link{color:#1A56DB;word-break:break-all;font-size:12px;text-align:center;display:block;margin-bottom:16px}
.small{color:#9CA3AF;font-size:12px;text-align:center;margin:0}
`;

const LOGO = `<div class="logo">
  <img src="https://cubingclubs.net/logo.png" width="48" height="48" alt="CubingClubs.net" style="border-radius:10px;display:block;margin:0 auto 8px;" />
  <div class="lt">CubingClubs<span>.net</span></div>
</div>`;

function wrap(body) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${S}</style></head><body><div class="w">${LOGO}${body}</div></body></html>`;
}

export function verificationEmail(link) {
  return wrap(`
    <h1>Verify your email</h1>
    <p>Thanks for signing up for CubingClubs.net! Click below to verify your email address and activate your account.</p>
    <a class="btn" href="${link}">Verify Email Address</a>
    <span class="link">${link}</span>
    <p class="small">Link expires in 24 hours. If you didn't create an account, ignore this email.</p>
  `);
}

export function passwordResetEmail(link) {
  return wrap(`
    <h1>Reset your password</h1>
    <p>We received a request to reset your CubingClubs.net password. Click below to choose a new one.</p>
    <a class="btn" href="${link}">Reset Password</a>
    <span class="link">${link}</span>
    <p class="small">Link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  `);
}

export function emailChangeEmail(link, newEmail) {
  return wrap(`
    <h1>Confirm your new email</h1>
    <p>Click below to confirm <strong>${newEmail}</strong> as your new CubingClubs.net email address.</p>
    <a class="btn" href="${link}">Confirm New Email</a>
    <span class="link">${link}</span>
    <p class="small">Link expires in 24 hours. If you didn't request this, ignore this email.</p>
  `);
}

export function clubApprovedEmail(clubName, clubUrl) {
  return wrap(`
    <h1>Your club has been approved! 🎉</h1>
    <p>Great news — <strong>${clubName}</strong> has been approved and is now live on CubingClubs.net.</p>
    <a class="btn" href="${clubUrl}">View Your Club Page</a>
    <p class="small">Log in to your dashboard any time to update your listing or schedule meetings.</p>
  `);
}

export function clubDeniedEmail(clubName, reason) {
  return wrap(`
    <h1>Update on your club submission</h1>
    <p>Unfortunately, <strong>${clubName}</strong> was not approved at this time.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    <p>If you have questions or think this was a mistake, reply to this email or reach out at <a href="mailto:cubingclubs@gmail.com">cubingclubs@gmail.com</a>.</p>
    <p class="small">You can update your listing in the dashboard and resubmit.</p>
  `);
}

export async function sendEmail({ to, subject, html }, env) {
  if (!env.RESEND_API_KEY) {
    // Dev mode: log instead of sending
    console.log(`[email] No RESEND_API_KEY — skipping send to ${to}: ${subject}`);
    return;
  }
  const from = env.EMAIL_FROM || 'CubingClubs.net <noreply@globalcubing.com>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, reply_to: 'cubingclubs@gmail.com' }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Email failed: ${body}`);
    err.status = res.status;
    throw err;
  }
}
