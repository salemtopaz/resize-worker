# Resize Worker

A Sharp-powered image resizing service deployed as a Cloudflare Container.

## Features

- Image resizing with Sharp (libvips)
- Multiple output formats (JPEG, WebP, AVIF, PNG)
- Quality control and compression
- Streaming processing for large images
- SQLite Durable Object for container lifecycle management

## Endpoints

- `GET /resize?url={image_url}&w={width}&h={height}&format={format}&q={quality}`
- `GET /health` - Health check
- `GET /container-stats` - Container statistics
- `GET /processing-logs` - Recent processing logs

## Local Development

```bash
# Install dependencies
npm install

# Build and run container locally
podman build -t sharp-service:latest -f Dockerfile .
podman run -d --name sharp-service -p 8080:8080 sharp-service:latest

# Test
curl -o test.jpg "http://localhost:8080/resize?url=https%3A%2F%2Fpicsum.photos%2F1200%2F800&w=300&h=200&format=jpeg&q=75"
```

## Deploy to Cloudflare

```bash
# Login to Cloudflare
wrangler login

# Deploy (requires Docker Engine)
wrangler deploy
```

## Architecture

- **Worker**: Routes requests to Durable Object
- **Durable Object**: Manages container lifecycle with SQLite
- **Container**: Runs Sharp service for image processing
