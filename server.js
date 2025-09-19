import Fastify from 'fastify';
import sharp from 'sharp';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true }));

app.get('/resize', async (req, reply) => {
  try {
    const imageUrl = req.query.url;
    const width = Number(req.query.w);
    const height = Number(req.query.h);
    const format = req.query.format || 'auto'; // auto, jpeg, webp, avif, png
    const quality = Number(req.query.q) || 80; // 1-100

    if (!imageUrl) return reply.code(400).send({ error: 'url required' });
    if (!width || !height) return reply.code(400).send({ error: 'w and h required' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(imageUrl, { redirect: 'follow', signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok || !resp.body) return reply.code(400).send({ error: 'fetch failed', status: resp.status });

    // Validate upstream looks like an image
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('image/') && !ct.startsWith('application/octet-stream')) {
      return reply.code(400).send({ error: 'upstream is not an image', contentType: ct });
    }

    // Read the entire response into a buffer first
    const imageBuffer = Buffer.from(await resp.arrayBuffer());
    
    let transformer = sharp(imageBuffer).resize({ width, height, fit: 'cover' });

    switch (format) {
      case 'jpeg':
        transformer = transformer.jpeg({ quality, progressive: true, mozjpeg: true });
        reply.header('content-type', 'image/jpeg');
        break;
      case 'webp':
        transformer = transformer.webp({ quality });
        reply.header('content-type', 'image/webp');
        break;
      case 'avif':
        transformer = transformer.avif({ quality });
        reply.header('content-type', 'image/avif');
        break;
      case 'png':
        transformer = transformer.png({ compressionLevel: Math.round(quality / 10) });
        reply.header('content-type', 'image/png');
        break;
      default: // auto
        transformer = transformer.jpeg({ quality, progressive: true, mozjpeg: true });
        reply.header('content-type', 'image/jpeg');
        break;
    }

    const processedBuffer = await transformer.toBuffer();
    reply.send(processedBuffer);
  } catch (e) {
    reply.code(500).send({ error: 'processing failed', details: e.message });
  }
});

const port = Number(process.env.PORT) || 8080;
app.listen({ host: '0.0.0.0', port }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});


