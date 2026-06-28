const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, roleGuard } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', 'uploads', 'applications');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.jpeg', '.jpg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip', '.rar'];
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 
      'application/pdf', 
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 
      'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/octet-stream'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const isExtAllowed = allowedExts.includes(ext);
    const isMimeAllowed = allowedMimes.includes(file.mimetype.toLowerCase());
    
    if (isExtAllowed && isMimeAllowed) {
      cb(null, true);
    } else {
      cb(new Error('فرمت فایل پشتیبانی نمی‌شود'));
    }
  }
});

module.exports = function (db) {
  const router = express.Router();
  router.use(authMiddleware);

  function notify(userId, title, body, link) {
    db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)').run(userId, title, body, link);
  }

  router.post('/', upload.array('files', 10), (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && !hasJobPerm(req.user, 'job_application_fill')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const existing = db.prepare('SELECT id FROM job_applications WHERE user_id = ? AND is_active = 1').get(req.user.id);
      if (existing) {
        return res.status(403).json({ error: 'شما قبلاً پرسشنامه تکمیل کرده‌اید. امکان ویرایش یا ثبت مجدد وجود ندارد.', submitted: true });
      }

      const now = new Date();
      const jalaliYear = parseInt(new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(now).replace(/[^\d]/g, ''));
      const counter = db.prepare('SELECT * FROM job_application_counter WHERE year = ?').get(jalaliYear);
      let nextNumber = 1;
      if (counter) {
        nextNumber = counter.last_number + 1;
        db.prepare('UPDATE job_application_counter SET last_number = ? WHERE year = ?').run(nextNumber, jalaliYear);
      } else {
        db.prepare('INSERT INTO job_application_counter (year, last_number) VALUES (?, ?)').run(jalaliYear, 1);
      }
      const applicationNumber = `پ-${jalaliYear}-${String(nextNumber).padStart(3, '0')}`;

      const {
        full_name, father_name, national_id, national_id_issued_from,
        birth_date, birth_place, residence_duration, nationality, religion, language,
        education_level, education_place,
        military_status, military_done, military_service_type,
        military_exempt_non_medical, military_exempt_medical, military_exempt_reason,
        marital_status, children_count, spouse_job, requested_salary,
        housing_status, housing_rent_amount, residential_address, phone_number,
        moral_traits, relatives_in_company, relatives_details,
        criminal_record, kave_factories, smoking, smoking_duration,
        foreign_languages, turkish_known, computer_skills, training_courses,
        references_info, work_history, photo
      } = req.body;

      if (!full_name || !father_name || !national_id || !national_id_issued_from || !birth_date || !birth_place || !residence_duration || !nationality || !religion || !language || !education_level || !education_place) {
        return res.status(400).json({ error: 'تمام فیلدهای اطلاعات شخصی الزامی است' });
      }
      if (!military_service_type || !military_exempt_non_medical || !military_exempt_medical || !military_exempt_reason) {
        return res.status(400).json({ error: 'تمام فیلدهای نظام وظیفه الزامی است' });
      }
      if (!marital_status || !children_count || !spouse_job || !requested_salary) {
        return res.status(400).json({ error: 'تمام فیلدهای خانوادگی و مالی الزامی است' });
      }
      if (!housing_status || !housing_rent_amount || !phone_number || !residential_address) {
        return res.status(400).json({ error: 'تمام فیلدهای مسکن الزامی است' });
      }
      if (!moral_traits || !kave_factories) {
        return res.status(400).json({ error: 'تمام فیلدهای سایر اطلاعات الزامی است' });
      }
      if (!foreign_languages || !computer_skills || !training_courses || !references_info) {
        return res.status(400).json({ error: 'تمام فیلدهای باقیمانده الزامی است' });
      }

      const result = db.prepare(`
        INSERT INTO job_applications (
          user_id, application_number, full_name, father_name, national_id, national_id_issued_from,
          birth_date, birth_place, residence_duration, nationality, religion, language,
          education_level, education_place,
          military_status, military_done, military_service_type,
          military_exempt_non_medical, military_exempt_medical, military_exempt_reason,
          marital_status, children_count, spouse_job, requested_salary,
          housing_status, housing_rent_amount, residential_address, phone_number,
          moral_traits, relatives_in_company, relatives_details,
          criminal_record, kave_factories, smoking, smoking_duration,
          foreign_languages, turkish_known, computer_skills, training_courses,
          references_info, photo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id || null, applicationNumber, full_name, father_name || '', national_id || '', national_id_issued_from || '',
        birth_date || '', birth_place || '', residence_duration || '', nationality || 'ایرانی', religion || '', language || '',
        education_level || '', education_place || '',
        military_status || '', military_done || 'خیر', military_service_type || '',
        military_exempt_non_medical || '', military_exempt_medical || '', military_exempt_reason || '',
        marital_status || '', Number(children_count) || 0, spouse_job || '', requested_salary || '0',
        housing_status || '', housing_rent_amount || '0', residential_address || '', phone_number || '',
        moral_traits || '', relatives_in_company || 'خیر', relatives_details || '',
        criminal_record || 'خیر', kave_factories || '', smoking || 'خیر', smoking_duration || '',
        foreign_languages || '', turkish_known || 'خیر', computer_skills || '', training_courses || '',
        references_info || '', photo || null
      );

      const applicationId = result.lastInsertRowid;

      if (work_history) {
        const histories = typeof work_history === 'string' ? JSON.parse(work_history) : work_history;
        const insertHistory = db.prepare(`
          INSERT INTO job_application_work_history (application_id, org_name, position, duration, last_salary, leave_reason, contact_info, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        histories.forEach((h, i) => {
          insertHistory.run(applicationId, h.org_name || '', h.position || '', h.duration || '', h.last_salary || '', h.leave_reason || '', h.contact_info || '', i);
        });
      }

      if (req.files && req.files.length > 0) {
        const insertFile = db.prepare(`
          INSERT INTO job_application_attachments (application_id, file_name, file_path, file_type)
          VALUES (?, ?, ?, ?)
        `);
        for (const file of req.files) {
          insertFile.run(applicationId, file.originalname, '/uploads/applications/' + file.filename, file.mimetype);
        }
      }

      const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND is_active = 1").all();
      admins.forEach(a => {
        notify(a.id, 'پرسشنامه استخدامی جدید', `پرسشنامه ${full_name} ثبت شده`, '/admin');
      });

      res.json({ id: applicationId, application_number: applicationNumber, message: 'پرسشنامه با موفقیت ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  function hasJobPerm(user, moduleKey) {
    if (user.role === 'admin') return true;
    
    // 1. Check user-specific permissions first
    const userPerm = db.prepare('SELECT is_enabled FROM permissions WHERE user_id = ? AND module_key = ?').get(user.id, moduleKey);
    if (userPerm !== undefined) {
      return userPerm.is_enabled === 1;
    }
    
    // 2. Check department-level permissions if there's no user-specific record
    if (user.department_id) {
      const deptPerm = db.prepare('SELECT is_enabled FROM permissions WHERE department_id = ? AND user_id IS NULL AND module_key = ?').get(user.department_id, moduleKey);
      if (deptPerm !== undefined) {
        return deptPerm.is_enabled === 1;
      }
    }
    
    return false;
  }

  router.get('/', (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && !hasJobPerm(req.user, 'job_application_review')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const applications = db.prepare(`
        SELECT ja.*, u.full_name as reviewer_name
        FROM job_applications ja
        LEFT JOIN users u ON ja.reviewed_by = u.id
        WHERE ja.is_active = 1
        ORDER BY ja.created_at DESC
      `).all();
      res.json(applications);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my', (req, res) => {
    try {
      const applications = db.prepare(`
        SELECT * FROM job_applications
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC
      `).all(req.user.id);
      res.json(applications);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const application = db.prepare(`
        SELECT ja.*, u.full_name as reviewer_name
        FROM job_applications ja
        LEFT JOIN users u ON ja.reviewed_by = u.id
        WHERE ja.id = ?
      `).get(req.params.id);
      if (!application) return res.status(404).json({ error: 'پرسشنامه یافت نشد' });

      const workHistory = db.prepare('SELECT * FROM job_application_work_history WHERE application_id = ? ORDER BY sort_order').all(req.params.id);
      const attachments = db.prepare('SELECT * FROM job_application_attachments WHERE application_id = ?').all(req.params.id);

      res.json({ ...application, work_history: workHistory, attachments });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/review', (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && !hasJobPerm(req.user, 'job_application_review')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const { status, review_comment } = req.body;
      if (!status || !['reviewed', 'accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'وضعیت نامعتبر' });
      }

      db.prepare(`
        UPDATE job_applications SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_comment = ?
        WHERE id = ?
      `).run(status, req.user.id, review_comment || '', req.params.id);

      const app = db.prepare('SELECT * FROM job_applications WHERE id = ?').get(req.params.id);
      if (app && app.user_id) {
        const statusLabels = { reviewed: 'بررسی شده', accepted: 'پذیرفته شده', rejected: 'رد شده' };
        notify(app.user_id, 'وضعیت پرسشنامه', `پرسشنامه شما ${statusLabels[status]} شد`, '/job-application');
      }

      res.json({ message: 'وضعیت بروزرسانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', roleGuard('admin'), (req, res) => {
    try {
      db.prepare('UPDATE job_applications SET is_active = 0 WHERE id = ?').run(req.params.id);
      res.json({ message: 'پرسشنامه حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
