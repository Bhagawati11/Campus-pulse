const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

client.on('error', (err) => console.error('Redis Client Error', err));

// Fire-and-forget connect. In test env there may be no Redis running, so we
// swallow the error instead of crashing the process — routes that need
// Redis will just fail gracefully at request time.
client.connect().catch((err) => {
  console.warn('Redis not connected yet:', err.message);
});

module.exports = client;
