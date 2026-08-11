import { useState, useEffect } from 'react';
import api from '../api/axios';

function jalaliDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'persian' });
  } catch { return dateStr || ''; }
}

function formatDays(hours) {
  const d = Math.floor(hours / 8);
  const h = hours % 8;
  let r = '';
  if (d > 0) r += `${d}`;
  if (h > 0) r += `${r ? ' و ' : ''}${h}`;
  return r || '۰';
}

function jalaliNow() {
  return new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'persian' });
}

// ابعاد تصویر اصلی فرم
const IMG_W = 767;
const IMG_H = 537;

const VALUE_STYLE = {
  fontFamily: "'Vazirmatn', Tahoma, sans-serif",
  fontWeight: 800,
  color: '#1a5ab8',
  whiteSpace: 'nowrap',
};

export default function LeavePrintView({ leave, onClose }) {
  const [freshLeave, setFreshLeave] = useState(leave);
  const [userSig, setUserSig] = useState(null);
  const [supervisorSig, setSupervisorSig] = useState(null);
  const [managerSig, setManagerSig] = useState(null);
  const [adminSig, setAdminSig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadFresh(); }, [leave]);

  const loadFresh = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/leave/${leave.id}`);
      if (res.data) setFreshLeave(res.data);
    } catch {}
    await loadSignatures();
  };

  const loadSignatures = async () => {
    const lv = freshLeave || leave;
    try {
      const [uRes, sRes, mRes, aRes] = await Promise.all([
        api.get(`/signature/user/${lv.user_id}`),
        lv.supervisor_id
          ? api.get(`/signature/user/${lv.supervisor_id}`)
          : lv.supervisor_name
            ? api.get(`/signature/all-users`).then(r => {
                const sup = r.data?.find(s => s.full_name === lv.supervisor_name);
                return sup ? api.get(`/signature/user/${sup.user_id}`) : Promise.resolve({ data: null });
              }).catch(() => ({ data: null }))
            : Promise.resolve({ data: null }),
        lv.manager_id ? api.get(`/signature/user/${lv.manager_id}`) : Promise.resolve({ data: null }),
        lv.admin_id ? api.get(`/signature/user/${lv.admin_id}`) : Promise.resolve({ data: null }),
      ]);
      setUserSig(uRes.data);
      setSupervisorSig(sRes.data);
      setManagerSig(mRes.data);
      setAdminSig(aRes.data);
    } catch {}
    setLoading(false);
  };

  const daysText = formatDays(freshLeave.hours_count);
  const cardCode = userSig?.employee_code || freshLeave.user_id || '';

  const handlePrint = () => {
    const el = document.getElementById('leave-form-print');
    if (!el) return;
    const clone = el.cloneNode(true);
    const wrapper = document.createElement('div');
    wrapper.id = 'pw';
    wrapper.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999;background:#fff;display:flex;align-items:center;justify-content:center;';

    clone.style.cssText = 'position:absolute;width:767px;height:537px;overflow:hidden;background:#fff;';

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    const s = document.createElement('style');
    s.id = 'pstyle';
    s.textContent = `
      @media print {
        body > *:not(#pw) {
          display: none !important;
        }
        #pw {
          position: fixed !important;
          left: 0 !important;
          top: 0 !important;
          width: 297mm !important;
          height: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #pw > div {
          position: absolute !important;
          left: 50% !important;
          top: 50% !important;
          width: 767px !important;
          height: 537px !important;
          transform: translate(-50%, -50%) scale(1.46) !important;
          transform-origin: center center !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @page {
          size: 297mm 210mm landscape;
          margin: 0;
        }
      }
    `;
    document.head.appendChild(s);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        wrapper.remove();
        s.remove();
      }, 500);
    }, 300);
  };

  if (loading) return <div className="text-center py-4 text-gray-400">در حال بارگذاری...</div>;

  const val = (x, y, fs, extra) => ({
    position: 'absolute',
    left: x,
    top: y,
    fontSize: fs || 14,
    ...VALUE_STYLE,
    ...extra,
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4 no-print">
        <h3 className="font-bold text-lg">پیش‌نمایش برگ درخواست مرخصی</h3>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="text-blue-600 hover:text-blue-800 px-5 py-2.5 rounded-xl text-sm font-bold border border-blue-300 hover:bg-blue-50 transition-colors">🖨️ چاپ</button>
          <button onClick={onClose} className="bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-bold">بستن</button>
        </div>
      </div>

      {/* کانتینر ثابت بر اساس ابعاد تصویر اصلی — بدون تغییر شکل */}
      <div id="leave-form-print" style={{
        position: 'relative',
        width: IMG_W,
        height: IMG_H,
        overflow: 'hidden',
        background: '#fff',
        margin: '0 auto',
        border: '1px solid #ccc',
      }}>
        {/* عکس فرم اصلی */}
        <img
          src="/leave-bg.webp"
          alt="فرم مرخصی"
          style={{ position: 'absolute', top: 0, left: 0, width: IMG_W, height: IMG_H, objectFit: 'contain', zIndex: 0 }}
        />

        {/* ─── لایه داده‌ها — فقط مقادیر روی نقطه‌چین‌ها ─── */}
        <div style={{ position: 'relative', zIndex: 1, width: IMG_W, height: IMG_H, direction: 'rtl' }}>

          {/* ── شماره پرسنلی (ردیف اطلاعات - جلوی "شماره کارت:" سمت چپ) ── */}
          <div style={val(61, 110, 15, { direction: 'ltr', unicodeBidi: 'plaintext', borderBottom: '1px dotted #555', paddingBottom: 1 })}>
            {cardCode}
          </div>

          {/* ── تاریخ (ردیف اطلاعات - سمت راست تصویر) ── */}
          <div style={val(257, 110, 15, { direction: 'rtl', unicodeBidi: 'normal', borderBottom: '1px dotted #555', paddingBottom: 1 })}>
            {freshLeave.start_date || jalaliDate(freshLeave.start_date)}
          </div>

          {/* ── نوع مرخصی (روزانه / ساعتی) ── */}
          {freshLeave.leave_type === 'روزانه' && (
            <div style={val(600, 170, 13, { direction: 'rtl', unicodeBidi: 'normal' })}>
              درخواست مرخصی روز
            </div>
          )}
          {freshLeave.leave_type === 'ساعتی' && (
            <div style={val(500, 170, 13, { direction: 'rtl', unicodeBidi: 'normal' })}>
              مرخصی ساعتی
            </div>
          )}

          {/* ── بخش ۱: نام کاربر (روی نقطه‌چین) ── */}
          <div style={val(140, 170, 14, { direction: 'rtl', unicodeBidi: 'normal', borderBottom: '1px dotted #555', paddingBottom: 1 })}>
            {freshLeave.user_name || '—'}
          </div>

          {/* ── بخش ۱: ساعت شروع (مرخصی ساعتی) ── */}
          {freshLeave.start_hour && (
            <div style={val(490, 260, 13, { direction: 'ltr', unicodeBidi: 'plaintext' })}>
              {freshLeave.start_hour}
            </div>
          )}

          {/* ── بخش ۱: ساعت پایان (مرخصی ساعتی) ── */}
          {freshLeave.end_hour && (
            <div style={val(320, 260, 13, { direction: 'ltr', unicodeBidi: 'plaintext' })}>
              {freshLeave.end_hour}
            </div>
          )}

          {/* ── بخش ۱: روز (روی نقطه‌چین "با ........ روز") ── */}
          <div style={val(510, 148, 18)}>
            {daysText}
          </div>

          {/* ── بخش ۱: واحد (روی نقطه‌چین "واحد ........") ── */}
          <div style={val(650, 235, 14, { direction: 'rtl', unicodeBidi: 'normal', borderBottom: '1px dotted #555', paddingBottom: 1 })}>
            {freshLeave.user_dept || '—'}
          </div>

          {/* ── بخش ۱: از تاریخ (روی نقطه‌چین "از تاریخ ........") ── */}
          <div style={val(470, 235, 14, { direction: 'rtl', unicodeBidi: 'normal', borderBottom: '1px dotted #555', paddingBottom: 1 })}>
            {freshLeave.start_date}
          </div>

          {/* ── بخش ۱: لغایت (روی نقطه‌چین "لغایت ........") ── */}
          <div style={val(308, 235, 14, { direction: 'rtl', unicodeBidi: 'normal', borderBottom: '1px dotted #555', paddingBottom: 1 })}>
            {freshLeave.end_date}
          </div>

          {/* ── بخش ۲: جمع مرخصی (روی نقطه‌چین) ── */}
          <div style={val(348, 295, 16, { borderBottom: '1px dotted #555', paddingBottom: 1 })}>
            {daysText}
          </div>

          {/* ── بخش ۳: روز (روی نقطه‌چین "با ........ روز") ── */}
          <div style={val(647, 380, 18)}>
            {daysText}
          </div>

          {/* ── امضای سرپرست ── */}
          <div style={{ position: 'absolute', left: 594, top: 395, textAlign: 'center' }}>
            {supervisorSig && (supervisorSig.scanned_signature || supervisorSig.signature_data) && (
              <img
                src={supervisorSig.scanned_signature || supervisorSig.signature_data}
                alt="امضای سرپرست"
                style={{ width: 150, height: 150, objectFit: 'contain', mixBlendMode: 'multiply' }}
              />
            )}
          </div>

          {/* ── امضای مدیر ── */}
          <div style={{ position: 'absolute', left: 300, top: 395, textAlign: 'center' }}>
            {managerSig && (managerSig.scanned_signature || managerSig.signature_data) && (
              <img
                src={managerSig.scanned_signature || managerSig.signature_data}
                alt="امضای مدیر"
                style={{ width: 150, height: 150, objectFit: 'contain', mixBlendMode: 'multiply' }}
              />
            )}
          </div>

          {/* ── امضای اداری ── */}
          <div style={{ position: 'absolute', left: 130, top: 260, textAlign: 'center' }}>
            {adminSig && (adminSig.scanned_signature || adminSig.signature_data) && (
              <img
                src={adminSig.scanned_signature || adminSig.signature_data}
                alt="امضای اداری"
                style={{ width: 150, height: 150, objectFit: 'contain', mixBlendMode: 'multiply' }}
              />
            )}
          </div>

          {/* ── امضای کارگزینی ── */}
          <div style={{ position: 'absolute', left: 100, top: 175, textAlign: 'center' }}>
            {userSig && (userSig.scanned_signature || userSig.signature_data) && (
              <img
                src={userSig.scanned_signature || userSig.signature_data}
                alt="امضای کارگزینی"
                style={{ width: 150, height: 150, objectFit: 'contain', mixBlendMode: 'multiply' }}
              />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
