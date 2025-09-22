export default {
  async fetch(request, env, ctx) {
    // Forward all requests to the container service
    if (env.IMAGE_TRANSFORMER) {
      return env.IMAGE_TRANSFORMER.fetch(request);
    }
    
    // Fallback for local development without container
    const url = new URL(request.url);
    if (url.pathname === '/resize') {
      return new Response(JSON.stringify({
        message: "Container not available in local development",
        note: "Deploy to test actual image processing",
        params: Object.fromEntries(url.searchParams)
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Image Transformer Service', {
      headers: { 'Content-Type': 'text/plain' }
    });
  },
};