// Durable Object that runs the image processing
export class ImageTransformer {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/resize') {
      const imageUrl = url.searchParams.get('url');
      const width = Number(url.searchParams.get('w'));
      const height = Number(url.searchParams.get('h'));
      const format = url.searchParams.get('format') || 'jpeg';
      const quality = Number(url.searchParams.get('q')) || 80;

      if (!imageUrl || !width || !height) {
        return new Response(JSON.stringify({ error: 'Missing required parameters: url, w, h' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        // Check if we're in local development (Sharp won't work)
        if (typeof process !== 'undefined' && process.env && !process.env.CF_CONTAINER) {
          return new Response(JSON.stringify({
            message: "Sharp not available in local development",
            note: "Deploy to production for actual image processing",
            request: { url: imageUrl, width, height, format, quality }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Fetch the image
        const response = await fetch(imageUrl);
        if (!response.ok) {
          return new Response(JSON.stringify({ error: 'Failed to fetch image' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const imageBuffer = await response.arrayBuffer();
        
        // Import Sharp dynamically (available in deployed container)
        const sharp = (await import('sharp')).default;
        
        let transformer = sharp(imageBuffer)
          .resize(width, height, { fit: 'cover' });

        // Apply format and quality
        switch (format.toLowerCase()) {
          case 'webp':
            transformer = transformer.webp({ quality });
            break;
          case 'avif':
            transformer = transformer.avif({ quality });
            break;
          case 'png':
            transformer = transformer.png({ compressionLevel: Math.round((100 - quality) / 10) });
            break;
          default:
            transformer = transformer.jpeg({ quality, progressive: true });
            break;
        }

        const processedBuffer = await transformer.toBuffer();
        
        return new Response(processedBuffer, {
          headers: {
            'Content-Type': `image/${format}`,
            'Cache-Control': 'public, max-age=31536000'
          }
        });

      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Image processing failed', 
          details: error.message 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Image Transformer Service', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    // Get the Durable Object instance
    const id = env.IMAGE_TRANSFORMER.idFromName("image-transformer");
    const durableObject = env.IMAGE_TRANSFORMER.get(id);
    
    // Forward the request to the Durable Object container
    return durableObject.fetch(request);
  },
};