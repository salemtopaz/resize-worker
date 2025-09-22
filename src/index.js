// Simple Durable Object that runs the container
export class ImageTransformer {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    // This Durable Object IS the container - it will run the Hono server
    // Just forward the request to be handled by the container
    return new Response('Container processing', {
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