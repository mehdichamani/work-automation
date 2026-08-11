const request = require('supertest');
const { createTestApp, generateToken } = require('./setup');

let app;

beforeAll(async () => {
  const result = createTestApp();
  app = result.app;
});

describe('Auth API', () => {
  test('POST /api/auth/login - success', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: '1000', password: 'Test1234' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.id).toBe(1000);
  });

  test('POST /api/auth/login - wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: '1000', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login - missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: '1000' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login - non-numeric username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Test1234' });
    expect(res.status).toBe(400);
  });
});

describe('Health Check', () => {
  test('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Protected Routes', () => {
  test('GET /api/admin/stats - no token', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  test('GET /api/admin/stats - invalid token', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });

  test('GET /api/admin/stats - valid token (admin)', async () => {
    const token = generateToken({ id: 1000, role: 'admin', full_name: 'مدیر سیستم', department_id: 1 });
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalUsers');
    expect(res.body).toHaveProperty('deptStats');
  });

  test('GET /api/admin/stats - valid token (user, should 403)', async () => {
    const token = generateToken({ id: 1001, role: 'user', full_name: 'کارمند', department_id: 1 });
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('SMS Auth', () => {
  test('POST /api/sms/send-code - invalid phone', async () => {
    const res = await request(app)
      .post('/api/sms/send-code')
      .send({ phone: '123' });
    expect(res.status).toBe(400);
  });

  test('POST /api/sms/send-code - success', async () => {
    const res = await request(app)
      .post('/api/sms/send-code')
      .send({ phone: '09141234567' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeDefined();
  });

  test('POST /api/sms/verify-code - missing fields', async () => {
    const res = await request(app)
      .post('/api/sms/verify-code')
      .send({ phone: '09141234567' });
    expect(res.status).toBe(400);
  });

  test('POST /api/sms/verify-code - wrong code', async () => {
    const res = await request(app)
      .post('/api/sms/verify-code')
      .send({ phone: '09141234567', code: '000000' });
    expect([400, 401]).toContain(res.status);
  });
});

describe('Admin API', () => {
  let adminToken;

  beforeAll(() => {
    adminToken = generateToken({ id: 1000, role: 'admin', full_name: 'مدیر سیستم', department_id: 1 });
  });

  test('GET /api/admin/dept-users/1', async () => {
    const res = await request(app)
      .get('/api/admin/dept-users/1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/admin/dept-users/2', async () => {
    const res = await request(app)
      .get('/api/admin/dept-users/2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
