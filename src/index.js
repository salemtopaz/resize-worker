// Container Durable Object for Sharp Service
export class SharpService {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Initialize SQLite for container state tracking
    this.sql = this.state.storage.sql;
    this.initializeDatabase();
  }

  async initializeDatabase() {
    // Create tables for container lifecycle tracking
    await this.sql.exec(`
      CREATE TABLE IF NOT EXISTS container_lifecycle (
        id INTEGER PRIMARY KEY,
        status TEXT NOT NULL,
        started_at DATETIME,
        last_activity DATETIME,
        total_requests INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS image_processing_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        image_url TEXT,
        dimensions TEXT,
        format TEXT,
        processing_time_ms INTEGER
      );
      
      -- Insert initial state
      INSERT OR IGNORE INTO container_lifecycle (id, status, started_at, total_requests) 
      VALUES (1, 'initialized', CURRENT_TIMESTAMP, 0);
    `);
  }


  async fetch(request) {
    const url = new URL(request.url);
    
    // Update activity tracking
    await this.sql.exec(`
      UPDATE container_lifecycle 
      SET last_activity = CURRENT_TIMESTAMP, total_requests = total_requests + 1 
      WHERE id = 1
    `);

    // Handle container stats endpoint
    if (url.pathname === '/container-stats') {
      const result = await this.sql.exec(`
        SELECT * FROM container_lifecycle WHERE id = 1
      `);
      return new Response(JSON.stringify(result.results[0] || {}, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle processing logs endpoint
    if (url.pathname === '/processing-logs') {
      const result = await this.sql.exec(`
        SELECT * FROM image_processing_logs ORDER BY timestamp DESC LIMIT 10
      `);
      return new Response(JSON.stringify(result.results || [], null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log image processing requests
    if (url.pathname === '/resize') {
      const imageUrl = url.searchParams.get('url');
      const width = url.searchParams.get('w');
      const height = url.searchParams.get('h');
      const format = url.searchParams.get('format') || 'jpeg';
      
      if (imageUrl && width && height) {
        await this.sql.exec(`
          INSERT INTO image_processing_logs (image_url, dimensions, format) 
          VALUES (?, ?, ?)
        `, imageUrl, `${width}x${height}`, format);
      }
    }

    // Handle image resizing by forwarding to container via service binding
    if (url.pathname === '/resize') {
      const imageUrl = url.searchParams.get('url');
      const width = url.searchParams.get('w');
      const height = url.searchParams.get('h');
      const format = url.searchParams.get('format') || 'jpeg';
      const quality = url.searchParams.get('q') || '80';

      if (!imageUrl || !width || !height) {
        return new Response('Missing required parameters: url, w, h', { status: 400 });
      }

      // Log the request for debugging
      await this.sql.exec(`
        INSERT INTO image_processing_logs (image_url, dimensions, format) 
        VALUES (?, ?, ?)
      `, imageUrl, `${width}x${height}`, format);

      try {
        // Forward request to containerized Sharp service via service binding
        const containerResponse = await this.env.SHARP_CONTAINER.fetch(request);
        return containerResponse;
      } catch (error) {
        return new Response(JSON.stringify({
          error: "Container service unavailable",
          details: error.message,
          fallback: "Service binding failed"
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // For non-resize requests, return container status
    return new Response(JSON.stringify({
      message: "Container is ready",
      path: url.pathname,
      params: Object.fromEntries(url.searchParams),
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Main Worker that routes to the Container Durable Object
export default {
  async fetch(request, env, ctx) {
    // Get the Container Durable Object instance
    const id = env.SHARP_SERVICE.idFromName("sharp-service-container");
    const containerObject = env.SHARP_SERVICE.get(id);
    
    // Forward the request to the Container Durable Object
    return containerObject.fetch(request);
  },
};