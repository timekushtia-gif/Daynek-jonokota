import express from 'express';
import path from 'path';
import fs from 'fs';
import { desc, inArray } from 'drizzle-orm';
import authRoutes from './src/routes/auth.ts';
import postRoutes from './src/routes/posts.ts';
import creatorRoutes from './src/routes/creators.ts';
import adminRoutes from './src/routes/admin.ts';
import { ensureSeeded } from './src/db/seed.ts';
import { db } from './src/db/index.ts';
import { platformSettings, posts } from './src/db/schema.ts';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', true);
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Baseline security headers (avoid X-Frame-Options so AI Studio iframe preview works seamlessly)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Lazy, idempotent seed trigger on API calls (no startup probe loops)
app.use('/api', async (_req, _res, next) => {
  await ensureSeeded();
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'jonokotha-platform' });
});

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/admin', adminRoutes);

// Dynamic XML Sitemap & Google News Sitemap (SEO System)
app.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const published = await db
      .select({ slug: posts.slug, updatedAt: posts.updatedAt })
      .from(posts)
      .where(inArray(posts.status, ['published', 'approved']))
      .orderBy(desc(posts.publishedAt))
      .limit(500);

    const urls = [
      `<url><loc>${baseUrl}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
      `<url><loc>${baseUrl}/legal</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>`,
      ...published.map(
        (p) =>
          `<url><loc>${baseUrl}/news/${p.slug}</loc><lastmod>${new Date(p.updatedAt).toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`
      ),
    ].join('\n  ');

    res.header('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls}\n</urlset>`);
  } catch {
    res.status(500).send('Unable to generate sitemap');
  }
});

app.get('/news-sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const recent = await db
      .select({ title: posts.title, slug: posts.slug, publishedAt: posts.publishedAt })
      .from(posts)
      .where(inArray(posts.status, ['published', 'approved']))
      .orderBy(desc(posts.publishedAt))
      .limit(100);

    const items = recent
      .map(
        (p) => `<url>
    <loc>${baseUrl}/news/${p.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>Jonokotha (জনকথা)</news:name>
        <news:language>bn</news:language>
      </news:publication>
      <news:publication_date>${new Date(p.publishedAt).toISOString()}</news:publication_date>
      <news:title>${p.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</news:title>
    </news:news>
  </url>`
      )
      .join('\n  ');

    res.header('Content-Type', 'application/xml');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n  ${items}\n</urlset>`
    );
  } catch {
    res.status(500).send('Unable to generate news sitemap');
  }
});

app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\nSitemap: ${baseUrl}/news-sitemap.xml\n`);
});

app.get('/ads.txt', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(platformSettings)
      .where(inArray(platformSettings.key, ['adsense_ads_txt', 'adsense_publisher_id', 'adsense_enabled']));
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const customAdsTxt = typeof map.get('adsense_ads_txt') === 'string' ? String(map.get('adsense_ads_txt')).trim() : '';
    const pubId = typeof map.get('adsense_publisher_id') === 'string' ? String(map.get('adsense_publisher_id')).trim() : '';

    res.type('text/plain; charset=utf-8');
    if (customAdsTxt) {
      return res.send(customAdsTxt + '\n');
    }
    if (/^ca-pub-\d{10,20}$/.test(pubId)) {
      const barePub = pubId.replace(/^ca-/, '');
      return res.send(`google.com, ${barePub}, DIRECT, f08c47fec0942fa0\n`);
    }
    return res.send('# Google AdSense ads.txt not yet configured in Admin Panel.\n');
  } catch {
    res.type('text/plain');
    return res.status(500).send('# Unable to load ads.txt\n');
  }
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Jonokotha Social News server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
