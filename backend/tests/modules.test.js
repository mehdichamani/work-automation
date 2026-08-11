const request = require('supertest');
const { createTestApp, generateToken } = require('./setup');

let app, adminToken, userToken;

beforeAll(async () => {
  const result = createTestApp();
  app = result.app;
  adminToken = generateToken({ id: 1000, role: 'admin', full_name: 'مدیر سیستم', department_id: 1 });
  userToken = generateToken({ id: 1001, role: 'user', full_name: 'کارمند', department_id: 2 });
});

describe('Purchase API', () => {
  test('GET /api/purchase - list', async () => {
    const res = await request(app)
      .get('/api/purchase')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('requests');
    expect(res.body).toHaveProperty('total');
  });

  test('POST /api/purchase - create', async () => {
    const res = await request(app)
      .post('/api/purchase')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        items: [{ name: 'کاغذ A4', quantity: 10, unit: 'بسته' }],
        urgency: 'normal'
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('request_number');
  });

  test('POST /api/purchase - empty items', async () => {
    const res = await request(app)
      .post('/api/purchase')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [] });
    expect(res.status).toBe(400);
  });
});

describe('Mission API', () => {
  test('GET /api/mission - list', async () => {
    const res = await request(app)
      .get('/api/mission')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('requests');
  });

  test('POST /api/mission - create', async () => {
    const res = await request(app)
      .post('/api/mission')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        mission_date: '1405/01/15',
        destination: 'تهران',
        description: 'جلسه با مدیریت'
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('request_number');
  });

  test('POST /api/mission - missing required', async () => {
    const res = await request(app)
      .post('/api/mission')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ description: 'test' });
    expect(res.status).toBe(400);
  });
});

describe('WorkOrder API', () => {
  test('GET /api/work-order - list', async () => {
    const res = await request(app)
      .get('/api/work-order')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('requests');
  });

  test('POST /api/work-order - create', async () => {
    const res = await request(app)
      .post('/api/work-order')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'تعمیر دستگاه',
        description: 'دستگاه چاپ خراب شده',
        work_type: 'تعمیرات'
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('request_number');
  });
});

describe('IT Request API', () => {
  test('GET /api/it - list', async () => {
    const res = await request(app)
      .get('/api/it')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('requests');
  });

  test('POST /api/it - create', async () => {
    const res = await request(app)
      .post('/api/it')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'خرابی کامپیوتر',
        request_type: 'سخت‌افزاری',
        description: 'کامپیوتر روشن نمیشه'
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('request_number');
  });
});

describe('Conference API', () => {
  test('GET /api/conference - list', async () => {
    const res = await request(app)
      .get('/api/conference')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('bookings');
  });

  test('POST /api/conference - create', async () => {
    const res = await request(app)
      .post('/api/conference')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        booking_date: '1405/01/15',
        start_time: '09:00',
        end_time: '10:00',
        title: 'جلسه برنامه‌ریزی',
        attendees_count: 5
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('request_number');
  });

  test('GET /api/conference/available - no date', async () => {
    const res = await request(app)
      .get('/api/conference/available')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

describe('Reports API', () => {
  test('GET /api/reports/monthly', async () => {
    const res = await request(app)
      .get('/api/reports/monthly')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('leave');
    expect(res.body).toHaveProperty('overtime');
    expect(res.body).toHaveProperty('purchase');
  });

  test('GET /api/reports/user-summary', async () => {
    const res = await request(app)
      .get('/api/reports/user-summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('leave');
    expect(res.body).toHaveProperty('overtime');
  });
});

describe('Announcements API', () => {
  test('GET /api/announcements/active', async () => {
    const res = await request(app)
      .get('/api/announcements/active')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Profile API', () => {
  test('GET /api/profile', async () => {
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('full_name');
    expect(res.body).toHaveProperty('role');
  });

  test('PUT /api/profile', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '09141234567', email: 'test@test.com' });
    expect(res.status).toBe(200);
  });
});
