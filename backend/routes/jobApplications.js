const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, roleGuard } = require('../middleware/auth');
const prisma = require('../database/prisma');
const { mapRow, flattenJoins } = require('../utils/dbAdapter');

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

const pad = (n) => String(n).padStart(2, '0');
function getNowString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const APPLICATION_ALIASES = {
  reviewer_name: 'reviewer.fullName',
};

const APPLICATION_INCLUDE = {
  reviewer: { select: { fullName: true } },
};

module.exports = function () {
  const router = express.Router();
  router.use(authMiddleware);

  async function notify(userId, title, body, link) {
    await prisma.notification.create({ data: { userId: Number(userId), title, body, link } });
  }

  async function hasJobPerm(user, moduleKey) {
    if (user.role === 'admin') return true;

    const userPerm = await prisma.permission.findFirst({ where: { userId: user.id, moduleKey } });
    if (userPerm) {
      return userPerm.isEnabled === true;
    }

    if (user.department_id) {
      const deptPerm = await prisma.permission.findFirst({ where: { departmentId: user.department_id, userId: null, moduleKey } });
      if (deptPerm) {
        return deptPerm.isEnabled === true;
      }
    }

    return false;
  }

  router.post('/', upload.array('files', 10), async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && !(await hasJobPerm(req.user, 'job_application_fill'))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const existing = await prisma.jobApplication.findFirst({ where: { userId: Number(req.user.id), isActive: true }, select: { id: true } });
      if (existing) {
        return res.status(403).json({ error: 'شما قبلاً پرسشنامه تکمیل کرده‌اید. امکان ویرایش یا ثبت مجدد وجود ندارد.', submitted: true });
      }

      const now = new Date();
      const jalaliYear = parseInt(new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(now).replace(/[^\d]/g, ''));
      const counter = await prisma.jobApplicationCounter.findUnique({ where: { year: jalaliYear } });
      let nextNumber = 1;
      if (counter) {
        nextNumber = counter.lastNumber + 1;
        await prisma.jobApplicationCounter.update({ where: { id: counter.id }, data: { lastNumber: nextNumber } });
      } else {
        await prisma.jobApplicationCounter.create({ data: { year: jalaliYear, lastNumber: 1 } });
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

      const result = await prisma.jobApplication.create({
        data: {
          userId: Number(req.user.id) || null,
          applicationNumber,
          fullName: full_name,
          fatherName: father_name || '',
          nationalId: national_id || '',
          nationalIdIssuedFrom: national_id_issued_from || '',
          birthDate: birth_date || '',
          birthPlace: birth_place || '',
          residenceDuration: residence_duration || '',
          nationality: nationality || 'ایرانی',
          religion: religion || '',
          language: language || '',
          educationLevel: education_level || '',
          educationPlace: education_place || '',
          militaryStatus: military_status || '',
          militaryDone: military_done || 'خیر',
          militaryServiceType: military_service_type || '',
          militaryExemptNonMedical: military_exempt_non_medical || '',
          militaryExemptMedical: military_exempt_medical || '',
          militaryExemptReason: military_exempt_reason || '',
          maritalStatus: marital_status || '',
          childrenCount: Number(children_count) || 0,
          spouseJob: spouse_job || '',
          requestedSalary: requested_salary || '0',
          housingStatus: housing_status || '',
          housingRentAmount: housing_rent_amount || '0',
          residentialAddress: residential_address || '',
          phoneNumber: phone_number || '',
          moralTraits: moral_traits || '',
          relativesInCompany: relatives_in_company || 'خیر',
          relativesDetails: relatives_details || '',
          criminalRecord: criminal_record || 'خیر',
          kaveFactories: kave_factories || '',
          smoking: smoking || 'خیر',
          smokingDuration: smoking_duration || '',
          foreignLanguages: foreign_languages || '',
          turkishKnown: turkish_known || 'خیر',
          computerSkills: computer_skills || '',
          trainingCourses: training_courses || '',
          referencesInfo: references_info || '',
          photo: photo || null,
        },
      });

      const applicationId = result.id;

      if (work_history) {
        const histories = typeof work_history === 'string' ? JSON.parse(work_history) : work_history;
        await prisma.jobApplicationWorkHistory.createMany({
          data: histories.map((h, i) => ({
            applicationId,
            orgName: h.org_name || '',
            position: h.position || '',
            duration: h.duration || '',
            lastSalary: h.last_salary || '',
            leaveReason: h.leave_reason || '',
            contactInfo: h.contact_info || '',
            sortOrder: i,
          })),
        });
      }

      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          await prisma.jobApplicationAttachment.create({
            data: {
              applicationId,
              fileName: file.originalname,
              filePath: '/uploads/applications/' + file.filename,
              fileType: file.mimetype,
            },
          });
        }
      }

      const admins = await prisma.user.findMany({ where: { role: 'admin', isActive: true }, select: { id: true } });
      for (const a of admins) {
        await notify(a.id, 'پرسشنامه استخدامی جدید', `پرسشنامه ${full_name} ثبت شده`, '/admin');
      }

      res.json({ id: applicationId, application_number: applicationNumber, message: 'پرسشنامه با موفقیت ثبت شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/', async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && !(await hasJobPerm(req.user, 'job_application_review'))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const applications = await prisma.jobApplication.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        include: APPLICATION_INCLUDE,
      });
      res.json(mapRow(applications.map(r => flattenJoins(r, APPLICATION_ALIASES))));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my', async (req, res) => {
    try {
      const applications = await prisma.jobApplication.findMany({
        where: { userId: Number(req.user.id), isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json(mapRow(applications));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const application = await prisma.jobApplication.findUnique({
        where: { id: Number(req.params.id) },
        include: APPLICATION_INCLUDE,
      });
      if (!application) return res.status(404).json({ error: 'پرسشنامه یافت نشد' });

      const workHistory = await prisma.jobApplicationWorkHistory.findMany({
        where: { applicationId: Number(req.params.id) },
        orderBy: { sortOrder: 'asc' },
      });
      const attachments = await prisma.jobApplicationAttachment.findMany({
        where: { applicationId: Number(req.params.id) },
      });

      res.json({ ...mapRow(flattenJoins(application, APPLICATION_ALIASES)), work_history: mapRow(workHistory), attachments: mapRow(attachments) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id/review', async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && !(await hasJobPerm(req.user, 'job_application_review'))) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    try {
      const { status, review_comment } = req.body;
      if (!status || !['reviewed', 'accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'وضعیت نامعتبر' });
      }

      await prisma.jobApplication.update({
        where: { id: Number(req.params.id) },
        data: { status, reviewedBy: Number(req.user.id), reviewedAt: getNowString(), reviewComment: review_comment || '' },
      });

      const app = await prisma.jobApplication.findUnique({ where: { id: Number(req.params.id) } });
      if (app && app.userId) {
        const statusLabels = { reviewed: 'بررسی شده', accepted: 'پذیرفته شده', rejected: 'رد شده' };
        await notify(app.userId, 'وضعیت پرسشنامه', `پرسشنامه شما ${statusLabels[status]} شد`, '/job-application');
      }

      res.json({ message: 'وضعیت بروزرسانی شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', roleGuard('admin'), async (req, res) => {
    try {
      await prisma.jobApplication.update({
        where: { id: Number(req.params.id) },
        data: { isActive: false },
      });
      res.json({ message: 'پرسشنامه حذف شد' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
