# GlobalCubing — Cloudflare Pages + D1 Backend

## Setup (10 minutes)

### 1. Install Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 2. Create the D1 database
```bash
wrangler d1 create globalcubing
```
Copy the `database_id` from the output and paste it into `wrangler.toml`.

### 3. Run the database schema
```bash
wrangler d1 execute globalcubing --file=schema.sql
```

### 4. Set your admin secret (used to create the first account)
In the Cloudflare dashboard → Pages → your project → Settings → Environment Variables:
```
ADMIN_SECRET = some-long-random-string-you-choose
```
Or via CLI:
```bash
wrangler secret put ADMIN_SECRET
```

### 5. Deploy
```bash
wrangler pages deploy public --project-name=globalcubing
```

---

## Creating user accounts

After deploying, create accounts via curl (use your real domain and admin secret):

```bash
# Create a regular club manager account
curl -X POST https://your-site.pages.dev/api/admin/create-user \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: your-admin-secret-here" \
  -d '{"email": "clubowner@example.com", "password": "securepassword123"}'

# Create an admin account
curl -X POST https://your-site.pages.dev/api/admin/create-user \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: your-admin-secret-here" \
  -d '{"email": "you@example.com", "password": "securepassword123", "is_admin": true}'
```

---

## Approving clubs

After a user logs in and fills out their club info, approve it so it appears on the map:

```bash
curl -X POST https://your-site.pages.dev/api/admin/approve \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"club_id": 1, "approved": true}'
```

Or log in as an admin and call it from the browser console.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/clubs` | None | All approved clubs (for the map) |
| POST | `/api/auth/login` | None | Log in |
| POST | `/api/auth/logout` | Session | Log out |
| GET | `/api/auth/me` | Session | Current user + club |
| POST | `/api/club/update` | Session | Create or update club |
| POST | `/api/admin/create-user` | Admin secret or admin session | Create a user account |
| POST | `/api/admin/approve` | Admin session | Approve/unapprove a club |

---

## File Structure
```
globalcubing/
├── public/
│   ├── index.html          # clubs map + directory
│   └── dashboard.html      # club manager login + edit form
├── functions/
│   ├── _lib/
│   │   └── auth.js         # shared auth helpers
│   └── api/
│       ├── clubs.js        # GET /api/clubs
│       ├── auth/
│       │   ├── login.js
│       │   ├── logout.js
│       │   └── me.js
│       ├── club/
│       │   └── update.js
│       └── admin/
│           ├── create-user.js
│           └── approve.js
├── schema.sql
└── wrangler.toml
```
