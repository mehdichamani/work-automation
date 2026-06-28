import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { printJobApplication } from '../utils/printUtils';
import CameraCapture from '../components/CameraCapture';

const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition";
const inputDisabledClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 outline-none";
const labelClass = "block text-xs font-bold text-gray-600 mb-1";
const sectionTitle = "text-lg font-bold text-primary-700 border-b-2 border-primary-200 pb-2 mb-4 mt-8";

const emptyForm = {
  full_name: '', father_name: '', national_id: '', national_id_issued_from: '',
  birth_date: '', birth_place: '', residence_duration: '', nationality: 'ایرانی', religion: '', language: '',
  education_level: '', education_place: '',
  military_status: '', military_done: 'خیر', military_service_type: '',
  military_exempt_non_medical: '', military_exempt_medical: '', military_exempt_reason: '',
  marital_status: '', children_count: '0', spouse_job: '', requested_salary: '',
  housing_status: '', housing_rent_amount: '0', residential_address: '', phone_number: '',
  moral_traits: '', relatives_in_company: 'خیر', relatives_details: '',
  criminal_record: 'خیر', kave_factories: '', smoking: 'خیر', smoking_duration: '',
  foreign_languages: '', turkish_known: 'خیر', computer_skills: '', training_courses: '',
  references_info: ''
};

function Field({ form, handleChange, readOnly, label, name, type = 'text', required = false, options = null, cols = 1, placeholder = '' }) {
  const colSpan = cols === 2 ? 'md:col-span-2' : cols === 3 ? 'md:col-span-3' : '';
  const cls = readOnly ? inputDisabledClass : inputClass;
  return (
    <div className={colSpan}>
      <label className={labelClass}>{label}{required && <span className="text-red-500"> *</span>}</label>
      {options ? (
        <select name={name} value={form[name] || ''} onChange={handleChange} required={required} className={cls} disabled={readOnly}>
          <option value="">انتخاب کنید</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} name={name} value={form[name] || ''} onChange={handleChange} required={required} className={cls} placeholder={readOnly ? '' : placeholder} disabled={readOnly} readOnly={readOnly} />
      )}
    </div>
  );
}

function RadioGroup({ form, handleChange, readOnly, label, name, options }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-4 mt-1">
        {options.map(o => (
          <label key={o} className="flex items-center gap-1 text-sm cursor-pointer">
            <input type="radio" name={name} value={o} checked={form[name] === o} onChange={handleChange} className="text-primary-600" disabled={readOnly} />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function JobApplication() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [workHistory, setWorkHistory] = useState([
    { org_name: '', position: '', duration: '', last_salary: '', leave_reason: '', contact_info: '' }
  ]);
  const [photo, setPhoto] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await api.get('/job-applications/my');
        if (res.data && res.data.length > 0) {
          const app = res.data[0];
          setSubmittedData(app);
          setReadOnly(true);
          setForm({
            full_name: app.full_name || '', father_name: app.father_name || '', national_id: app.national_id || '', national_id_issued_from: app.national_id_issued_from || '',
            birth_date: app.birth_date || '', birth_place: app.birth_place || '', residence_duration: app.residence_duration || '', nationality: app.nationality || 'ایرانی', religion: app.religion || '', language: app.language || '',
            education_level: app.education_level || '', education_place: app.education_place || '',
            military_status: app.military_status || '', military_done: app.military_done || 'خیر', military_service_type: app.military_service_type || '',
            military_exempt_non_medical: app.military_exempt_non_medical || '', military_exempt_medical: app.military_exempt_medical || '', military_exempt_reason: app.military_exempt_reason || '',
            marital_status: app.marital_status || '', children_count: app.children_count || '0', spouse_job: app.spouse_job || '', requested_salary: app.requested_salary || '',
            housing_status: app.housing_status || '', housing_rent_amount: app.housing_rent_amount || '0', residential_address: app.residential_address || '', phone_number: app.phone_number || '',
            moral_traits: app.moral_traits || '', relatives_in_company: app.relatives_in_company || 'خیر', relatives_details: app.relatives_details || '',
            criminal_record: app.criminal_record || 'خیر', kave_factories: app.kave_factories || '', smoking: app.smoking || 'خیر', smoking_duration: app.smoking_duration || '',
            foreign_languages: app.foreign_languages || '', turkish_known: app.turkish_known || 'خیر', computer_skills: app.computer_skills || '', training_courses: app.training_courses || '',
            references_info: app.references_info || ''
          });
          if (app.photo) setPhoto(app.photo);
          const whRes = await api.get(`/job-applications/${app.id}`);
          if (whRes.data?.work_history?.length) setWorkHistory(whRes.data.work_history);
        }
      } catch (err) {}
    };
    checkExisting();
  }, []);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleWorkChange = (index, e) => {
    setWorkHistory(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [e.target.name]: e.target.value };
      return updated;
    });
  };

  const addWorkRow = () => {
    setWorkHistory(prev => [...prev, { org_name: '', position: '', duration: '', last_salary: '', leave_reason: '', contact_info: '' }]);
  };

  const removeWorkRow = (index) => {
    setWorkHistory(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = [];

    if (!form.full_name) errs.push('نام و نام خانوادگی');
    if (!form.father_name) errs.push('نام پدر');
    if (!form.national_id) errs.push('شماره شناسنامه');
    if (!form.national_id_issued_from) errs.push('صادره از');
    if (!form.birth_date) errs.push('تاریخ تولد');
    if (!form.birth_place) errs.push('محل تولد');
    if (!form.residence_duration) errs.push('مدت اقامت در این شهرستان');
    if (!form.nationality) errs.push('ملیت');
    if (!form.religion) errs.push('مذهب');
    if (!form.language) errs.push('زبان');
    if (!form.education_level) errs.push('آخرین مدرک تحصیلی');
    if (!form.education_place) errs.push('محل تحصیل');
    if (!form.military_service_type) errs.push('رسته خدمت');
    if (!form.military_exempt_non_medical) errs.push('معافیت غیر پزشکی');
    if (!form.military_exempt_medical) errs.push('معافیت پزشکی');
    if (!form.military_exempt_reason) errs.push('علت معافیت');
    if (!form.marital_status) errs.push('وضعیت تأهل');
    if (!form.children_count) errs.push('تعداد فرزندان');
    if (!form.spouse_job) errs.push('شغل همسر');
    if (!form.requested_salary) errs.push('میزان حقوق درخواستی');
    if (!form.housing_status) errs.push('وضعیت مسکن');
    if (!form.housing_rent_amount) errs.push('میزان اجاره پرداختی');
    if (!form.phone_number) errs.push('شماره تلفن تماس');
    if (!form.residential_address) errs.push('نشانی محل سکونت');
    if (!form.moral_traits) errs.push('ویژگی‌های اخلاقی (۳ مورد)');
    if (!form.kave_factories) errs.push('سابقه اشتغال در کارخانجات کاوه');

    workHistory.forEach((w, i) => {
      if (!w.org_name) errs.push(`شغل ${i + 1}: نام سازمان`);
      if (!w.position) errs.push(`شغل ${i + 1}: آخرین سمت`);
      if (!w.duration) errs.push(`شغل ${i + 1}: مدت شغل`);
      if (!w.last_salary) errs.push(`شغل ${i + 1}: آخرین حقوق`);
      if (!w.leave_reason) errs.push(`شغل ${i + 1}: علت ترک سازمان`);
      if (!w.contact_info) errs.push(`شغل ${i + 1}: نشانی و تلفن`);
    });

    if (!form.foreign_languages) errs.push('زبان‌های خارجی');
    if (!form.computer_skills) errs.push('نرم‌افزارهای کامپیوتری');
    if (!form.training_courses) errs.push('دوره‌های آموزشی');
    if (!form.references_info) errs.push('معرف‌ها');

    if (errs.length > 0) {
      setValidationErrors(errs);
      toast.error(`${errs.length} فیلد الزامی ناقص است`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setValidationErrors([]);
    setLoading(true);
    try {
      const formData = new FormData();
      Object.keys(form).forEach(key => formData.append(key, form[key]));
      formData.append('work_history', JSON.stringify(workHistory));
      if (photo) formData.append('photo', photo);
      for (const file of files) formData.append('files', file);
      const res = await api.post('/job-applications', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSubmittedData({
        ...form,
        application_number: res.data.application_number,
        work_history: workHistory,
        photo,
        status: 'new'
      });
      setReadOnly(true);
      toast.success('پرسشنامه با موفقیت ثبت شد');
      setValidationErrors([]);
    } catch (err) {
      if (err.response?.data?.submitted) {
        setReadOnly(true);
        toast.error(err.response.data.error);
      } else {
        toast.error(err.response?.data?.error || 'خطا در ثبت پرسشنامه');
      }
    } finally {
      setLoading(false);
    }
  };

  const fieldProps = { form, handleChange, readOnly };

  return (
    <div className="max-w-4xl mx-auto p-4 animate-fade-in" dir="rtl">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 rounded-2xl p-6 text-white mb-6">
        <h1 className="text-2xl font-bold">پرسشنامه استخدامی</h1>
        <p className="text-primary-200 mt-1 text-sm">لطفاً تمامی فیلدها را با دقت تکمیل نمایید</p>
      </div>

      {readOnly && submittedData && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔒</span>
            <div>
              <h3 className="font-bold text-amber-800">پرسشنامه قبلاً تکمیل و ثبت شده</h3>
              {submittedData.application_number && (
                <p className="text-sm text-amber-700 mt-1">شماره پرسشنامه: <span className="font-bold">{submittedData.application_number}</span></p>
              )}
              <p className="text-sm text-amber-600 mt-1">تاریخ ثبت: <span className="font-bold">{submittedData.created_at ? new Date(submittedData.created_at).toLocaleDateString('fa-IR') : '-'}</span></p>
              <p className="text-sm text-amber-600 mt-1">پرسشنامه شما ثبت شده و امکان ویرایش یا ثبت مجدد وجود ندارد.</p>
              {submittedData.status && (
                <p className="text-sm text-amber-600 mt-1">وضعیت بررسی: <span className="font-bold">{submittedData.status === 'new' ? 'جدید' : submittedData.status === 'reviewed' ? 'بررسی شده' : submittedData.status === 'accepted' ? 'پذیرفته شده' : 'رد شده'}</span></p>
              )}
            </div>
            <button type="button" onClick={() => printJobApplication(submittedData)} className="mr-auto bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition">🖨️ چاپ</button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-red-500 text-xl">⚠️</span>
              <h4 className="font-bold text-red-700">{validationErrors.length} فیلد الزامی ناقص است:</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {validationErrors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-red-100">
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="text-sm text-red-700">{err}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <h3 className={sectionTitle}>عکس پروفایل</h3>
        <div className="flex flex-col items-center gap-4">
          <CameraCapture onCapture={setPhoto} currentPhoto={photo} />
        </div>

        <h3 className={sectionTitle}>اطلاعات شخصی</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field {...fieldProps} label="نام و نام خانوادگی" name="full_name" required placeholder="مثال: علی رضایی" />
          <Field {...fieldProps} label="نام پدر" name="father_name" required placeholder="مثال: محمد رضایی" />
          <Field {...fieldProps} label="شماره شناسنامه" name="national_id" required placeholder="مثال: 12345678901" />
          <Field {...fieldProps} label="صادره از" name="national_id_issued_from" required placeholder="مثال: ارومیه" />
          <Field {...fieldProps} label="تاریخ تولد" name="birth_date" required placeholder="مثال: 1370/05/15" />
          <Field {...fieldProps} label="محل تولد" name="birth_place" required placeholder="مثال: ارومیه" />
          <Field {...fieldProps} label="مدت اقامت در این شهرستان" name="residence_duration" required placeholder="مثال: ۱۰ سال" />
          <Field {...fieldProps} label="ملیت" name="nationality" required placeholder="مثال: ایرانی" />
          <Field {...fieldProps} label="مذهب" name="religion" required placeholder="مثال: شیعه" />
          <Field {...fieldProps} label="زبان" name="language" required placeholder="مثال: فارسی، ترکی" />
          <Field {...fieldProps} label="آخرین مدرک تحصیلی" name="education_level" required options={['زیر دیپلم', 'دیپلم', 'فوق دیپلم', 'لیسانس', 'فوق لیسانس', 'دکترا']} />
          <Field {...fieldProps} label="محل تحصیل" name="education_place" required placeholder="مثال: دانشگاه ارومیه" />
        </div>

        <h3 className={sectionTitle}>وضعیت نظام وظیفه</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RadioGroup {...fieldProps} label="انجام داده‌اید؟" name="military_done" options={['بله', 'خیر']} />
          <Field {...fieldProps} label="رسته خدمت" name="military_service_type" required placeholder="مثال: ترابری" />
          <Field {...fieldProps} label="معافیت غیر پزشکی" name="military_exempt_non_medical" required placeholder="مثال: کفالت" />
          <Field {...fieldProps} label="معافیت پزشکی" name="military_exempt_medical" required placeholder="مثال: بینایی" />
          <Field {...fieldProps} label="علت معافیت" name="military_exempt_reason" required placeholder="مثال: مشکل بینایی چشم" />
        </div>

        <h3 className={sectionTitle}>وضعیت خانوادگی و مالی</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field {...fieldProps} label="وضعیت تأهل" name="marital_status" required options={['مجرد', 'متاهل']} />
          <Field {...fieldProps} label="تعداد فرزندان" name="children_count" type="number" required placeholder="مثال: ۲" />
          <Field {...fieldProps} label="شغل همسر" name="spouse_job" required placeholder="مثال: معلم" />
          <Field {...fieldProps} label="میزان حقوق درخواستی (ریال)" name="requested_salary" type="number" required placeholder="مثال: 80000000" />
        </div>

        <h3 className={sectionTitle}>وضعیت مسکن</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field {...fieldProps} label="وضعیت مسکن" name="housing_status" required options={['اجاره‌ای', 'ملک شخصی', 'منزل پدری']} />
          <Field {...fieldProps} label="میزان اجاره پرداختی (ریال)" name="housing_rent_amount" type="number" required placeholder="مثال: 5000000" />
          <Field {...fieldProps} label="شماره تلفن تماس" name="phone_number" required placeholder="مثال: 09141234567" />
          <Field {...fieldProps} label="نشانی محل سکونت" name="residential_address" required cols={2} placeholder="مثال: ارومیه، خیابان آزادی، کوچه ۵، پلاک ۱۲" />
        </div>

        <h3 className={sectionTitle}>سایر اطلاعات</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>از ویژگی‌های اخلاقی خود ۳ مورد بیان نمایید <span className="text-red-500">*</span></label>
            <textarea name="moral_traits" value={form.moral_traits} onChange={handleChange} rows={3} required className={readOnly ? inputDisabledClass : inputClass} placeholder={readOnly ? '' : 'مثال:\n۱. متعهد و مسئولیت‌پذیر\n۲. توانایی کار تیمی\n۳. خلاقیت و ابتکار'} disabled={readOnly} readOnly={readOnly} />
          </div>
          <RadioGroup {...fieldProps} label="آیا از اقوام و نزدیکان شما فرد یا افرادی در گروه صنعتی شیشه کاوه به کار اشتغال دارند" name="relatives_in_company" options={['بله', 'خیر']} />
          {form.relatives_in_company === 'بله' && (
            <Field {...fieldProps} label="نام و نوع نسبت" name="relatives_details" required placeholder="مثال: علی رضایی - پسر عمو" />
          )}
          <RadioGroup {...fieldProps} label="محکومیت کیفری/حقوقی" name="criminal_record" options={['بله', 'خیر']} />
          <Field {...fieldProps} label="در کدام یک از کارخانجات گروه صنعتی کاوه اشتغال داشته‌اید" name="kave_factories" required placeholder="مثال: کارخانه شیشه کاوه - قطعات" />
          <RadioGroup {...fieldProps} label="استعمال دخانیات" name="smoking" options={['بله', 'خیر']} />
          {form.smoking === 'بله' && (
            <Field {...fieldProps} label="مدت زمان استعمال" name="smoking_duration" required placeholder="مثال: ۵ سال" />
          )}
        </div>

        <h3 className={sectionTitle}>سوابق کاری</h3>
        {workHistory.map((work, index) => (
          <div key={index} className="bg-gray-50 rounded-xl p-4 mb-3 relative">
            {!readOnly && workHistory.length > 1 && (
              <button type="button" onClick={() => removeWorkRow(index)} className="absolute top-2 left-2 text-red-500 hover:text-red-700 text-xs">حذف</button>
            )}
            <p className="text-xs font-bold text-gray-500 mb-2">شغل {index + 1}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>نام سازمان و نوع فعالیت <span className="text-red-500">*</span></label>
                <input name="org_name" value={work.org_name} onChange={(e) => handleWorkChange(index, e)} required className={readOnly ? inputDisabledClass : inputClass} placeholder={readOnly ? '' : 'مثال: شرکت ایران خودرو - تولید'} disabled={readOnly} readOnly={readOnly} />
              </div>
              <div>
                <label className={labelClass}>آخرین سمت <span className="text-red-500">*</span></label>
                <input name="position" value={work.position} onChange={(e) => handleWorkChange(index, e)} required className={readOnly ? inputDisabledClass : inputClass} placeholder={readOnly ? '' : 'مثال: کارشناس تولید'} disabled={readOnly} readOnly={readOnly} />
              </div>
              <div>
                <label className={labelClass}>مدت شغل <span className="text-red-500">*</span></label>
                <input name="duration" value={work.duration} onChange={(e) => handleWorkChange(index, e)} required className={readOnly ? inputDisabledClass : inputClass} placeholder={readOnly ? '' : 'مثال: ۲ سال و ۳ ماه'} disabled={readOnly} readOnly={readOnly} />
              </div>
              <div>
                <label className={labelClass}>آخرین حقوق (ریال) <span className="text-red-500">*</span></label>
                <input name="last_salary" value={work.last_salary} onChange={(e) => handleWorkChange(index, e)} required className={readOnly ? inputDisabledClass : inputClass} placeholder={readOnly ? '' : 'مثال: 60000000'} disabled={readOnly} readOnly={readOnly} />
              </div>
              <div>
                <label className={labelClass}>علت ترک سازمان <span className="text-red-500">*</span></label>
                <input name="leave_reason" value={work.leave_reason} onChange={(e) => handleWorkChange(index, e)} required className={readOnly ? inputDisabledClass : inputClass} placeholder={readOnly ? '' : 'مثال: اتمام قرارداد'} disabled={readOnly} readOnly={readOnly} />
              </div>
              <div>
                <label className={labelClass}>نشانی و تلفن تماس <span className="text-red-500">*</span></label>
                <input name="contact_info" value={work.contact_info} onChange={(e) => handleWorkChange(index, e)} required className={readOnly ? inputDisabledClass : inputClass} placeholder={readOnly ? '' : 'مثال: 09141234567'} disabled={readOnly} readOnly={readOnly} />
              </div>
            </div>
          </div>
        ))}
        {!readOnly && <button type="button" onClick={addWorkRow} className="text-sm text-primary-600 hover:text-primary-800 font-bold">+ افزودن سابقه کاری</button>}

        <h3 className={sectionTitle}>زبان‌های خارجی</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>زبان‌های خارجی (نام زبان - خواندن و نوشتن - مکالمه) <span className="text-red-500">*</span></label>
            <textarea name="foreign_languages" value={form.foreign_languages} onChange={handleChange} rows={2} required className={readOnly ? inputDisabledClass : inputClass} placeholder={readOnly ? '' : 'مثال:\nانگلیسی - خواندن و نوشتن: خوب - مکالمه: متوسط'} disabled={readOnly} readOnly={readOnly} />
          </div>
          <RadioGroup {...fieldProps} label="زبان ترکی" name="turkish_known" options={['بله', 'خیر']} />
        </div>

        <h3 className={sectionTitle}>نرم‌افزارهای کامپیوتری</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>نرم‌افزارها (نام نرم‌افزار - میزان آشنایی) <span className="text-red-500">*</span></label>
            <textarea name="computer_skills" value={form.computer_skills} onChange={handleChange} rows={2} required className={readOnly ? inputDisabledClass : inputClass} placeholder={readOnly ? '' : 'مثال:\nMicrosoft Word - خوب\nMicrosoft Excel - متوسط'} disabled={readOnly} readOnly={readOnly} />
          </div>
        </div>

        <h3 className={sectionTitle}>دوره‌های آموزشی</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>دوره‌ها (نام دوره - موسسه - تاریخ - وضعیت مدرک) <span className="text-red-500">*</span></label>
            <textarea name="training_courses" value={form.training_courses} onChange={handleChange} rows={2} required className={readOnly ? inputDisabledClass : inputClass} placeholder={readOnly ? '' : 'مثال:\nICDL - آموزشگاه کامپیوتر XYZ'} disabled={readOnly} readOnly={readOnly} />
          </div>
        </div>

        <h3 className={sectionTitle}>معرف‌ها</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>دو نفر معرف (نام و نام خانوادگی - شغل - نشانی و تلفن) <span className="text-red-500">*</span></label>
            <textarea name="references_info" value={form.references_info} onChange={handleChange} rows={3} required className={readOnly ? inputDisabledClass : inputClass} placeholder={readOnly ? '' : 'معرف ۱:...'} disabled={readOnly} readOnly={readOnly} />
          </div>
        </div>

        <h3 className={sectionTitle}>فایل‌های پیوست</h3>
        {!readOnly ? (
          <div>
            <label className={labelClass}>رزومه، مدرک تحصیلی و سایر مدارک</label>
            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files))} className={inputClass} accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar" />
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <p key={i} className="text-xs text-gray-500">{f.name} ({(f.size / 1024).toFixed(1)} KB)</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">مدارک قبلاً بارگذاری شده</p>
        )}

        <div className="pt-4 border-t flex gap-4">
          <button type="button" onClick={() => printJobApplication(submittedData || { ...form, work_history: workHistory })} className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition">
            چاپ پرسشنامه
          </button>
          {!readOnly && (
            <button type="submit" disabled={loading} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50">
              {loading ? 'در حال ثبت...' : 'ثبت پرسشنامه'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
