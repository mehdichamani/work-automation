import { useState } from 'react';

function hasSig(sig) {
  return sig && (sig.scanned_signature || sig.signature_data);
}
function sigUrl(sig) {
  return sig?.scanned_signature || sig?.signature_data || '';
}

function SigCard({ label, sig, approved }) {
  const showImg = hasSig(sig);
  return (
    <div className="pm01-sign-box flex flex-col items-center justify-center min-h-[80px]">
      <div className="font-bold mb-1 text-[8px]">{label}</div>
      {showImg ? (
        <img src={sigUrl(sig)} alt={label} className="h-16 w-full object-contain mx-auto" />
      ) : approved ? (
        <span className="text-[7px] text-green-600 font-bold">✓ تایید شده</span>
      ) : (
        <span className="text-[7px] text-gray-300">امضا ثبت نشده</span>
      )}
    </div>
  );
}

export default function RepairExternalPrintView({ request, items, history, signatures, onClose }) {
  const r = request;
  const sigs = signatures || {};
  const loading = false;

  const handlePrint = () => {
    const el = document.getElementById('pm01-form-print');
    if (!el) return;
    const clone = el.cloneNode(true);
    const wrapper = document.createElement('div');
    wrapper.id = 'pm01pw';
    wrapper.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999;background:#fff;display:flex;align-items:center;justify-content:center;';
    clone.style.cssText = 'position:relative;width:210mm;min-height:297mm;overflow:hidden;background:#fff;padding:10mm;font-family:Vazirmatn,Tahoma,sans-serif;direction:rtl;';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);
    const s = document.createElement('style');
    s.id = 'pm01ps';
    s.textContent = `
      @media print {
        body > *:not(#pm01pw) { display: none !important; }
        #pm01pw { position: static !important; }
        #pm01pw > div { position: relative !important; width: 210mm !important; min-height: 297mm !important; padding: 10mm !important; }
        @page { size: A4 portrait; margin: 10mm; }
        .pm01-section { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; break-inside: avoid; page-break-inside: avoid; }
        .pm01-sign-grid { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; break-inside: avoid; page-break-inside: avoid; }
        .pm01-sign-box { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; break-inside: avoid; page-break-inside: avoid; border: 1px solid #333 !important; }
        .pm01-sign-box img { display: block !important; max-width: 100% !important; max-height: 40px !important; width: auto !important; height: auto !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; object-fit: contain !important; mix-blend-mode: multiply !important; margin: 0 auto !important; }
        .pm01-section-title { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .pm01-label { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .pm01-value { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .pm01-table th { background: #f3f4f6 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .pm01-table td, .pm01-table th { border: 1px solid #666 !important; }
      }
      .pm01-section { border: 1.5px solid #333; border-radius: 6px; margin-bottom: 10px; padding: 10px; page-break-inside: avoid; break-inside: avoid; }
      .pm01-section-title { font-weight: bold; font-size: 12px; border-bottom: 1.5px solid #333; padding-bottom: 4px; margin-bottom: 8px; color: #111; }
      .pm01-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 11px; }
      .pm01-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11px; }
      .pm01-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 11px; }
      .pm01-label { color: #4b5563; font-size: 10px; font-weight: 500; }
      .pm01-value { font-weight: 700; color: #111827; }
      .pm01-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
      .pm01-table th, .pm01-table td { border: 1.5px solid #333; padding: 5px 8px; text-align: right; }
      .pm01-table th { background: #f3f4f6; font-weight: 700; color: #111; }
      .pm01-sign-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; font-size: 10px; }
      .pm01-sign-box { border: 1.5px solid #333; border-radius: 4px; padding: 6px; text-align: center; min-height: 60px; display: flex; flex-direction: column; justify-content: space-between; }
      .pm01-check { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #333; border-radius: 3px; margin-left: 4px; vertical-align: middle; text-align: center; line-height: 11px; font-size: 11px; font-weight: bold; background: #fff; }
      .pm01-check.checked::after { content: '✓'; color: #059669; }
    `;
    document.head.appendChild(s);
    setTimeout(() => { window.print(); setTimeout(() => { wrapper.remove(); s.remove(); }, 500); }, 300);
  };

  const checked = (val) => val ? 'pm01-check checked' : 'pm01-check';
  const hasWorkType = (wt) => r.work_type?.split(',').map(s => s.trim()).includes(wt) || false;
  const hasDestination = (d) => r.destination?.split(',').map(s => s.trim()).includes(d) || false;

  const approvalCards = [
    { label: 'مسئول واحد', sig: sigs.dept_manager, approved: r.dept_manager_approved },
    { label: 'PM برنامه‌ریزی', sig: sigs.pm, approved: r.pm_approved },
    { label: 'برق/فنی', sig: sigs.tech_manager, approved: r.tech_manager_approved },
    { label: 'انبار', sig: sigs.warehouse, approved: r.warehouse_approved },
    { label: 'مدیر کارخانه', sig: sigs.factory_manager, approved: r.factory_manager_approved },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl shadow-2xl my-4 max-h-[96vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 no-print">
          <h3 className="font-bold text-lg">پیش‌نمایش فرم PM_01</h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-blue-600">🖨️ چاپ</button>
            <button onClick={onClose} className="bg-gray-200 text-gray-700 px-5 py-2 rounded-xl text-sm font-bold">بستن</button>
          </div>
        </div>

        <div id="pm01-form-print">
          <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '3px double #333', paddingBottom: '8px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>شرکت اروم شیشه ساچی</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px' }}>درخواست تعمیرات / کالیبراسیون خارج از کارخانه</div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>کد سند: PM_01 | تاریخ ویرایش: {r.edit_date || '۱۴۰۴/۰۹/۲۶'}</div>
          </div>

          <div className="pm01-section">
            <div className="pm01-section-title">۱. سربرگ و اطلاعات پایه</div>
            <div className="pm01-grid">
              <div><span className="pm01-label">کد سند: </span><span className="pm01-value">{r.doc_code || 'PM_01'}</span></div>
              <div><span className="pm01-label">شماره ویرایش: </span><span className="pm01-value">{r.revision_number || '-'}</span></div>
              <div><span className="pm01-label">شماره درخواست: </span><span className="pm01-value">{r.request_number}</span></div>
              <div><span className="pm01-label">تاریخ فرم: </span><span className="pm01-value">{r.form_date || '-'}</span></div>
            </div>
          </div>

          <div className="pm01-section">
            <div className="pm01-section-title">۲. واحد متقاضی</div>
            <div className="pm01-grid-3">
              <div><span className="pm01-label">از واحد: </span><span className="pm01-value">{r.from_unit}</span></div>
              <div><span className="pm01-label">به واحد: </span><span className="pm01-value">{r.to_unit}</span></div>
              <div><span className="pm01-label">نام مسئول واحد: </span><span className="pm01-value">{r.manager_name}</span></div>
            </div>
          </div>

          <div className="pm01-section">
            <div className="pm01-section-title">۳. مشخصات کالا</div>
            <table className="pm01-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}>ردیف</th>
                  <th>نام تجهیز/قطعه/کالا</th>
                  <th>مشخصات فنی</th>
                  <th>سریال</th>
                  <th style={{ width: '40px' }}>تعداد</th>
                  <th>متعلقات دستگاه</th>
                </tr>
              </thead>
              <tbody>
                {items && items.length > 0 ? items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td>{it.item_name}</td>
                    <td>{it.tech_specs}</td>
                    <td>{it.serial_number}</td>
                    <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                    <td>{it.attachments_desc}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#999' }}>آیتمی ثبت نشده</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pm01-section">
            <div className="pm01-section-title">۴. اطلاعات فنی و شرح خرابی</div>
            <div className="pm01-grid-2" style={{ marginBottom: '6px' }}>
              <div><span className="pm01-label">شرح داده‌های فنی: </span><span className="pm01-value">{r.tech_description || '-'}</span></div>
              <div><span className="pm01-label">قیمت حدودی: </span><span className="pm01-value">{r.estimated_cost ? `${Number(r.estimated_cost).toLocaleString('fa-IR')} ریال` : '-'}</span></div>
              <div><span className="pm01-label">شرح اشکال: </span><span className="pm01-value">{r.fault_description || '-'}</span></div>
              <div><span className="pm01-label">شرح علت بروز مشکل: </span><span className="pm01-value">{r.fault_reason || '-'}</span></div>
            </div>
            <div className="pm01-grid" style={{ marginBottom: '6px' }}>
              <div>
                <span className="pm01-label">نوع تعمیر: </span>
                <span className={checked(r.repair_speed === 'urgent')}></span> فوری
                <span className={checked(r.repair_speed === 'normal')} style={{ marginRight: '8px' }}></span> عادی
              </div>
              <div><span className="pm01-label">تا تاریخ (مهلت): </span><span className="pm01-value">{r.deadline || '-'}</span></div>
              <div>
                <span className="pm01-label">نوع کار: </span>
                {['تعمیر', 'تعمیر مجدد', 'کالیبره', 'جهت تست'].map(wt => (
                  <span key={wt} style={{ marginRight: '6px' }}>
                    <span className={checked(hasWorkType(wt))}></span> {wt}
                  </span>
                ))}
              </div>
              <div><span className="pm01-label">تعداد موجودی انبار: </span><span className="pm01-value">{r.warehouse_stock ?? 0}</span></div>
            </div>
            <div className="pm01-grid-2">
              <div>
                <span className="pm01-label">وضعیت انبار: </span>
                <span className={checked(r.warehouse_stock_status === 'سالم')}></span> سالم
                <span className={checked(r.warehouse_stock_status === 'معیوب')} style={{ marginRight: '8px' }}></span> معیوب
              </div>
              <div><span className="pm01-label">تجهیز اصلی: </span><span className="pm01-value">{r.equipment_name || '-'}</span></div>
            </div>
          </div>

          <div className="pm01-section">
            <div className="pm01-section-title">۵. خروج از شرکت و تاییدات</div>
            <div className="pm01-grid" style={{ marginBottom: '8px' }}>
              <div><span className="pm01-label">تاریخ تحویل از واحد: </span><span className="pm01-value">{r.delivery_date || '-'}</span></div>
              <div><span className="pm01-label">تاریخ ارسال به تهران: </span><span className="pm01-value">{r.send_date || '-'}</span></div>
              <div><span className="pm01-label">شماره سریال خروجی: </span><span className="pm01-value">{r.send_serial || '-'}</span></div>
              <div>
                <span className="pm01-label">جهت ارسال: </span>
                {['تهران', 'سایر ۱', 'سایر ۲'].map(d => (
                  <span key={d} style={{ marginRight: '6px' }}>
                    <span className={checked(hasDestination(d))}></span> {d}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ borderTop: '1px solid #ccc', paddingTop: '6px' }}>
              <div className="pm01-sign-grid">
                {approvalCards.map((s, i) => (
                  <SigCard key={i} label={s.label} sig={s.sig} approved={s.approved} />
                ))}
              </div>
            </div>
          </div>

          <div className="pm01-section">
            <div className="pm01-section-title">۶. واحد پشتیبانی (تعمیرگاه)</div>
            <div className="pm01-grid-2">
              <div><span className="pm01-label">نام شرکت ارسال شده: </span><span className="pm01-value">{r.contractor_name || '-'}</span></div>
              <div><span className="pm01-label">نام و امضاء مسئول پیگیری: </span><span className="pm01-value">{r.supporter_name || '-'}</span></div>
              <div><span className="pm01-label">آدرس تعمیرگاه و تلفن: </span><span className="pm01-value">{r.contractor_address || '-'}</span></div>
              <div><span className="pm01-label">هزینه تعمیرات بعد از تخفیف: </span><span className="pm01-value">{r.repair_cost ? `${Number(r.repair_cost).toLocaleString('fa-IR')} ریال` : '-'}</span></div>
              <div style={{ gridColumn: 'span 2' }}><span className="pm01-label">شرح تعمیرات: </span><span className="pm01-value">{r.repair_description || '-'}</span></div>
            </div>
          </div>

          <div className="pm01-section">
            <div className="pm01-section-title">۷. انبار و کنترل کیفی (بازگشت کالا)</div>
            <div className="pm01-grid-2" style={{ marginBottom: '6px' }}>
              <div><span className="pm01-label">تاریخ ورود به انبار: </span><span className="pm01-value">{r.return_date || '-'}</span></div>
              <div><span className="pm01-label">شماره سریال وارده انبار: </span><span className="pm01-value">{r.return_serial || '-'}</span></div>
              <div>
                <span className="pm01-label">وضعیت کیفی: </span>
                <span className={checked(r.quality_status === 'مورد تایید می‌باشد')}></span> مورد تایید
                <span className={checked(r.quality_status === 'مورد تایید نمی‌باشد')} style={{ marginRight: '8px' }}></span> نمی‌باشد
              </div>
              <div><span className="pm01-label">توضیحات: </span><span className="pm01-value">{r.quality_notes || '-'}</span></div>
            </div>
            <div className="pm01-sign-grid">
              {approvalCards.map((s, i) => (
                <SigCard key={i} label={s.label} sig={s.sig} approved={s.approved} />
              ))}
            </div>
          </div>

          <div style={{ marginTop: '15px', fontSize: '8px', color: '#999', textAlign: 'center', borderTop: '1px solid #ccc', paddingTop: '4px' }}>
            شماره درخواست: {r.request_number} | تاریخ: {r.form_date || r.created_at} | فرم PM_01
          </div>
        </div>
      </div>
    </div>
  );
}