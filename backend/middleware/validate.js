const { body, param, query, validationResult } = require('express-validator');

function handleErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ error: first.msg, field: first.path });
  }
  next();
}

const leave = [
  body('start_date').notEmpty().withMessage('تاریخ شروع الزامی است')
    .matches(/^\d{4}\/\d{2}\/\d{2}$/).withMessage('فرمت تاریخ صحیح نیست (YYYY/MM/DD)'),
  body('end_date').notEmpty().withMessage('تاریخ پایان الزامی است')
    .matches(/^\d{4}\/\d{2}\/\d{2}$/).withMessage('فرمت تاریخ صحیح نیست'),
  body('leave_type').notEmpty().withMessage('نوع مرخصی الزامی است')
    .isIn(['روزانه', 'ساعتی', 'بدون حقوق']).withMessage('نوع مرخصی نامعتبر است'),
  body('reason').optional().isLength({ max: 500 }).withMessage('دلیل حداکثر ۵۰۰ کاراکتر'),
  handleErrors,
];

const overtime = [
  body('start_date').notEmpty().withMessage('تاریخ شروع الزامی است')
    .matches(/^\d{4}\/\d{2}\/\d{2}$/).withMessage('فرمت تاریخ صحیح نیست'),
  body('end_date').notEmpty().withMessage('تاریخ پایان الزامی است')
    .matches(/^\d{4}\/\d{2}\/\d{2}$/).withMessage('فرمت تاریخ صحیح نیست'),
  body('start_hour').notEmpty().withMessage('ساعت شروع الزامی است')
    .matches(/^\d{2}:\d{2}$/).withMessage('فرمت ساعت صحیح نیست (HH:MM)'),
  body('end_hour').notEmpty().withMessage('ساعت پایان الزامی است')
    .matches(/^\d{2}:\d{2}$/).withMessage('فرمت ساعت صحیح نیست'),
  body('hours_count').notEmpty().withMessage('تعداد ساعت الزامی است')
    .isFloat({ min: 0.5, max: 24 }).withMessage('ساعت باید بین ۰.۵ تا ۲۴ باشد'),
  body('reason').notEmpty().withMessage('دلیل اضافه‌کاری الزامی است')
    .isLength({ max: 500 }).withMessage('دلیل حداکثر ۵۰۰ کاراکتر'),
  handleErrors,
];

const purchase = [
  body('items').isArray({ min: 1 }).withMessage('حداقل یک کالا وارد کنید'),
  body('items.*.name').notEmpty().withMessage('نام کالا الزامی است'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('تعداد باید بیشتر از صفر باشد'),
  body('urgency').optional().isIn(['normal', 'urgent', 'very_urgent']).withMessage('اولویت نامعتبر'),
  body('description').optional().isLength({ max: 1000 }).withMessage('توضیحات حداکثر ۱۰۰۰ کاراکتر'),
  handleErrors,
];

const mission = [
  body('mission_date').notEmpty().withMessage('تاریخ ماموریت الزامی است')
    .matches(/^\d{4}\/\d{2}\/\d{2}$/).withMessage('فرمت تاریخ صحیح نیست'),
  body('destination').notEmpty().withMessage('مقصد الزامی است')
    .isLength({ max: 200 }).withMessage('مقصد حداکثر ۲۰۰ کاراکتر'),
  body('description').optional().isLength({ max: 1000 }).withMessage('توضیحات حداکثر ۱۰۰۰ کاراکتر'),
  body('start_time').optional().matches(/^\d{2}:\d{2}$/).withMessage('فرمت ساعت شروع صحیح نیست'),
  body('end_time').optional().matches(/^\d{2}:\d{2}$/).withMessage('فرمت ساعت پایان صحیح نیست'),
  handleErrors,
];

const workOrder = [
  body('title').notEmpty().withMessage('عنوان الزامی است')
    .isLength({ max: 200 }).withMessage('عنوان حداکثر ۲۰۰ کاراکتر'),
  body('description').optional().isLength({ max: 1000 }).withMessage('توضیحات حداکثر ۱۰۰۰ کاراکتر'),
  body('work_type').optional().isLength({ max: 100 }).withMessage('نوع کار حداکثر ۱۰۰ کاراکتر'),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('اولویت نامعتبر'),
  body('estimated_cost').optional().isFloat({ min: 0 }).withMessage('هزینه نامعتبر'),
  handleErrors,
];

const payment = [
  body('amount').notEmpty().withMessage('مبلغ الزامی است')
    .isFloat({ min: 1 }).withMessage('مبلغ باید بیشتر از صفر باشد'),
  body('payment_type').notEmpty().withMessage('نوع پرداخت الزامی است')
    .isLength({ max: 100 }).withMessage('نوع پرداخت حداکثر ۱۰۰ کاراکتر'),
  body('description').optional().isLength({ max: 1000 }).withMessage('توضیحات حداکثر ۱۰۰۰ کاراکتر'),
  body('recipient_name').optional().isLength({ max: 200 }).withMessage('نام دریافت‌کننده حداکثر ۲۰۰ کاراکتر'),
  body('bank_name').optional().isLength({ max: 100 }).withMessage('نام بانک حداکثر ۱۰۰ کاراکتر'),
  body('card_number').optional().matches(/^\d{16}$/).withMessage('شماره کارت باید ۱۶ رقمی باشد'),
  handleErrors,
];

const repair = [
  body('title').notEmpty().withMessage('عنوان الزامی است')
    .isLength({ max: 200 }).withMessage('عنوان حداکثر ۲۰۰ کاراکتر'),
  body('description').optional().isLength({ max: 1000 }).withMessage('توضیحات حداکثر ۱۰۰۰ کاراکتر'),
  body('equipment_name').optional().isLength({ max: 200 }).withMessage('نام تجهیزات حداکثر ۲۰۰ کاراکتر'),
  body('location').optional().isLength({ max: 200 }).withMessage('مکان حداکثر ۲۰۰ کاراکتر'),
  body('urgency').optional().isIn(['normal', 'urgent', 'very_urgent']).withMessage('اولویت نامعتبر'),
  handleErrors,
];

const itRequest = [
  body('title').notEmpty().withMessage('عنوان الزامی است')
    .isLength({ max: 200 }).withMessage('عنوان حداکثر ۲۰۰ کاراکتر'),
  body('request_type').notEmpty().withMessage('نوع درخواست الزامی است'),
  body('description').optional().isLength({ max: 1000 }).withMessage('توضیحات حداکثر ۱۰۰۰ کاراکتر'),
  body('device_info').optional().isLength({ max: 500 }).withMessage('اطلاعات دستگاه حداکثر ۵۰۰ کاراکتر'),
  body('urgency').optional().isIn(['normal', 'urgent', 'very_urgent']).withMessage('اولویت نامعتبر'),
  handleErrors,
];

const conference = [
  body('booking_date').notEmpty().withMessage('تاریخ رزرو الزامی است')
    .matches(/^\d{4}\/\d{2}\/\d{2}$/).withMessage('فرمت تاریخ صحیح نیست'),
  body('start_time').notEmpty().withMessage('ساعت شروع الزامی است')
    .matches(/^\d{2}:\d{2}$/).withMessage('فرمت ساعت صحیح نیست'),
  body('end_time').notEmpty().withMessage('ساعت پایان الزامی است')
    .matches(/^\d{2}:\d{2}$/).withMessage('فرمت ساعت صحیح نیست'),
  body('title').notEmpty().withMessage('عنوان الزامی است')
    .isLength({ max: 200 }).withMessage('عنوان حداکثر ۲۰۰ کاراکتر'),
  body('attendees_count').optional().isInt({ min: 1 }).withMessage('تعداد شرکت‌کنندگان نامعتبر'),
  handleErrors,
];

const security = [
  body('report_date').notEmpty().withMessage('تاریخ گزارش الزامی است')
    .matches(/^\d{4}\/\d{2}\/\d{2}$/).withMessage('فرمت تاریخ صحیح نیست'),
  body('report_type').notEmpty().withMessage('نوع گزارش الزامی است'),
  body('location').notEmpty().withMessage('مکان الزامی است'),
  body('description').notEmpty().withMessage('توضیحات الزامی است')
    .isLength({ max: 2000 }).withMessage('توضیحات حداکثر ۲۰۰۰ کاراکتر'),
  handleErrors,
];

const dailyOutput = [
  body('report_date').notEmpty().withMessage('تاریخ گزارش الزامی است')
    .matches(/^\d{4}\/\d{2}\/\d{2}$/).withMessage('فرمت تاریخ صحیح نیست'),
  body('product_name').notEmpty().withMessage('نام محصول الزامی است'),
  body('quantity').isFloat({ min: 0 }).withMessage('تعداد نامعتبر است'),
  body('unit').optional().isLength({ max: 50 }).withMessage('واحد حداکثر ۵۰ کاراکتر'),
  body('description').optional().isLength({ max: 1000 }).withMessage('توضیحات حداکثر ۱۰۰۰ کاراکتر'),
  handleErrors,
];

const projectSupply = [
  body('project_name').notEmpty().withMessage('نام پروژه الزامی است')
    .isLength({ max: 200 }).withMessage('نام پروژه حداکثر ۲۰۰ کاراکتر'),
  body('items').isArray({ min: 1 }).withMessage('حداقل یک کالا وارد کنید'),
  body('description').optional().isLength({ max: 1000 }).withMessage('توضیحات حداکثر ۱۰۰۰ کاراکتر'),
  body('estimated_cost').optional().isFloat({ min: 0 }).withMessage('هزینه تخمینی نامعتبر'),
  body('urgency').optional().isIn(['normal', 'urgent', 'very_urgent']).withMessage('اولویت نامعتبر'),
  handleErrors,
];

const inspection = [
  body('title').notEmpty().withMessage('عنوان الزامی است')
    .isLength({ max: 200 }).withMessage('عنوان حداکثر ۲۰۰ کاراکتر'),
  body('description').optional().isLength({ max: 1000 }).withMessage('توضیحات حداکثر ۱۰۰۰ کاراکتر'),
  body('equipment_name').optional().isLength({ max: 200 }).withMessage('نام تجهیزات حداکثر ۲۰۰ کاراکتر'),
  body('location').optional().isLength({ max: 200 }).withMessage('مکان حداکثر ۲۰۰ کاراکتر'),
  body('inspection_type').optional().isLength({ max: 100 }).withMessage('نوع بازرسی حداکثر ۱۰۰ کاراکتر'),
  handleErrors,
];

const auth = [
  body('username').notEmpty().withMessage('کد پرسنلی الزامی است')
    .isNumeric().withMessage('کد پرسنلی باید عددی باشد'),
  body('password').notEmpty().withMessage('رمز عبور الزامی است')
    .isLength({ min: 5 }).withMessage('رمز عبور حداقل ۵ کاراکتر'),
  handleErrors,
];

const changePassword = [
  body('oldPassword').notEmpty().withMessage('رمز فعلی الزامی است'),
  body('newPassword').notEmpty().withMessage('رمز جدید الزامی است')
    .isLength({ min: 5 }).withMessage('رمز جدید حداقل ۵ کاراکتر'),
  handleErrors,
];

const pagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('شماره صفحه نامعتبر'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('تعداد نتیجه نامعتبر'),
  handleErrors,
];

const announcements = [
  body('title').notEmpty().withMessage('عنوان الزامی است')
    .isLength({ max: 200 }).withMessage('عنوان حداکثر ۲۰۰ کاراکتر'),
  body('body').optional().isLength({ max: 5000 }).withMessage('متن حداکثر ۵۰۰۰ کاراکتر'),
  body('target_audience').optional().isIn(['all', 'manager', 'supervisor']).withMessage('مخاطب هدف نامعتبر'),
  body('priority').optional().isIn(['normal', 'important', 'urgent']).withMessage('اولویت نامعتبر'),
  body('is_active').optional().isBoolean().withMessage('وضعیت فعال‌بودن نامعتبر'),
  handleErrors,
];

const smsAuthSend = [
  body('phone').notEmpty().withMessage('شماره موبایل الزامی است')
    .matches(/^09\d{9}$/).withMessage('شماره موبایل معتبر نیست'),
  handleErrors,
];

const smsAuthVerify = [
  body('phone').notEmpty().withMessage('شماره موبایل الزامی است')
    .matches(/^09\d{9}$/).withMessage('شماره موبایل معتبر نیست'),
  body('code').notEmpty().withMessage('کد تایید الزامی است')
    .isLength({ min: 4, max: 8 }).withMessage('کد تایید نامعتبر است'),
  handleErrors,
];

const pushSubscribe = [
  body('subscription').notEmpty().withMessage('اطلاعات سابسکرایب الزامی است'),
  handleErrors,
];

const letters = [
  body('subject').notEmpty().withMessage('موضوع نامه الزامی است')
    .isLength({ max: 200 }).withMessage('موضوع حداکثر ۲۰۰ کاراکتر'),
  body('body').notEmpty().withMessage('متن نامه الزامی است'),
  body('priority').optional().isIn(['priority_1', 'priority_2', 'priority_3', 'normal', 'immediate', 'critical']).withMessage('اولویت نامعتبر است'),
  handleErrors,
];

const chatMessage = [
  body('message').notEmpty().withMessage('متن پیام الزامی است')
    .isLength({ max: 2000 }).withMessage('متن پیام حداکثر ۲۰۰۰ کاراکتر'),
  handleErrors,
];

function validateInput(config) {
  return (req, res, next) => {
    for (const [field, maxLength] of Object.entries(config)) {
      const value = req.body[field];
      if (typeof value === 'string' && value.length > maxLength) {
        return res.status(400).json({
          error: `فیلد «${field}» از حداکثر طول مجاز (${maxLength} کاراکتر) بیشتر است`
        });
      }
    }
    next();
  };
}

module.exports = {
  handleErrors, validateInput,
  leave, overtime, purchase, mission, workOrder, payment,
  repair, itRequest, conference, security, dailyOutput,
  projectSupply, inspection, auth, changePassword, pagination,
  announcements, smsAuthSend, smsAuthVerify, pushSubscribe, letters, chatMessage,
};
