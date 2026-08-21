require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const pool = require('./db');
const redis = require('./redisClient');
const { register, metricsMiddleware, checkinsTotal } = require('./metrics');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

// ---------- Health & Metrics (used by Docker HEALTHCHECK, k8s probes, Prometheus) ----------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ---------- Locations / Occupancy ----------
app.get('/api/locations', async (req, res) => {
  try {
    const { rows: locations } = await pool.query(
      'SELECT id, name, capacity, category FROM locations ORDER BY id'
    );

    const enriched = await Promise.all(
      locations.map(async (loc) => {
        const raw = await redis.get(`occupancy:${loc.id}`);
        const occupancy = raw ? parseInt(raw, 10) : 0;
        const percent_full = loc.capacity
          ? Math.min(100, Math.round((occupancy / loc.capacity) * 100))
          : 0;
        return { ...loc, occupancy, percent_full };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load locations' });
  }
});

app.post('/api/checkins/:locationId', async (req, res) => {
  const { locationId } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    await pool.query(
      'INSERT INTO checkins (location_id, user_id) VALUES ($1, $2)',
      [locationId, userId]
    );
    const occupancy = await redis.incr(`occupancy:${locationId}`);
    checkinsTotal.inc();

    io.emit('occupancy-update', { locationId, occupancy });
    res.status(201).json({ locationId, occupancy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Check-in failed' });
  }
});

app.post('/api/checkins/:locationId/checkout', async (req, res) => {
  const { locationId } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const updateResult = await pool.query(
      `UPDATE checkins SET checked_out_at = now()
       WHERE id = (
         SELECT id FROM checkins
         WHERE location_id = $1 AND user_id = $2 AND checked_out_at IS NULL
         ORDER BY checked_in_at DESC LIMIT 1
       )`,
      [locationId, userId]
    );

    // Only touch the Redis counter if this user actually had an open
    // check-in here — otherwise a stray/duplicate checkout call from a
    // different tab or user would incorrectly drop the live count.
    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'No open check-in found for this user at this location' });
    }

    const current = parseInt((await redis.get(`occupancy:${locationId}`)) || '0', 10);
    const occupancy = current > 0 ? await redis.decr(`occupancy:${locationId}`) : 0;

    io.emit('occupancy-update', { locationId, occupancy });
    res.status(200).json({ locationId, occupancy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Check-out failed' });
  }
});

// ---------- Admin: check-in history & location management ----------
app.get('/api/checkins', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.user_id, c.checked_in_at, c.checked_out_at, l.name AS location_name
       FROM checkins c
       JOIN locations l ON l.id = c.location_id
       ORDER BY c.checked_in_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load check-in history' });
  }
});

app.post('/api/locations', async (req, res) => {
  const { name, capacity, category } = req.body;
  if (!name || !capacity) {
    return res.status(400).json({ error: 'name and capacity are required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO locations (name, capacity, category) VALUES ($1, $2, $3) RETURNING *',
      [name, capacity, category || 'general']
    );
    io.emit('occupancy-update', {});
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

app.delete('/api/locations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM checkins WHERE location_id = $1', [id]);
    await pool.query('DELETE FROM locations WHERE id = $1', [id]);
    await redis.del(`occupancy:${id}`);
    io.emit('occupancy-update', {});
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// ---------- Study rooms: empty classroom/lab finder ----------
// Status is set manually by admin (not check-in based) — this tracks
// scheduled/observed availability, not live headcount.
app.get('/api/rooms', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM study_rooms ORDER BY building, name'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load rooms' });
  }
});

app.post('/api/rooms', async (req, res) => {
  const { name, building, room_type } = req.body;
  if (!name || !building) {
    return res.status(400).json({ error: 'name and building are required' });
  }
  if (room_type && !['classroom', 'lab'].includes(room_type)) {
    return res.status(400).json({ error: "room_type must be 'classroom' or 'lab'" });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO study_rooms (name, building, room_type) VALUES ($1, $2, $3) RETURNING *`,
      [name, building, room_type || 'classroom']
    );
    io.emit('room-update', {});
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.patch('/api/rooms/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !['empty', 'occupied'].includes(status)) {
    return res.status(400).json({ error: "status must be 'empty' or 'occupied'" });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE study_rooms SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Room not found' });
    io.emit('room-update', {});
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

app.delete('/api/rooms/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM study_rooms WHERE id = $1', [id]);
    io.emit('room-update', {});
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ---------- Events ----------
app.get('/api/events', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM events WHERE starts_at >= now() - interval '1 day' ORDER BY starts_at ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

app.post('/api/events', async (req, res) => {
  const { title, location, starts_at, description } = req.body;
  if (!title || !starts_at) {
    return res.status(400).json({ error: 'title and starts_at are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO events (title, location, starts_at, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, location || null, starts_at, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.post('/api/events/:id/rsvp', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const insertResult = await pool.query(
      `INSERT INTO rsvps (event_id, user_id) VALUES ($1, $2)
       ON CONFLICT (event_id, user_id) DO NOTHING RETURNING *`,
      [id, userId]
    );

    if (insertResult.rowCount > 0) {
      await pool.query('UPDATE events SET rsvp_count = rsvp_count + 1 WHERE id = $1', [id]);
    }

    const { rows } = await pool.query('SELECT rsvp_count FROM events WHERE id = $1', [id]);
    io.emit('rsvp-update', { eventId: id, rsvp_count: rows[0]?.rsvp_count });
    res.status(200).json({ eventId: id, rsvp_count: rows[0]?.rsvp_count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'RSVP failed' });
  }
});

io.on('connection', (socket) => {
  console.log('client connected', socket.id);
  socket.on('disconnect', () => console.log('client disconnected', socket.id));
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => console.log(`Campus Pulse API listening on ${PORT}`));
} else {
  server.listen(0); // random free port for tests
}

module.exports = { app, server, io };
