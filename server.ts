import { Hono } from 'hono'
import sharp from 'sharp'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.get('/resize', async (c) => {
  const url = c.req.query('url')
  const width = Number(c.req.query('w'))
  const height = Number(c.req.query('h'))
  const format = c.req.query('format') || 'jpeg'
  const quality = Number(c.req.query('q')) || 80

  if (!url || !width || !height) {
    return c.json({ error: 'Missing required parameters: url, w, h' }, 400)
  }

  try {
    // Fetch the image
    const response = await fetch(url)
    if (!response.ok) {
      return c.json({ error: 'Failed to fetch image' }, 400)
    }

    const imageBuffer = await response.arrayBuffer()
    
    // Process with Sharp - Sharp can handle ArrayBuffer directly
    let transformer = sharp(imageBuffer)
      .resize(width, height, { fit: 'cover' })

    // Apply format and quality
    switch (format.toLowerCase()) {
      case 'webp':
        transformer = transformer.webp({ quality })
        break
      case 'avif':
        transformer = transformer.avif({ quality })
        break
      case 'png':
        transformer = transformer.png({ compressionLevel: Math.round((100 - quality) / 10) })
        break
      default:
        transformer = transformer.jpeg({ quality, progressive: true })
        break
    }

    const processedBuffer = await transformer.toBuffer()
    
    return new Response(processedBuffer, {
      headers: {
        'Content-Type': `image/${format}`,
        'Cache-Control': 'public, max-age=31536000'
      }
    })

  } catch (error) {
    console.error('Image processing error:', error)
    return c.json({ error: 'Image processing failed', details: error.message }, 500)
  }
})

export default {
  port: 8080,
  fetch: app.fetch
}
