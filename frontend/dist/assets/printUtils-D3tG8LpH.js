import{m as b}from"./index-Bq76YnX_.js";function e(a){return a?String(a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}function r(){return b().format("jYYYY/jMM/jDD - HH:mm")}function g(a){return a?b(a).format("jYYYY/jMM/jDD"):b().format("jYYYY/jMM/jDD")}function m(a,t,l,s={}){const{companyName:n="شرکت اروم شیشه ساچی",orientation:d="landscape"}=s,c=`
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
          @page { size: ${d}; margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company">${n}</div>
        <div class="title">${e(a)}</div>
        <div class="date">تاریخ چاپ: ${r()}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            ${t.map(i=>`<th>${e(i.label)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${l.map((i,p)=>`
            <tr>
              <td>${p+1}</td>
              ${t.map(f=>`<td>${f.render?f.render(i[f.key],i):e(i[f.key])||"-"}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="footer">چاپ شده در ${r()} | سیستم اتوماسیون اداری</div>
    </body>
    </html>
  `,o=window.open("","_blank");o.document.write(c),o.document.close(),setTimeout(()=>o.print(),500)}function u(a,t,l={}){m(a,[{key:"user_name",label:"کاربر"},{key:"item_name",label:"کالا"},{key:"quantity",label:"تعداد",render:(n,d)=>`${n} ${d.item_unit||""}`},{key:"delivery_date",label:"تاریخ تحویل"},{key:"status",label:"وضعیت",render:n=>({pending_user:"در انتظار تایید",confirmed:"تایید شده",rejected:"رد شده"})[n]||n}],t,l)}function x(a,t=[]){var n;const l=`
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
        <div class="meta-item"><span class="meta-label">شماره:</span><span class="meta-value">${e(a.letter_number)||"-"}</span></div>
        <div class="meta-item"><span class="meta-label">تاریخ ثبت:</span><span class="meta-value">${((n=a.created_at)==null?void 0:n.split("T")[0])||"-"}</span></div>
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
        <div class="meta-item"><span class="meta-label">فرستنده:</span><span class="meta-value">${e(a.sender_name)||"-"} (${e(a.sender_unit_name)||"-"})</span></div>
        ${a.manager_name?`<div class="meta-item"><span class="meta-label">مدیر بررسی‌کننده:</span><span class="meta-value">${e(a.manager_name)}</span></div>`:""}
      </div>
      
      <div class="subject">موضوع: ${e(a.subject)||"-"}</div>
      
      ${a.body?`<div class="body">${e(a.body)}</div>`:""}
      
      ${a.attachment_name?`<div class="attachment">فایل پیوست: ${e(a.attachment_name)}</div>`:""}
      
      ${a.manager_comment?`<div style="margin-bottom: 15px; padding: 10px; background: #eff6ff; border-radius: 8px; font-size: 12px;"><strong>نظر مدیر:</strong> ${e(a.manager_comment)}</div>`:""}
      
      ${t.length>0?`
        <div class="history">
          <div class="history-title">روند چرخش نامه</div>
          ${t.map((d,c)=>{var o;return`
            <div class="history-item">
              <span class="history-badge" style="background:${{created:"#3b82f6",sent_to_manager:"#eab308",approved:"#22c55e",rejected:"#ef4444",archived:"#8b5cf6",forwarded:"#6366f1",seen_unit:"#6b7280"}[d.action]||"#6b7280"}">${{created:"ثبت",sent_to_manager:"ارسال به مدیر",approved:"تایید",rejected:"رد",archived:"بایگانی",forwarded:"ارجاع",seen_unit:"رویت واحد"}[d.action]||d.action}</span>
              <span>${e(d.user_name)}</span>
              <span style="color:#9ca3af">${((o=d.created_at)==null?void 0:o.replace("T"," ").substring(0,16))||""}</span>
              ${d.comment?`<span style="color:#6b7280">- ${e(d.comment)}</span>`:""}
            </div>
          `}).join("")}
        </div>
      `:""}
      
      <div class="footer">چاپ شده در ${r()} | سیستم اتوماسیون اداری اروم شیشه ساچی</div>
    </body>
    </html>
  `,s=window.open("","_blank");s.document.write(l),s.document.close(),setTimeout(()=>s.print(),500)}function h(a,t={}){m("همه درخواست‌های مرخصی",[{key:"user_name",label:"نام"},{key:"user_dept",label:"واحد"},{key:"leave_type",label:"نوع"},{key:"start_date",label:"از تاریخ"},{key:"end_date",label:"تا تاریخ"},{key:"days_count",label:"روزها"},{key:"status",label:"وضعیت",render:s=>({pending_supervisor:"در انتظار سرپرست",pending_manager:"در انتظار مدیر",approved:"تایید شده",rejected:"رد شده",seen_security:"رویت شده (حراست)"})[s]||s}],a,t)}function y(a,t={}){m("لیست رزروهای رستوران",[{key:"user_name",label:"نام"},{key:"food_name",label:"غذا"},{key:"option_number",label:"گزینه",render:s=>`گزینه ${s}`},{key:"food_date",label:"تاریخ"},{key:"quantity",label:"تعداد"},{key:"status",label:"وضعیت",render:s=>s==="active"?"فعال":"لغو شده"}],a,t)}function $(a,t={}){m("خلاصه مانیتورینگ رستوران",[{key:"food_date",label:"تاریخ"},{key:"total_meals",label:"کل وعده‌ها"}],a,t)}function _(a,t={}){const{companyName:l="شرکت اروم شیشه ساچی"}=t,s=typeof a.items=="string"?JSON.parse(a.items):a.items||[],n={pending_supervisor:"در انتظار تایید سرپرست",pending_manager:"در انتظار تایید مدیر",approved:"تایید شده",rejected:"رد شده"},d={urgent:"فوری",normal:"عادی"},c=`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>چاپ درخواست خرید</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap');
        * { font-family: 'Vazirmatn', sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
        body { padding: 25px; font-size: 12px; }

        .header { text-align: center; border-bottom: 3px double #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
        .company { font-size: 16px; color: #1e40af; font-weight: 800; }
        .title { font-size: 18px; font-weight: 800; margin-top: 8px; color: #111827; }
        .date { font-size: 10px; color: #6b7280; margin-top: 5px; }

        .meta { display: flex; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
        .meta-item { display: flex; gap: 5px; font-size: 12px; }
        .meta-label { font-weight: 600; color: #374151; }
        .meta-value { color: #6b7280; }

        .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-yellow { background: #fef3c7; color: #92400e; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        .badge-blue { background: #dbeafe; color: #1e40af; }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #1e40af; color: white; padding: 10px 12px; font-size: 11px; font-weight: 600; text-align: right; }
        td { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; font-size: 11px; text-align: right; }
        tr:nth-child(even) { background: #f9fafb; }
        tr:hover { background: #f3f4f6; }

        .reason { margin-top: 15px; padding: 10px; background: #f9fafb; border-radius: 8px; font-size: 12px; border: 1px solid #e5e7eb; }
        .reason strong { color: #374151; }

        .footer { margin-top: 25px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }

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
        <div class="company">${l}</div>
        <div class="title">درخواست خرید کالا</div>
        <div class="date">تاریخ چاپ: ${r()}</div>
      </div>

      <div class="meta">
        <div class="meta-item">
          <span class="meta-label">شماره درخواست:</span>
          <span class="meta-value">${e(a.request_number)||"-"}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">تاریخ ثبت:</span>
          <span class="meta-value">${g(a.created_at)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">درخواست‌دهنده:</span>
          <span class="meta-value">${e(a.user_name)||"-"}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">فوریت:</span>
          <span class="meta-value" style="${a.urgency==="urgent"?"color:#dc2626;font-weight:700;":""}">${d[a.urgency]||a.urgency}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">وضعیت:</span>
          <span class="badge ${a.status==="approved"?"badge-green":a.status==="rejected"?"badge-red":a.status==="pending_manager"?"badge-yellow":"badge-blue"}">${n[a.status]||a.status}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>نام کالا</th>
            <th>مشخصات فنی</th>
            <th>تعداد</th>
            <th>واحد</th>
            <th>قیمت تقریبی (ریال)</th>
            <th>جمع جزئی (ریال)</th>
          </tr>
        </thead>
        <tbody>
          ${s.map((i,p)=>`
            <tr>
              <td>${p+1}</td>
              <td>${e(i.name)||"-"}</td>
              <td>${e(i.specification)||"-"}</td>
              <td>${i.quantity||"-"}</td>
              <td>${i.unit||"-"}</td>
              <td>${i.estimated_price?Number(i.estimated_price).toLocaleString():"-"}</td>
              <td>${i.estimated_price&&i.quantity?(Number(i.estimated_price)*Number(i.quantity)).toLocaleString():"-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      ${s.some(i=>i.estimated_price)?`
      <div class="reason">
        <strong>جمع کل برآورد:</strong>
        ${s.reduce((i,p)=>i+Number(p.estimated_price||0)*Number(p.quantity||1),0).toLocaleString()} ریال
      </div>
      `:""}

      ${a.reason?`
      <div class="reason">
        <strong>دلیل خرید:</strong> ${e(a.reason)}
      </div>
      `:""}

      ${a.supervisor_comment?`
      <div class="reason">
        <strong>نظر سرپرست:</strong> ${e(a.supervisor_comment)}
      </div>
      `:""}

      ${a.manager_comment?`
      <div class="reason">
        <strong>نظر مدیر:</strong> ${e(a.manager_comment)}
      </div>
      `:""}

      <div class="signature-area">
        <div class="signature-box">
          <div class="signature-line">امضاء درخواست‌دهنده</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">امضاء سرپرست</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">امضاء مدیر</div>
        </div>
      </div>

      <div class="footer">چاپ شده در ${r()} | سیستم اتوماسیون اداری ${l}</div>
    </body>
    </html>
  `,o=window.open("","_blank");o.document.write(c),o.document.close(),setTimeout(()=>o.print(),500)}function k(a){const t=`
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
              ${a.application_number?`<span style="margin-left:15px;"><strong>شماره:</strong> ${e(a.application_number)}</span>`:""}
              <span><strong>تاریخ ثبت:</strong> ${g(a.created_at)}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">اطلاعات شخصی</div>
        <div class="fields">
          <div class="field"><span class="field-label">نام و نام خانوادگی</span><span class="field-value">${e(a.full_name)||""}</span></div>
          <div class="field"><span class="field-label">نام پدر</span><span class="field-value">${e(a.father_name)||""}</span></div>
          <div class="field"><span class="field-label">شماره شناسنامه</span><span class="field-value">${e(a.national_id)||""}</span></div>
          <div class="field"><span class="field-label">صادره از</span><span class="field-value">${e(a.national_id_issued_from)||""}</span></div>
          <div class="field"><span class="field-label">تاریخ تولد</span><span class="field-value">${e(a.birth_date)||""}</span></div>
          <div class="field"><span class="field-label">محل تولد</span><span class="field-value">${e(a.birth_place)||""}</span></div>
          <div class="field"><span class="field-label">مدت اقامت</span><span class="field-value">${e(a.residence_duration)||""}</span></div>
          <div class="field"><span class="field-label">ملیت</span><span class="field-value">${e(a.nationality)||""}</span></div>
          <div class="field"><span class="field-label">مذهب</span><span class="field-value">${e(a.religion)||""}</span></div>
          <div class="field"><span class="field-label">زبان</span><span class="field-value">${e(a.language)||""}</span></div>
          <div class="field"><span class="field-label">آخرین مدرک تحصیلی</span><span class="field-value">${e(a.education_level)||""}</span></div>
          <div class="field"><span class="field-label">محل تحصیل</span><span class="field-value">${e(a.education_place)||""}</span></div>
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
          <div class="field"><span class="field-label">رسته خدمت</span><span class="field-value">${e(a.military_service_type)||""}</span></div>
          <div class="field"><span class="field-label">معافیت غیر پزشکی</span><span class="field-value">${e(a.military_exempt_non_medical)||""}</span></div>
          <div class="field"><span class="field-label">معافیت پزشکی</span><span class="field-value">${e(a.military_exempt_medical)||""}</span></div>
          <div class="field field-full"><span class="field-label">علت معافیت</span><span class="field-value">${e(a.military_exempt_reason)||""}</span></div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">وضعیت خانوادگی و مالی</div>
        <div class="fields">
          <div class="field"><span class="field-label">وضعیت تأهل</span><span class="field-value">${e(a.marital_status)||""}</span></div>
          <div class="field"><span class="field-label">تعداد فرزندان</span><span class="field-value">${a.children_count||"0"}</span></div>
          <div class="field"><span class="field-label">شغل همسر</span><span class="field-value">${e(a.spouse_job)||""}</span></div>
          <div class="field field-full"><span class="field-label">میزان حقوق درخواستی (ریال)</span><span class="field-value">${Number(a.requested_salary||0).toLocaleString()}</span></div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">وضعیت مسکن</div>
        <div class="fields">
          <div class="field"><span class="field-label">وضعیت مسکن</span><span class="field-value">${e(a.housing_status)||""}</span></div>
          <div class="field"><span class="field-label">میزان اجاره (ریال)</span><span class="field-value">${Number(a.housing_rent_amount||0).toLocaleString()}</span></div>
          <div class="field"><span class="field-label">شماره تلفن تماس</span><span class="field-value">${e(a.phone_number)||""}</span></div>
          <div class="field field-span3"><span class="field-label">نشانی محل سکونت</span><span class="field-value">${e(a.residential_address)||""}</span></div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">سایر اطلاعات</div>
        <div class="fields">
          <div class="field field-span3"><span class="field-label">ویژگی‌های اخلاقی (۳ مورد)</span><div class="textarea-box">${e(a.moral_traits)||""}</div></div>
          <div class="field">
            <span class="field-label">اقوام در شرکت</span>
            <div class="radio-group">
              <span class="radio-item"><span class="radio-dot ${a.relatives_in_company==="بله"?"checked":""}"></span> بله</span>
              <span class="radio-item"><span class="radio-dot ${a.relatives_in_company==="خیر"?"checked":""}"></span> خیر</span>
            </div>
          </div>
          <div class="field field-full"><span class="field-label">نام و نوع نسبت</span><span class="field-value">${e(a.relatives_details)||""}</span></div>
          <div class="field">
            <span class="field-label">محکومیت کیفری/حقوقی</span>
            <div class="radio-group">
              <span class="radio-item"><span class="radio-dot ${a.criminal_record==="بله"?"checked":""}"></span> بله</span>
              <span class="radio-item"><span class="radio-dot ${a.criminal_record==="خیر"?"checked":""}"></span> خیر</span>
            </div>
          </div>
          <div class="field field-full"><span class="field-label">سابقه اشتغال در کارخانجات کاوه</span><span class="field-value">${e(a.kave_factories)||""}</span></div>
          <div class="field">
            <span class="field-label">استعمال دخانیات</span>
            <div class="radio-group">
              <span class="radio-item"><span class="radio-dot ${a.smoking==="بله"?"checked":""}"></span> بله</span>
              <span class="radio-item"><span class="radio-dot ${a.smoking==="خیر"?"checked":""}"></span> خیر</span>
            </div>
          </div>
          <div class="field field-full"><span class="field-label">مدت زمان استعمال</span><span class="field-value">${e(a.smoking_duration)||""}</span></div>
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
            ${a.work_history.map((s,n)=>`
              <tr>
                <td>${n+1}</td>
                <td>${e(s.org_name)||""}</td>
                <td>${e(s.position)||""}</td>
                <td>${e(s.duration)||""}</td>
                <td>${s.last_salary?Number(s.last_salary).toLocaleString():""}</td>
                <td>${e(s.leave_reason)||""}</td>
                <td>${e(s.contact_info)||""}</td>
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
            <div class="textarea-box">${e(a.foreign_languages)||""}</div>
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
            <div class="textarea-box">${e(a.computer_skills)||""}</div>
          </div>
          <div class="field field-span3">
            <span class="field-label">دوره‌های آموزشی</span>
            <div class="textarea-box">${e(a.training_courses)||""}</div>
          </div>
          <div class="field field-span3">
            <span class="field-label">معرف‌ها</span>
            <div class="textarea-box">${e(a.references_info)||""}</div>
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
      
      <div class="footer">چاپ شده در ${r()} | سیستم اتوماسیون اداری اروم شیشه ساچی</div>
    </body>
    </html>
  `,l=window.open("","_blank");l.document.write(t),l.document.close(),setTimeout(()=>l.print(),500)}export{m as a,x as b,u as c,y as d,$ as e,k as f,_ as g,h as p};
