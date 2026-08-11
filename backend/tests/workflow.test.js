const request = require('supertest');
const { createTestApp, generateToken } = require('./setup');
const prisma = require('../database/prisma');

let app, adminToken, userToken, supervisorToken;

beforeAll(async () => {
  const result = createTestApp();
  app = result.app;
  adminToken = generateToken({ id: 1000, role: 'admin', full_name: 'مدیر سیستم', department_id: 1 });
  userToken = generateToken({ id: 1001, role: 'user', full_name: 'کارمند', department_id: 2 });
  supervisorToken = generateToken({ id: 1002, role: 'supervisor', full_name: 'سرپرست', department_id: 2 });
});

describe('Workflow API and Template Protections', () => {
  let templateId;
  let activeInstanceId;

  test('POST /api/workflow/templates - admin creates template', async () => {
    const res = await request(app)
      .post('/api/workflow/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'گردش کار تست',
        module_name: 'purchase',
        steps: [
          { name: 'بررسی اول', role: 'supervisor', description: 'توضیح' },
          { name: 'تایید نهایی', role: 'admin', description: 'توضیح ادمین' }
        ]
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    templateId = res.body.id;
  });

  test('PUT /api/workflow/templates/:id - admin modifies template properties (name)', async () => {
    const res = await request(app)
      .put(`/api/workflow/templates/${templateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'نام جدید گردش کار تست'
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  test('POST /api/workflow/instances - starts active instance', async () => {
    const res = await request(app)
      .post('/api/workflow/instances')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        template_id: templateId,
        record_id: 999
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    activeInstanceId = res.body.id;
  });

  test('POST /api/workflow/instances - blocks duplicate active instance', async () => {
    const res = await request(app)
      .post('/api/workflow/instances')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        template_id: templateId,
        record_id: 999
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('یک جریان کار فعال برای این رکورد');
  });

  test('PUT /api/workflow/templates/:id - blocks modifying steps or module when active instance exists', async () => {
    const res = await request(app)
      .put(`/api/workflow/templates/${templateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        module_name: 'leave',
        steps: [{ name: 'مرحله ساده', role: 'admin' }]
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('امکان ویرایش مراحل یا ماژول قالب با جریان‌های کار فعال وجود ندارد');
  });

  test('DELETE /api/workflow/templates/:id - blocks deleting template when instances exist', async () => {
    const res = await request(app)
      .delete(`/api/workflow/templates/${templateId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('این قالب دارای تاریخچه جریان کار است');
  });

  test('POST /api/workflow/instances/:id/action - blocks unauthorized roles', async () => {
    const res = await request(app)
      .post(`/api/workflow/instances/${activeInstanceId}/action`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        action: 'approve',
        comment: 'تایید کارمند بدون نقش مربوطه'
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('شما اجازه عملیات در این مرحله را ندارید');
  });

  test('POST /api/workflow/instances/:id/action - processes first step approval by supervisor', async () => {
    const res = await request(app)
      .post(`/api/workflow/instances/${activeInstanceId}/action`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({
        action: 'approve',
        comment: 'تایید سرپرست بخش'
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  test('POST /api/workflow/instances/:id/action - blocks repeating action for already-passed step', async () => {
    // Current step has moved to index 1 (role: admin)
    // Supervisor tries to approve index 0 again or index 1 where role mismatch happens
    const res = await request(app)
      .post(`/api/workflow/instances/${activeInstanceId}/action`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({
        action: 'approve',
        comment: 'تایید مجدد سرپرست'
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('شما اجازه عملیات در این مرحله را ندارید');
  });

  test('POST /api/workflow/instances/:id/action - finalizes instance on final step approval', async () => {
    const res = await request(app)
      .post(`/api/workflow/instances/${activeInstanceId}/action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'approve',
        comment: 'تایید نهایی ادمین سیستم'
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  test('POST /api/workflow/instances/:id/action - blocks action on non-active completed workflow instance', async () => {
    const res = await request(app)
      .post(`/api/workflow/instances/${activeInstanceId}/action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'approve',
        comment: 'تلاش بیهوده پس از تکمیل'
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('این جریان کار غیرفعال است');
  });
});
