process.env.NODE_ENV = 'test';

const request = require('supertest');
const { app, server } = require('../src/index');

afterAll((done) => {
  server.close(done);
});

describe('Health & Metrics', () => {
  test('GET /health returns 200 and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /metrics returns Prometheus exposition format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });
});

describe('Validation', () => {
  test('POST /api/events without title returns 400', async () => {
    const res = await request(app)
      .post('/api/events')
      .send({ starts_at: '2026-09-01T10:00:00Z' });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/events/:id/rsvp without userId returns 400', async () => {
    const res = await request(app).post('/api/events/1/rsvp').send({});
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/checkins/:id without userId returns 400', async () => {
    const res = await request(app).post('/api/checkins/1').send({});
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/locations without name/capacity returns 400', async () => {
    const res = await request(app).post('/api/locations').send({});
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/rooms without name/building returns 400', async () => {
    const res = await request(app).post('/api/rooms').send({});
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/rooms with invalid room_type returns 400', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ name: 'Room 1', building: 'CS Building', room_type: 'auditorium' });
    expect(res.statusCode).toBe(400);
  });

  test('PATCH /api/rooms/:id with invalid status returns 400', async () => {
    const res = await request(app).patch('/api/rooms/1').send({ status: 'maybe' });
    expect(res.statusCode).toBe(400);
  });
});
