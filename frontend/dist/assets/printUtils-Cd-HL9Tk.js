function p(a,s,i,e={}){const{companyName:l="شرکت اروم شیشه ساچی",orientation:n="landscape"}=e,r=`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${a}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap');
        
        * { font-family: 'Vazirmatn', sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
        
        body { padding: 20px; }
        
        .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #1e40af; padding-bottom: 15px; }
        .company { font-size: 14px; color: #1e40af; font-weight: 700; }
        .title { font-size: 18px; font-weight: 800; margin-top: 8px; color: #111827; }
        .date { font-size: 11px; color: #6b7280; margin-top: 5px; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #1e40af; color: white; padding: 8px 12px; font-size: 11px; font-weight: 600; text-align: right; }
        td { padding: 7px 12px; border-bottom: 1px solid #e5e7eb; font-size: 11px; text-align: right; }
        tr:nth-child(even) { background: #f9fafb; }
        tr:hover { background: #f3f4f6; }
        
        .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-yellow { background: #fef3c7; color: #92400e; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        .badge-blue { background: #dbeafe; color: #1e40af; }
        .badge-purple { background: #ede9fe; color: #5b21b6; }
        .badge-gray { background: #f3f4f6; color: #374151; }
        
        .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        
        @media print {
          body { padding: 10px; }
          @page { size: ${n}; margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company">${l}</div>
        <div class="title">${a}</div>
        <div class="date">تاریخ چاپ: ${new Date().toLocaleDateString("fa-IR")}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            ${s.map(t=>`<th>${t.label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${i.map((t,c)=>`
            <tr>
              <td>${c+1}</td>
              ${s.map(o=>`<td>${o.render?o.render(t[o.key],t):t[o.key]||"-"}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="footer">چاپ شده در ${new Date().toLocaleString("fa-IR")} | سیستم اتوماسیون اداری</div>
    </body>
    </html>
  `,d=window.open("","_blank");d.document.write(r),d.document.close(),setTimeout(()=>d.print(),500)}function f(a,s,i={}){p(a,[{key:"user_name",label:"کاربر"},{key:"item_name",label:"کالا"},{key:"quantity",label:"تعداد",render:(l,n)=>`${l} ${n.item_unit||""}`},{key:"delivery_date",label:"تاریخ تحویل"},{key:"status",label:"وضعیت",render:l=>({pending_user:"در انتظار تایید",confirmed:"تایید شده",rejected:"رد شده"})[l]||l}],s,i)}function b(a,s=[]){var l;const i=`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>چاپ نامه</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap');
        * { font-family: 'Vazirmatn', sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
        body { padding: 30px; }
        
        .header { text-align: center; border-bottom: 3px double #1e40af; padding-bottom: 15px; margin-bottom: 25px; }
        .company { font-size: 16px; color: #1e40af; font-weight: 700; }
        .subtitle { font-size: 11px; color: #6b7280; margin-top: 5px; }
        
        .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
        .meta-item { display: flex; gap: 5px; }
        .meta-label { font-weight: 600; color: #374151; }
        .meta-value { color: #6b7280; }
        
        .subject { font-size: 16px; font-weight: 700; margin-bottom: 15px; padding: 10px; background: #f3f4f6; border-radius: 8px; }
        
        .body { font-size: 13px; line-height: 2; white-space: pre-wrap; margin-bottom: 25px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; }
        
        .priority { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
        .priority-normal { background: #f3f4f6; color: #374151; }
        .priority-important { background: #fed7aa; color: #9a3412; }
        .priority-very_important { background: #fecaca; color: #991b1b; }
        
        .status { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
        .status-approved { background: #d1fae5; color: #065f46; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-rejected { background: #fee2e2; color: #991b1b; }
        
        .attachment { margin: 10px 0; padding: 8px; background: #eff6ff; border-radius: 6px; font-size: 11px; color: #1e40af; }
        
        .history { margin-top: 20px; }
        .history-title { font-size: 13px; font-weight: 600; margin-bottom: 10px; color: #374151; }
        .history-item { display: flex; gap: 10px; margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 6px; font-size: 11px; }
        .history-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; color: white; }
        
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        
        @media print {
          body { padding: 15px; }
          @page { size: A4 portrait; margin: 15mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company">شرکت اروم شیشه ساچی</div>
        <div class="subtitle">سیستم مدیریت نامه‌ها</div>
      </div>
      
      <div class="meta">
        <div class="meta-item"><span class="meta-label">شماره:</span><span class="meta-value">${a.letter_number||"-"}</span></div>
        <div class="meta-item"><span class="meta-label">تاریخ ثبت:</span><span class="meta-value">${((l=a.created_at)==null?void 0:l.split("T")[0])||"-"}</span></div>
        <div class="meta-item">
          <span class="meta-label">اولویت:</span>
          <span class="priority priority-${a.priority}">${{normal:"عادی",important:"مهم",very_important:"خیلی مهم"}[a.priority]||a.priority}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">وضعیت:</span>
          <span class="status status-${a.status==="approved"?"approved":a.status==="rejected"?"rejected":"pending"}">${{pending_central:"در انتظار سانترال",pending_manager:"در انتظار مدیر",approved:"تایید شده",rejected:"رد شده",archived:"بایگانی شده",forwarded:"ارجاع شده"}[a.status]||a.status}</span>
        </div>
      </div>
      
      <div class="meta" style="margin-bottom: 15px;">
        <div class="meta-item"><span class="meta-label">فرستنده:</span><span class="meta-value">${a.sender_name||"-"} (${a.sender_unit_name||"-"})</span></div>
        ${a.manager_name?`<div class="meta-item"><span class="meta-label">مدیر بررسی‌کننده:</span><span class="meta-value">${a.manager_name}</span></div>`:""}
      </div>
      
      <div class="subject">موضوع: ${a.subject||"-"}</div>
      
      ${a.body?`<div class="body">${a.body}</div>`:""}
      
      ${a.attachment_name?`<div class="attachment">فایل پیوست: ${a.attachment_name}</div>`:""}
      
      ${a.manager_comment?`<div style="margin-bottom: 15px; padding: 10px; background: #eff6ff; border-radius: 8px; font-size: 12px;"><strong>نظر مدیر:</strong> ${a.manager_comment}</div>`:""}
      
      ${s.length>0?`
        <div class="history">
          <div class="history-title">روند چرخش نامه</div>
          ${s.map((n,r)=>{var d;return`
            <div class="history-item">
              <span class="history-badge" style="background:${{created:"#3b82f6",sent_to_manager:"#eab308",approved:"#22c55e",rejected:"#ef4444",archived:"#8b5cf6",forwarded:"#6366f1",seen_unit:"#6b7280"}[n.action]||"#6b7280"}">${{created:"ثبت",sent_to_manager:"ارسال به مدیر",approved:"تایید",rejected:"رد",archived:"بایگانی",forwarded:"ارجاع",seen_unit:"رویت واحد"}[n.action]||n.action}</span>
              <span>${n.user_name}</span>
              <span style="color:#9ca3af">${((d=n.created_at)==null?void 0:d.replace("T"," ").substring(0,16))||""}</span>
              ${n.comment?`<span style="color:#6b7280">- ${n.comment}</span>`:""}
            </div>
          `}).join("")}
        </div>
      `:""}
      
      <div class="footer">چاپ شده در ${new Date().toLocaleString("fa-IR")} | سیستم اتوماسیون اداری اروم شیشه ساچی</div>
    </body>
    </html>
  `,e=window.open("","_blank");e.document.write(i),e.document.close(),setTimeout(()=>e.print(),500)}function m(a,s={}){p("همه درخواست‌های مرخصی",[{key:"user_name",label:"نام"},{key:"user_dept",label:"واحد"},{key:"leave_type",label:"نوع"},{key:"start_date",label:"از تاریخ"},{key:"end_date",label:"تا تاریخ"},{key:"days_count",label:"روزها"},{key:"status",label:"وضعیت",render:e=>({pending_supervisor:"در انتظار سرپرست",pending_manager:"در انتظار مدیر",approved:"تایید شده",rejected:"رد شده",seen_security:"رویت شده (حراست)"})[e]||e}],a,s)}function v(a,s={}){p("لیست رزروهای رستوران",[{key:"user_name",label:"نام"},{key:"food_name",label:"غذا"},{key:"option_number",label:"گزینه",render:e=>`گزینه ${e}`},{key:"food_date",label:"تاریخ"},{key:"quantity",label:"تعداد"},{key:"status",label:"وضعیت",render:e=>e==="active"?"فعال":"لغو شده"}],a,s)}function g(a,s={}){p("خلاصه مانیتورینگ رستوران",[{key:"food_date",label:"تاریخ"},{key:"total_meals",label:"کل وعده‌ها"}],a,s)}function u(a){const s=`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>پرسشنامه استخدامی</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap');
        * { font-family: 'Vazirmatn', sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
        body { padding: 25px; font-size: 12px; }
        
        .header { text-align: center; border-bottom: 3px double #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
        .company { font-size: 16px; color: #1e40af; font-weight: 800; }
        .title { font-size: 18px; font-weight: 800; margin-top: 8px; color: #111827; }
        .date { font-size: 10px; color: #6b7280; margin-top: 5px; }
        
        .section { margin-bottom: 18px; }
        .section-title { font-size: 13px; font-weight: 700; color: #1e40af; border-bottom: 2px solid #bfdbfe; padding-bottom: 4px; margin-bottom: 10px; }
        
        .fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .field { display: flex; flex-direction: column; }
        .field-label { font-size: 10px; color: #6b7280; font-weight: 600; }
        .field-value { font-size: 12px; color: #111827; font-weight: 500; padding: 3px 0; border-bottom: 1px dotted #d1d5db; min-height: 20px; }
        
        .field-full { grid-column: span 2; }
        .field-span3 { grid-column: span 3; }
        
        .work-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .work-table th { background: #f3f4f6; padding: 6px 8px; font-size: 10px; font-weight: 600; text-align: right; border: 1px solid #e5e7eb; }
        .work-table td { padding: 6px 8px; font-size: 11px; text-align: right; border: 1px solid #e5e7eb; }
        
        .textarea-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; min-height: 40px; white-space: pre-wrap; font-size: 11px; line-height: 1.8; }
        
        .radio-group { display: flex; gap: 15px; margin-top: 3px; }
        .radio-item { display: flex; align-items: center; gap: 4px; font-size: 11px; }
        .radio-dot { width: 12px; height: 12px; border: 2px solid #6b7280; border-radius: 50%; display: inline-block; }
        .radio-dot.checked { background: #1e40af; border-color: #1e40af; }
        
        .footer { margin-top: 25px; text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        
        .signature-area { margin-top: 40px; display: flex; justify-content: space-between; }
        .signature-box { text-align: center; width: 200px; }
        .signature-line { border-top: 1px solid #374151; margin-top: 60px; padding-top: 5px; font-size: 10px; color: #374151; }
        
        @media print {
          body { padding: 10mm; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div style="display:flex;align-items:center;justify-content:center;gap:20px;">
          ${a.photo?`<img src="${a.photo}" style="width:100px;height:100px;object-fit:cover;border-radius:12px;border:3px solid #1e40af;" />`:""}
          <div>
            <div class="company">شرکت اروم شیشه ساچی</div>
            <div class="title">پرسشنامه استخدامی</div>
            <div style="margin-top:6px;font-size:11px;color:#374151;">
              ${a.application_number?`<span style="margin-left:15px;"><strong>شماره:</strong> ${a.application_number}</span>`:""}
              <span><strong>تاریخ ثبت:</strong> ${a.created_at?new Date(a.created_at).toLocaleDateString("fa-IR"):new Date().toLocaleDateString("fa-IR")}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">اطلاعات شخصی</div>
        <div class="fields">
          <div class="field"><span class="field-label">نام و نام خانوادگی</span><span class="field-value">${a.full_name||""}</span></div>
          <div class="field"><span class="field-label">نام پدر</span><span class="field-value">${a.father_name||""}</span></div>
          <div class="field"><span class="field-label">شماره شناسنامه</span><span class="field-value">${a.national_id||""}</span></div>
          <div class="field"><span class="field-label">صادره از</span><span class="field-value">${a.national_id_issued_from||""}</span></div>
          <div class="field"><span class="field-label">تاریخ تولد</span><span class="field-value">${a.birth_date||""}</span></div>
          <div class="field"><span class="field-label">محل تولد</span><span class="field-value">${a.birth_place||""}</span></div>
          <div class="field"><span class="field-label">مدت اقامت</span><span class="field-value">${a.residence_duration||""}</span></div>
          <div class="field"><span class="field-label">ملیت</span><span class="field-value">${a.nationality||""}</span></div>
          <div class="field"><span class="field-label">مذهب</span><span class="field-value">${a.religion||""}</span></div>
          <div class="field"><span class="field-label">زبان</span><span class="field-value">${a.language||""}</span></div>
          <div class="field"><span class="field-label">آخرین مدرک تحصیلی</span><span class="field-value">${a.education_level||""}</span></div>
          <div class="field"><span class="field-label">محل تحصیل</span><span class="field-value">${a.education_place||""}</span></div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">وضعیت نظام وظیفه</div>
        <div class="fields">
          <div class="field">
            <span class="field-label">انجام خدمت</span>
            <div class="radio-group">
              <span class="radio-item"><span class="radio-dot ${a.military_done==="بله"?"checked":""}"></span> بله</span>
              <span class="radio-item"><span class="radio-dot ${a.military_done==="خیر"?"checked":""}"></span> خیر</span>
            </div>
          </div>
          <div class="field"><span class="field-label">رسته خدمت</span><span class="field-value">${a.military_service_type||""}</span></div>
          <div class="field"><span class="field-label">معافیت غیر پزشکی</span><span class="field-value">${a.military_exempt_non_medical||""}</span></div>
          <div class="field"><span class="field-label">معافیت پزشکی</span><span class="field-value">${a.military_exempt_medical||""}</span></div>
          <div class="field field-full"><span class="field-label">علت معافیت</span><span class="field-value">${a.military_exempt_reason||""}</span></div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">وضعیت خانوادگی و مالی</div>
        <div class="fields">
          <div class="field"><span class="field-label">وضعیت تأهل</span><span class="field-value">${a.marital_status||""}</span></div>
          <div class="field"><span class="field-label">تعداد فرزندان</span><span class="field-value">${a.children_count||"0"}</span></div>
          <div class="field"><span class="field-label">شغل همسر</span><span class="field-value">${a.spouse_job||""}</span></div>
          <div class="field field-full"><span class="field-label">میزان حقوق درخواستی (ریال)</span><span class="field-value">${Number(a.requested_salary||0).toLocaleString()}</span></div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">وضعیت مسکن</div>
        <div class="fields">
          <div class="field"><span class="field-label">وضعیت مسکن</span><span class="field-value">${a.housing_status||""}</span></div>
          <div class="field"><span class="field-label">میزان اجاره (ریال)</span><span class="field-value">${Number(a.housing_rent_amount||0).toLocaleString()}</span></div>
          <div class="field"><span class="field-label">شماره تلفن تماس</span><span class="field-value">${a.phone_number||""}</span></div>
          <div class="field field-span3"><span class="field-label">نشانی محل سکونت</span><span class="field-value">${a.residential_address||""}</span></div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">سایر اطلاعات</div>
        <div class="fields">
          <div class="field field-span3"><span class="field-label">ویژگی‌های اخلاقی (۳ مورد)</span><div class="textarea-box">${a.moral_traits||""}</div></div>
          <div class="field">
            <span class="field-label">اقوام در شرکت</span>
            <div class="radio-group">
              <span class="radio-item"><span class="radio-dot ${a.relatives_in_company==="بله"?"checked":""}"></span> بله</span>
              <span class="radio-item"><span class="radio-dot ${a.relatives_in_company==="خیر"?"checked":""}"></span> خیر</span>
            </div>
          </div>
          <div class="field field-full"><span class="field-label">نام و نوع نسبت</span><span class="field-value">${a.relatives_details||""}</span></div>
          <div class="field">
            <span class="field-label">محکومیت کیفری/حقوقی</span>
            <div class="radio-group">
              <span class="radio-item"><span class="radio-dot ${a.criminal_record==="بله"?"checked":""}"></span> بله</span>
              <span class="radio-item"><span class="radio-dot ${a.criminal_record==="خیر"?"checked":""}"></span> خیر</span>
            </div>
          </div>
          <div class="field field-full"><span class="field-label">سابقه اشتغال در کارخانجات کاوه</span><span class="field-value">${a.kave_factories||""}</span></div>
          <div class="field">
            <span class="field-label">استعمال دخانیات</span>
            <div class="radio-group">
              <span class="radio-item"><span class="radio-dot ${a.smoking==="بله"?"checked":""}"></span> بله</span>
              <span class="radio-item"><span class="radio-dot ${a.smoking==="خیر"?"checked":""}"></span> خیر</span>
            </div>
          </div>
          <div class="field field-full"><span class="field-label">مدت زمان استعمال</span><span class="field-value">${a.smoking_duration||""}</span></div>
        </div>
      </div>
      
      ${a.work_history&&a.work_history.length>0?`
      <div class="section">
        <div class="section-title">سوابق کاری</div>
        <table class="work-table">
          <thead>
            <tr>
              <th>ردیف</th>
              <th>نام سازمان و نوع فعالیت</th>
              <th>آخرین سمت</th>
              <th>مدت شغل</th>
              <th>آخرین حقوق</th>
              <th>علت ترک</th>
              <th>نشانی و تلفن</th>
            </tr>
          </thead>
          <tbody>
            ${a.work_history.map((e,l)=>`
              <tr>
                <td>${l+1}</td>
                <td>${e.org_name||""}</td>
                <td>${e.position||""}</td>
                <td>${e.duration||""}</td>
                <td>${e.last_salary?Number(e.last_salary).toLocaleString():""}</td>
                <td>${e.leave_reason||""}</td>
                <td>${e.contact_info||""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      `:""}
      
      <div class="section">
        <div class="fields">
          <div class="field field-span3">
            <span class="field-label">زبان‌های خارجی</span>
            <div class="textarea-box">${a.foreign_languages||""}</div>
          </div>
          <div class="field">
            <span class="field-label">زبان ترکی</span>
            <div class="radio-group">
              <span class="radio-item"><span class="radio-dot ${a.turkish_known==="بله"?"checked":""}"></span> بله</span>
              <span class="radio-item"><span class="radio-dot ${a.turkish_known==="خیر"?"checked":""}"></span> خیر</span>
            </div>
          </div>
          <div class="field field-span3">
            <span class="field-label">نرم‌افزارهای کامپیوتری</span>
            <div class="textarea-box">${a.computer_skills||""}</div>
          </div>
          <div class="field field-span3">
            <span class="field-label">دوره‌های آموزشی</span>
            <div class="textarea-box">${a.training_courses||""}</div>
          </div>
          <div class="field field-span3">
            <span class="field-label">معرف‌ها</span>
            <div class="textarea-box">${a.references_info||""}</div>
          </div>
        </div>
      </div>
      
      <div class="signature-area">
        <div class="signature-box">
          <div class="signature-line">امضاء متقاضی</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">امضاء مدیریت</div>
        </div>
      </div>
      
      <div class="footer">چاپ شده در ${new Date().toLocaleString("fa-IR")} | سیستم اتوماسیون اداری اروم شیشه ساچی</div>
    </body>
    </html>
  `,i=window.open("","_blank");i.document.write(s),i.document.close(),setTimeout(()=>i.print(),500)}export{p as a,b,f as c,v as d,g as e,u as f,m as p};
