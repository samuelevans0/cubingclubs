# CubingClubs.net — Website

## Project
Website for CubingClubs.net.

## Deployment
Hosted on **Cloudflare Pages** under the **personal Cloudflare account** (default wrangler login).

The `.env` file in this directory contains the `CLOUDFLARE_API_TOKEN` for the personal Cloudflare account.

```powershell
cd "F:\OneDrive\Schmamel's Stuff\CubingClubs.net\Website"
wrangler pages deploy public --project-name globalcubing
```

**Important:** Deploy using `public` (not `.`) so only the static assets folder is deployed.
Functions in `functions/` are bundled automatically.
