// functions/sitemap.xml.js
// GET /sitemap.xml — dynamically lists all approved clubs for search engine indexing

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT slug FROM clubs WHERE approved = 1 AND visible = 1 ORDER BY name ASC`
  ).all();

  const base = 'https://cubingclubs.net';
  const today = new Date().toISOString().split('T')[0];

  const staticUrls = [
    { loc: `${base}/`, priority: '1.0', changefreq: 'daily' },
  ];

  const clubUrls = (results || []).map(c => ({
    loc: `${base}/${c.slug}`,
    priority: '0.8',
    changefreq: 'weekly',
  }));

  const allUrls = [...staticUrls, ...clubUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
    },
  });
}
