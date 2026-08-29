/* =========================================================================
   FLOWS — hoàn thiện toàn bộ luồng nghiệp vụ của bản demo
   (xuất Excel, tệp y khoa, CRUD khách hàng, import nhân sự, phân bổ lead,
    phân quyền, cấu hình, drill-down báo cáo, phiếu thu…)
   ========================================================================= */

/* ---------- XUẤT FILE (CSV mở được bằng Excel) ---------- */
function csvCell(v){ v=(v===null||v===undefined)?'':String(v); return /[";\n\r]/.test(v)? '"'+v.replace(/"/g,'""')+'"' : v; }
function downloadCSV(filename, header, rows){
  const csv='﻿'+[header.map(csvCell).join(';'), ...rows.map(r=>r.map(csvCell).join(';'))].join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 400);
}
/* cfg = {title, filename, columns:[{k,lb,on}], rows:[obj], note} */
let _exportCfg=null;
function openExport(cfg){
  _exportCfg=cfg;
  modal(`<div class="modal wide"><div class="modal-h"><h3>${ic('download',18)} ${esc(cfg.title)}</h3><button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="alert al-info">${ic('info',16)}<div>Tệp xuất ra định dạng <b>CSV (dấu ;)</b> — mở trực tiếp bằng Excel, giữ nguyên tiếng Việt có dấu.
      ${cfg.note?'<br>'+cfg.note:''}</div></div>
    <div class="grid g2">
      <label class="fld"><span class="lb">Phạm vi dữ liệu</span><select class="inp" id="ex-scope">
        <option value="filtered">Theo bộ lọc hiện tại (${cfg.rows.length} dòng)</option>
        <option value="all">Toàn bộ dữ liệu tôi được phép xem</option></select></label>
      <label class="fld"><span class="lb">Tên tệp</span><input class="inp" id="ex-name" value="${esc(cfg.filename)}"></label>
    </div>
    <div class="sec-t">Chọn cột cần xuất</div>
    <div class="grid g3" style="gap:6px">
      ${cfg.columns.map((c,i)=>`<label style="display:flex;gap:8px;align-items:center;padding:7px 10px;border:1px solid var(--line);border-radius:9px;cursor:pointer">
        <input type="checkbox" class="ex-col" value="${i}" ${c.on===false?'':'checked'}><span style="font-size:13px">${esc(c.lb)}</span></label>`).join('')}
    </div>
    <div class="divider"></div>
    <div class="sec-t">Xem trước 5 dòng đầu</div>
    <div class="tbl-wrap" style="border:1px solid var(--line);border-radius:10px">
      <table style="min-width:auto"><thead><tr>${cfg.columns.map(c=>`<th>${esc(c.lb)}</th>`).join('')}</tr></thead>
      <tbody>${cfg.rows.slice(0,5).map(r=>`<tr>${cfg.columns.map(c=>`<td class="t-sub">${esc(r[c.k]??'')}</td>`).join('')}</tr>`).join('')||'<tr><td class="t-sub">Không có dữ liệu</td></tr>'}</tbody></table>
    </div>
    <div class="alert al-warn" style="margin-top:14px">${ic('shield',16)}<div>Bản xuất chứa thông tin cá nhân. Hành động này được ghi vào <b>nhật ký kiểm toán</b> kèm tên người xuất và số dòng.</div></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" onclick="doExport()">${ic('download',16)} Tải tệp ${cfg.rows.length} dòng</button></div></div>`);
}
function doExport(){
  const cfg=_exportCfg; if(!cfg) return;
  const idx=[...document.querySelectorAll('.ex-col:checked')].map(x=>+x.value);
  if(!idx.length) return toast('Chọn ít nhất một cột để xuất','err');
  const cols=idx.map(i=>cfg.columns[i]);
  const name=($('#ex-name').value||cfg.filename).replace(/\.csv$/i,'')+'.csv';
  downloadCSV(name, cols.map(c=>c.lb), cfg.rows.map(r=>cols.map(c=>r[c.k]??'')));
  au(new Date(), S.user.id, 'export', cfg.entity||'data', name, '—', cfg.rows.length+' dòng · '+cols.length+' cột');
  DB.audit.sort((a,b)=>b.at-a.at);
  closeModal(); toast('Đã tải '+name+' ('+cfg.rows.length+' dòng)','ok');
}
const lifecycleLb={lead:'Lead',customer:'Khách hàng',patient:'Bệnh nhân'};

function exportCustomers(list){
  openExport({title:'Xuất danh sách khách hàng', filename:'khach-hang_'+fmtD(TODAY).replace(/\//g,'-'), entity:'customers',
    columns:[{k:'code',lb:'Mã KH'},{k:'name',lb:'Họ tên'},{k:'phone',lb:'Điện thoại'},{k:'gender',lb:'Giới tính'},
      {k:'dob',lb:'Ngày sinh'},{k:'address',lb:'Địa chỉ'},{k:'job',lb:'Nghề nghiệp',on:false},{k:'source',lb:'Nguồn'},
      {k:'campaign',lb:'Chiến dịch'},{k:'need',lb:'Nhu cầu'},{k:'concern',lb:'Bệnh lý'},{k:'status',lb:'Trạng thái'},
      {k:'lifecycle',lb:'Vòng đời'},{k:'owner',lb:'Phụ trách'},{k:'created',lb:'Ngày tạo'}],
    rows:list.map(c=>({code:c.code,name:c.name,phone:fmtPhone(c.phone),gender:c.gender==='M'?'Nam':'Nữ',dob:fmtD(c.dob),
      address:c.address,job:c.job,source:srcName(c.source),campaign:(DB.campaigns.find(x=>x.id===c.campaign)||{name:''}).name,
      need:c.need,concern:c.concern,status:stLabel(c.status),lifecycle:lifecycleLb[c.lifecycle],
      owner:c.assigned_to?userName(c.assigned_to):'',created:fmtD(c.created_at)}))});
}
function exportCallList(list){
  openExport({title:'Xuất danh sách gọi', filename:'danh-sach-goi_'+fmtD(TODAY).replace(/\//g,'-'), entity:'leads',
    columns:[{k:'name',lb:'Họ tên'},{k:'phone',lb:'Điện thoại'},{k:'source',lb:'Nguồn'},{k:'campaign',lb:'Chiến dịch'},
      {k:'need',lb:'Nhu cầu'},{k:'concern',lb:'Bệnh lý'},{k:'status',lb:'Tình trạng'},{k:'calls',lb:'Số cuộc gọi'},
      {k:'last',lb:'Lần gọi cuối'},{k:'next',lb:'Lịch gọi lại'},{k:'owner',lb:'Phụ trách'}],
    rows:list.map(c=>({name:c.name,phone:fmtPhone(c.phone),source:srcName(c.source),
      campaign:(DB.campaigns.find(x=>x.id===c.campaign)||{name:''}).name,need:c.need,concern:c.concern,
      status:stLabel(c.status),calls:c.call_count,last:c.last_call?fmtDT(c.last_call):'',next:c.next_call?fmtDT(c.next_call):'',
      owner:c.assigned_to?userName(c.assigned_to):''}))});
}
function exportPayments(list){
  openExport({title:'Xuất sổ quỹ', filename:'so-quy_'+fmtD(TODAY).replace(/\//g,'-'), entity:'payments',
    note:'Chỉ gồm giao dịch đã ghi nhận; bút toán điều chỉnh hiển thị số âm.',
    columns:[{k:'at',lb:'Thời gian'},{k:'ref',lb:'Mã GD'},{k:'cust',lb:'Khách hàng'},{k:'phone',lb:'Điện thoại'},
      {k:'course',lb:'Mã liệu trình'},{k:'amount',lb:'Số tiền'},{k:'method',lb:'Hình thức'},{k:'by',lb:'Người thu'},{k:'note',lb:'Ghi chú'}],
    rows:list.map(p=>({at:fmtDT(p.at),ref:p.ref,cust:custById(p.customer_id).name,phone:fmtPhone(custById(p.customer_id).phone),
      course:(courseById(p.course_id)||{code:''}).code,amount:p.amount,method:(PAY_METHODS.find(m=>m.code===p.method)||{label:''}).label,
      by:userName(p.by),note:p.note}))});
}
function exportCourse(co){
  const ss=courseSessions(co.id), c=custById(co.customer_id);
  openExport({title:'Xuất bảng theo dõi liệu trình '+co.code, filename:'lieu-trinh_'+co.code, entity:'treatment_courses',
    columns:[{k:'no',lb:'Buổi'},{k:'date',lb:'Ngày'},{k:'status',lb:'Trạng thái'},{k:'tech',lb:'KTV'},{k:'services',lb:'Dịch vụ'},
      {k:'before',lb:'Trước buổi'},{k:'after',lb:'Sau buổi'},...co.metrics.map(m=>({k:m,lb:metricById(m).name}))],
    rows:ss.map(s=>{ const r={no:s.no,date:s.at?fmtD(s.at):'',status:SESS_ST[s.status].label,tech:s.tech_id?userName(s.tech_id):'',
      services:s.services.join(', '),before:s.before,after:s.after};
      co.metrics.forEach(m=>{ const v=DB.metricValues.find(v=>v.session_id===s.id&&v.metric_id===m); r[m]=v?v.value:''; });
      return r; })});
}
function exportCare(tasks){
  openExport({title:'Xuất danh sách chăm sóc', filename:'cham-soc_'+fmtD(TODAY).replace(/\//g,'-'), entity:'treatment_courses',
    columns:[{k:'name',lb:'Khách hàng'},{k:'phone',lb:'Điện thoại'},{k:'course',lb:'Liệu trình'},{k:'progress',lb:'Tiến độ'},
      {k:'last',lb:'Buổi gần nhất'},{k:'next',lb:'Lịch tiếp theo'},{k:'reason',lb:'Lý do'},{k:'op',lb:'OP phụ trách'}],
    rows:tasks.map(t=>{const co=courseById(t.course_id),c=custById(t.customer_id);
      return {name:c.name,phone:fmtPhone(c.phone),course:pkgById(co.package_id).name,
        progress:co.done_sessions+'/'+co.total_sessions,last:t.last?fmtD(t.last):'',next:t.next?fmtDT(t.next):'Chưa đặt',
        reason:CARE_REASON[t.reason].label,op:userName(t.op)};})});
}
function exportUsers(){
  openExport({title:'Xuất danh sách người dùng', filename:'nhan-su_'+fmtD(TODAY).replace(/\//g,'-'), entity:'users',
    columns:[{k:'name',lb:'Họ tên'},{k:'email',lb:'Email'},{k:'roles',lb:'Vai trò'},{k:'branch',lb:'Cơ sở'},
      {k:'spec',lb:'Chuyên môn'},{k:'leads',lb:'Số lead đang giữ'},{k:'active',lb:'Trạng thái'}],
    rows:DB.users.map(u=>({name:u.name,email:u.email,roles:u.roles.map(roleName).join(', '),
      branch:(DB.branches.find(b=>b.id===u.branch)||{name:''}).name,spec:u.spec||'',
      leads:DB.customers.filter(c=>c.assigned_to===u.id).length,active:u.active?'Hoạt động':'Khóa'}))});
}
function exportAudit(list){
  openExport({title:'Xuất nhật ký hệ thống', filename:'audit-log_'+fmtD(TODAY).replace(/\//g,'-'), entity:'audit_logs',
    columns:[{k:'at',lb:'Thời gian'},{k:'user',lb:'Người thực hiện'},{k:'action',lb:'Hành động'},{k:'entity',lb:'Bảng'},
      {k:'eid',lb:'Bản ghi'},{k:'before',lb:'Trước'},{k:'after',lb:'Sau'},{k:'ip',lb:'IP'}],
    rows:list.map(a=>({at:fmtDT(a.at),user:userName(a.user),action:a.action,entity:a.entity,eid:a.entity_id,
      before:a.before,after:a.after,ip:a.ip}))});
}
function exportMarketing(rows){
  openExport({title:'Xuất báo cáo marketing', filename:'hieu-qua-marketing_'+fmtD(TODAY).replace(/\//g,'-'), entity:'campaigns',
    columns:[{k:'name',lb:'Chiến dịch'},{k:'source',lb:'Nguồn'},{k:'spend',lb:'Chi phí'},{k:'leads',lb:'Lead'},
      {k:'booked',lb:'Lịch hẹn'},{k:'arrived',lb:'Đến khám'},{k:'pkg',lb:'Chốt gói'},{k:'cpl',lb:'CPL'},
      {k:'rev',lb:'Doanh thu'},{k:'roas',lb:'ROAS'}],
    rows:rows.map(r=>({name:r.cp.name,source:srcName(r.cp.source),spend:r.cp.spend,leads:r.leads,booked:r.booked,
      arrived:r.arrived,pkg:r.pkg,cpl:r.cpl,rev:r.rev,roas:r.roas?r.roas.toFixed(2):''}))});
}
function exportReport(kind){
  if(kind==='telesales'){
    openExport({title:'Xuất hiệu quả Telesales', filename:'hieu-qua-telesales', entity:'users',
      columns:[{k:'name',lb:'Nhân viên'},{k:'leads',lb:'Lead'},{k:'calls',lb:'Cuộc gọi'},{k:'booked',lb:'Đặt lịch'},
        {k:'arrived',lb:'Đến khám'},{k:'pkg',lb:'Chốt gói'},{k:'rev',lb:'Doanh thu'}],
      rows:TELESALES.map(u=>{ const leads=DB.customers.filter(c=>c.assigned_to===u.id);
        const arrived=leads.filter(c=>['ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','PACKAGE_PENDING'].includes(c.status));
        const pkgs=DB.courses.filter(co=>co.status!=='pending'&&leads.some(l=>l.id===co.customer_id));
        return {name:u.name,leads:leads.length,calls:DB.calls.filter(c=>c.user_id===u.id).length,
          booked:leads.filter(c=>['APPOINTMENT_BOOKED','ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','PACKAGE_PENDING','NO_SHOW'].includes(c.status)).length,
          arrived:arrived.length,pkg:pkgs.length,rev:pkgs.reduce((a,b)=>a+b.paid,0)};})});
  } else if(kind==='marketing'){
    const rows=window._mkRows||[]; if(rows.length) exportMarketing(rows); else toast('Mở tab Hiệu quả Marketing trước khi xuất','warn');
  } else exportPayments(DB.payments);
}

/* ---------- TỆP Y KHOA ---------- */
function openFileUpload(cid, encId){
  modal(`<div class="modal"><div class="modal-h"><h3>Tải tệp y khoa lên</h3><button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="dropzone" id="fu-dz" onclick="fuPick()">
      <div class="ic-box">${ic('upload',24)}</div>
      <div style="font-weight:700;font-size:15px;margin-bottom:4px">Kéo thả tệp vào đây hoặc bấm để chọn</div>
      <div class="t-sub">PDF, JPG, PNG · tối đa 25 MB mỗi tệp</div>
    </div>
    <div id="fu-list" style="margin-top:12px"></div>
    <div class="grid g2" style="margin-top:6px">
      <label class="fld"><span class="lb">Loại tệp <span class="req">*</span></span>
        <select class="inp" id="fu-kind">${FILE_KINDS.map(k=>`<option>${k}</option>`).join('')}</select></label>
      <label class="fld"><span class="lb">Ngày thực hiện</span><input class="inp" type="date" id="fu-date" value="${new Date(TODAY.getTime()-TODAY.getTimezoneOffset()*60000).toISOString().slice(0,10)}"></label>
    </div>
    <label class="fld"><span class="lb">Mô tả / kết luận</span><textarea class="inp" id="fu-note" rows="2" placeholder="VD: MRI cột sống thắt lưng — thoát vị L4-L5 chèn ép rễ trái"></textarea></label>
    <div class="alert al-warn">${ic('lock',16)}<div>Tệp lưu ở <b>private storage</b>, không có URL công khai. Mỗi lần xem hệ thống cấp <b>signed URL hết hạn sau 5 phút</b> và ghi lại người truy cập.</div></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" id="fu-save" onclick="fuSave('${cid}','${encId||''}')" aria-disabled="true">Lưu tệp</button></div></div>`);
  window._fuFiles=[];
}
function fuPick(){
  const names=[['MRI_cot_song_that_lung.pdf','3.8 MB'],['Xquang_khop_goi_thang_nghieng.jpg','2.1 MB'],
    ['Sieu_am_phan_mem_vai_phai.pdf','1.2 MB'],['Ket_qua_xet_nghiem_mau.pdf','340 KB'],['CT_cot_song_co.pdf','5.6 MB']];
  const f=names[(window._fuFiles||[]).length % names.length];
  window._fuFiles=(window._fuFiles||[]).concat([{name:f[0],size:f[1],pct:0}]);
  fuRender(); fuProgress();
}
function fuRender(){
  $('#fu-list').innerHTML=(window._fuFiles||[]).map((f,i)=>`
    <div style="display:flex;gap:10px;align-items:center;padding:9px 11px;border:1px solid var(--line);border-radius:10px;margin-bottom:6px">
      <div class="ic-box b-gray" style="width:32px;height:32px;border-radius:8px;display:grid;place-items:center">${ic(f.name.endsWith('.pdf')?'file':'image',16)}</div>
      <div style="flex:1;min-width:0"><div style="font-weight:650;font-size:13px">${esc(f.name)}</div>
        <div class="progress" style="height:5px;margin-top:5px"><i style="width:${f.pct}%"></i></div></div>
      <span class="t-sub">${f.pct<100?f.pct+'%':f.size}</span>
      ${f.pct>=100?`<span class="badge b-green nodot">${ic('check',12)}</span>`:''}
    </div>`).join('');
  const ok=(window._fuFiles||[]).length&&window._fuFiles.every(f=>f.pct>=100);
  const b=$('#fu-save'); if(b) b.setAttribute('aria-disabled', ok?'false':'true');
}
function fuProgress(){
  const t=setInterval(()=>{
    let done=true;
    (window._fuFiles||[]).forEach(f=>{ if(f.pct<100){ f.pct=Math.min(100,f.pct+ri(18,40)); done=false; } });
    fuRender(); if(done) clearInterval(t);
  },220);
}
function fuSave(cid, encId){
  const fs=(window._fuFiles||[]).filter(f=>f.pct>=100);
  if(!fs.length) return toast('Chưa có tệp nào được tải lên','err');
  const kind=$('#fu-kind').value, note=$('#fu-note').value;
  fs.forEach(f=>{ DB.files.push({id:'F'+(DB.files.length+1), customer_id:cid, encounter_id:encId||null, kind,
    name:f.name, size:f.size, at:new Date(), by:S.user.id, note}); });
  tl(cid,new Date(),'paperclip','blue','Tải lên '+fs.length+' tệp '+kind, fs.map(f=>f.name).join(', '), S.user.name);
  DB.timeline.sort((a,b)=>b.at-a.at);
  au(new Date(),S.user.id,'create','medical_files',cid,'—',fs.length+' tệp · '+kind); DB.audit.sort((a,b)=>b.at-a.at);
  closeModal(); toast('Đã lưu '+fs.length+' tệp vào hồ sơ','ok'); render();
}
function openFileView(fid){
  const f=DB.files.find(x=>x.id===fid); if(!f) return;
  const c=custById(f.customer_id);
  modal(`<div class="modal wide"><div class="modal-h"><h3>${esc(f.name)}</h3>
    <span class="badge b-teal nodot">${f.kind}</span><button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="alert al-ok">${ic('lock',16)}<div>Đã cấp <b>signed URL</b> cho tài khoản ${esc(S.user.name)} — hết hạn sau <b id="fv-cd">05:00</b>.
      Lượt xem này đã được ghi vào nhật ký kiểm toán.</div></div>
    <div style="background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:38px 20px;text-align:center">
      <div class="ic-box" style="width:60px;height:60px;border-radius:14px;background:var(--surface-3);color:var(--ink-2);display:grid;place-items:center;margin:0 auto 12px">${ic(f.name.endsWith('.pdf')?'file':'image',28)}</div>
      <div style="font-weight:700">${esc(f.name)}</div>
      <div class="t-sub">${f.size} · tải lên ${fmtDT(f.at)} bởi ${esc(userName(f.by))}</div>
      <div class="t-sub" style="margin-top:10px">(Bản demo không nhúng tệp thật — bản chính thức sẽ hiển thị PDF/ảnh tại đây)</div>
    </div>
    <div class="kv" style="margin-top:14px"><div class="k">Bệnh nhân</div><div class="v">${esc(c.name)} · ${c.code}</div>
      <div class="k">Loại tệp</div><div class="v">${f.kind}</div>
      <div class="k">Mô tả</div><div class="v" style="font-weight:500">${esc(f.note||'—')}</div></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Đóng</button>
    <button class="btn" onclick="toast('Đã gửi liên kết xem tệp tới email nội bộ','ok')">${ic('mail',16)} Gửi cho đồng nghiệp</button>
    <button class="btn primary" onclick="toast('Đang tải tệp về máy…','ok')">${ic('download',16)} Tải xuống</button></div></div>`);
  au(new Date(),S.user.id,'view','medical_files',f.id,'—','signed URL 5 phút'); DB.audit.sort((a,b)=>b.at-a.at);
  let left=300; const t=setInterval(()=>{ const e=$('#fv-cd'); if(!e){clearInterval(t);return;}
    left--; e.textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
    if(left<=0) clearInterval(t); },1000);
}

/* ---------- HỒ SƠ KHÁCH HÀNG: TẠO / SỬA ---------- */
function openCustomerForm(cid, presetPhone){
  const c = cid ? custById(cid) : null;
  const isNew = !c;
  const adminOnly = !isNew && !(can('customers.edit_admin')||can('admin'));
  modal(`<div class="modal wide"><div class="modal-h"><h3>${isNew?'Thêm khách hàng mới':'Sửa thông tin hành chính'}</h3>
    ${c?`<span class="badge b-gray nodot mono">${c.code}</span>`:''}
    <button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    ${adminOnly?`<div class="alert al-warn">${ic('lock',16)}<div>Vai trò của bạn chỉ được xem. Chỉ Lễ tân và Admin được sửa thông tin hành chính.</div></div>`:''}
    ${isNew?`<div class="alert al-info">${ic('info',16)}<div>Hệ thống <b>chuẩn hóa số điện thoại</b> và kiểm tra trùng trước khi tạo — mỗi người chỉ có một hồ sơ duy nhất.</div></div>`:''}
    <div class="grid g2">
      <label class="fld" for="cf-name"><span class="lb">Họ và tên <span class="req">*</span></span>
        <input class="inp" id="cf-name" value="${esc(c?c.name:'')}" placeholder="VD: Nguyễn Văn An" autocomplete="name"></label>
      <label class="fld" for="cf-phone"><span class="lb">Số điện thoại <span class="req">*</span></span>
        <input class="inp mono" id="cf-phone" type="tel" inputmode="tel" value="${c?fmtPhone(c.phone):(presetPhone||'')}" placeholder="0912 345 678" oninput="cfCheckPhone('${cid||''}')">
        <div class="hint" id="cf-phone-hint">Chấp nhận 0…, +84…, có dấu chấm/khoảng trắng.</div></label>
    </div>
    <div class="grid g3">
      <label class="fld" for="cf-dob"><span class="lb">Ngày sinh</span>
        <input class="inp" id="cf-dob" type="date" value="${c?new Date(new Date(c.dob).getTime()-new Date(c.dob).getTimezoneOffset()*60000).toISOString().slice(0,10):''}"></label>
      <label class="fld" for="cf-gender"><span class="lb">Giới tính</span>
        <select class="inp" id="cf-gender"><option value="M" ${c&&c.gender==='M'?'selected':''}>Nam</option><option value="F" ${c&&c.gender==='F'?'selected':''}>Nữ</option></select></label>
      <label class="fld" for="cf-phone2"><span class="lb">Điện thoại phụ</span>
        <input class="inp mono" id="cf-phone2" value="${c&&c.phone2?fmtPhone(c.phone2):''}"></label>
    </div>
    <div class="grid g2">
      <label class="fld" for="cf-email"><span class="lb">Email</span><input class="inp" id="cf-email" type="email" value="${esc(c?c.email:'')}"></label>
      <label class="fld" for="cf-job"><span class="lb">Nghề nghiệp</span><input class="inp" id="cf-job" list="cf-jobs" value="${esc(c?c.job:'')}">
        <datalist id="cf-jobs">${NGHE.map(n=>`<option value="${n}">`).join('')}</datalist></label>
    </div>
    <label class="fld" for="cf-addr"><span class="lb">Địa chỉ</span><input class="inp" id="cf-addr" value="${esc(c?c.address:'')}" placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP"></label>
    <label class="fld" for="cf-contact"><span class="lb">Người liên hệ khi cần</span>
      <input class="inp" id="cf-contact" value="${esc(c?c.contact_person:'')}" placeholder="Họ tên – quan hệ – số điện thoại"></label>
    <div class="divider"></div>
    <div class="grid g2">
      <label class="fld" for="cf-src"><span class="lb">Nguồn khách</span>
        <select class="inp" id="cf-src">${SOURCES.map(s=>`<option value="${s.code}" ${c&&c.source===s.code?'selected':''}>${s.name}</option>`).join('')}</select></label>
      <label class="fld" for="cf-camp"><span class="lb">Chiến dịch</span>
        <select class="inp" id="cf-camp"><option value="">— Không thuộc chiến dịch —</option>
          ${DB.campaigns.map(x=>`<option value="${x.id}" ${c&&c.campaign===x.id?'selected':''}>${x.name}</option>`).join('')}</select></label>
    </div>
    <div class="grid g2">
      <label class="fld" for="cf-need"><span class="lb">Nhu cầu khám</span>
        <select class="inp" id="cf-need">${NHU_CAU.map(n=>`<option ${c&&c.need===n?'selected':''}>${n}</option>`).join('')}</select></label>
      <label class="fld" for="cf-concern"><span class="lb">Bệnh lý quan tâm</span>
        <input class="inp" id="cf-concern" list="cf-dx" value="${esc(c?c.concern:'')}">
        <datalist id="cf-dx">${BENH_LY.map(n=>`<option value="${n}">`).join('')}</datalist></label>
    </div>
    ${isNew&&can('leads.assign')?`<label class="fld" for="cf-owner"><span class="lb">Giao cho Telesales</span>
      <select class="inp" id="cf-owner"><option value="">— Chưa giao —</option>${TELESALES.map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}</select></label>`:''}
    <label class="fld" for="cf-note"><span class="lb">Ghi chú</span><textarea class="inp" id="cf-note" rows="2">${esc(c?c.note:'')}</textarea></label>
    <div id="cf-err"></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" ${adminOnly?'aria-disabled="true"':''} onclick="saveCustomer('${cid||''}')">${isNew?'Tạo hồ sơ':'Lưu thay đổi'}</button></div></div>`);
}
function cfCheckPhone(cid){
  const v=normPhone($('#cf-phone').value), h=$('#cf-phone-hint');
  if(!v){ h.className='hint'; h.textContent='Chấp nhận 0…, +84…, có dấu chấm/khoảng trắng.'; return; }
  const dup=DB.customers.find(c=>c.id!==cid&&normPhone(c.phone)===v);
  if(dup){ h.className='err'; h.innerHTML=ic('alert',13)+` Số này đã thuộc hồ sơ <b>${esc(dup.name)}</b> (${dup.code}). <a style="color:var(--brand);cursor:pointer" onclick="closeModal();location.hash='#/customers/${dup.id}'">Mở hồ sơ đó</a>`; }
  else if(v.length<9){ h.className='err'; h.innerHTML=ic('alert',13)+' Số điện thoại chưa đủ độ dài.'; }
  else { h.className='hint'; h.innerHTML=ic('check',13)+' Chuẩn hóa: <b>'+fmtPhone(v)+'</b> · chưa tồn tại trong hệ thống.'; }
}
function saveCustomer(cid){
  const name=$('#cf-name').value.trim(), phone=normPhone($('#cf-phone').value);
  const err=$('#cf-err');
  if(!name){ err.innerHTML=`<div class="alert al-err">${ic('alert',16)}<div>Vui lòng nhập họ tên.</div></div>`; $('#cf-name').focus(); return; }
  if(phone.length<9){ err.innerHTML=`<div class="alert al-err">${ic('alert',16)}<div>Số điện thoại không hợp lệ.</div></div>`; $('#cf-phone').focus(); return; }
  const dup=DB.customers.find(c=>c.id!==cid&&normPhone(c.phone)===phone);
  if(dup){ err.innerHTML=`<div class="alert al-err">${ic('alert',16)}<div>Số điện thoại đã thuộc hồ sơ <b>${esc(dup.name)}</b>. Không tạo hồ sơ trùng.</div></div>`; return; }
  const f={name, phone, phone2:normPhone($('#cf-phone2').value), email:$('#cf-email').value.trim(),
    dob:$('#cf-dob').value?new Date($('#cf-dob').value+'T00:00:00'):new Date(TODAY.getFullYear()-40,0,1),
    gender:$('#cf-gender').value, address:$('#cf-addr').value.trim(), job:$('#cf-job').value.trim(),
    contact_person:$('#cf-contact').value.trim(), source:$('#cf-src').value, campaign:$('#cf-camp').value,
    need:$('#cf-need').value, concern:$('#cf-concern').value.trim(), note:$('#cf-note').value.trim()};
  if(cid){
    const c=custById(cid); const before=JSON.stringify({name:c.name,phone:c.phone,address:c.address});
    Object.assign(c,f);
    au(new Date(),S.user.id,'update','customers',cid,before,JSON.stringify({name:c.name,phone:c.phone,address:c.address}));
    tl(cid,new Date(),'edit','gray','Cập nhật thông tin hành chính','', S.user.name);
    toast('Đã lưu thay đổi hồ sơ '+c.code,'ok');
  } else {
    const n=DB.customers.length+1;
    const owner = $('#cf-owner') ? $('#cf-owner').value : '';
    const c=Object.assign({id:'C'+String(n).padStart(4,'0'), code:'KH-'+String(100+n).padStart(6,'0'),
      status: owner?'ASSIGNED':'NEW_LEAD', lifecycle:'lead', assigned_to:owner||null, created_at:new Date(),
      last_call:null, next_call:null, call_count:0, interest:0}, f);
    DB.customers.push(c);
    tl(c.id,new Date(),'inbox','gray','Tạo hồ sơ thủ công bởi '+S.user.name, srcName(c.source), '');
    if(owner) tl(c.id,new Date(),'user','gray','Phân bổ cho Telesales',userName(owner),'Bởi '+S.user.name);
    au(new Date(),S.user.id,'create','customers',c.id,'—',c.name+' · '+fmtPhone(c.phone));
    toast('Đã tạo hồ sơ '+c.code+' cho '+c.name,'ok');
  }
  DB.timeline.sort((a,b)=>b.at-a.at); DB.audit.sort((a,b)=>b.at-a.at);
  closeModal(); buildNav(); render();
}

/* ---------- LỊCH HẸN: ĐỔI LỊCH / HỦY ---------- */
function openReschedule(apid){
  const a=DB.appointments.find(x=>x.id===apid), c=custById(a.customer_id);
  closeModal();
  modal(`<div class="modal"><div class="modal-h"><h3>Đổi lịch hẹn</h3><button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="alert al-info">${ic('calendar',16)}<div><b>${esc(c.name)}</b> · ${fmtPhone(c.phone)}<br>Lịch hiện tại: <b>${fmtDT(a.at)}</b> · ${esc(a.type)} · ${esc(userName(a.doctor))}</div></div>
    <div class="grid g2">
      <label class="fld"><span class="lb">Ngày mới <span class="req">*</span></span><input class="inp" type="date" id="rs-date" value="${new Date(a.at.getTime()-a.at.getTimezoneOffset()*60000).toISOString().slice(0,10)}"></label>
      <label class="fld"><span class="lb">Giờ mới <span class="req">*</span></span><input class="inp" type="time" id="rs-time" value="${fmtT(a.at)}"></label>
    </div>
    <div class="grid g2">
      <label class="fld"><span class="lb">Bác sĩ</span><select class="inp" id="rs-doc">${DOCTORS.map(u=>`<option value="${u.id}" ${u.id===a.doctor?'selected':''}>${u.name}</option>`).join('')}</select></label>
      <label class="fld"><span class="lb">Phòng</span><select class="inp" id="rs-room">${DB.rooms.map(r=>`<option value="${r.id}" ${r.id===a.room?'selected':''}>${r.name}</option>`).join('')}</select></label>
    </div>
    <label class="fld"><span class="lb">Lý do đổi lịch <span class="req">*</span></span>
      <select class="inp" id="rs-reason"><option>Khách bận đột xuất</option><option>Khách xin dời sang cuối tuần</option>
        <option>Bác sĩ bận lịch mổ / hội chẩn</option><option>Trùng lịch phòng</option><option>Lý do khác</option></select></label>
    <div class="alert al-warn">${ic('info',16)}<div>Lịch cũ không bị xóa — hệ thống ghi nhận là <b>đã đổi lịch</b> và lưu vào timeline khách hàng.</div></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" onclick="doReschedule('${apid}')">Xác nhận đổi lịch</button></div></div>`);
}
function doReschedule(apid){
  const a=DB.appointments.find(x=>x.id===apid), c=custById(a.customer_id);
  const at=new Date($('#rs-date').value+'T'+$('#rs-time').value);
  const doc=$('#rs-doc').value, room=$('#rs-room').value, reason=$('#rs-reason').value;
  const clash=DB.appointments.find(x=>x.id!==apid&&x.status!=='cancelled'&&Math.abs(x.at-at)<30*60000&&(x.room===room||x.doctor===doc));
  if(clash) return toast('Trùng lịch: '+(DB.rooms.find(r=>r.id===room)||{name:''}).name+' / '+userName(doc)+' đã có khách lúc '+fmtT(clash.at),'err');
  const old=fmtDT(a.at);
  au(new Date(),S.user.id,'reschedule','appointments',apid,old,fmtDT(at)+' ('+reason+')');
  a.at=at; a.doctor=doc; a.room=room; a.status='booked';
  DB.appointments.sort((x,y)=>x.at-y.at);
  tl(c.id,new Date(),'repeat','purple','Đổi lịch hẹn',old+' → '+fmtDT(at),reason+' · '+S.user.name);
  DB.timeline.sort((x,y)=>y.at-x.at); DB.audit.sort((x,y)=>y.at-x.at);
  closeModal(); toast('Đã đổi lịch sang '+fmtDT(at),'ok'); buildNav(); render();
}
function openCancelAppt(apid){
  const a=DB.appointments.find(x=>x.id===apid), c=custById(a.customer_id);
  closeModal();
  modal(`<div class="modal" style="max-width:460px"><div class="modal-h"><h3>Hủy lịch hẹn</h3><button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="alert al-err">${ic('alert',16)}<div>Hủy lịch <b>${fmtDT(a.at)}</b> của <b>${esc(c.name)}</b>.</div></div>
    <label class="fld"><span class="lb">Lý do hủy <span class="req">*</span></span>
      <select class="inp" id="ca-reason"><option>Khách báo hủy</option><option>Khách không liên lạc được</option>
        <option>Khách đã khám nơi khác</option><option>Phòng khám chủ động hủy</option><option>Lý do khác</option></select></label>
    <label class="fld"><span class="lb">Ghi chú</span><textarea class="inp" id="ca-note" rows="2"></textarea></label>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="ca-followup" checked> Tạo nhắc việc cho Telesales gọi lại sau 3 ngày</label>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Quay lại</button>
    <button class="btn danger" onclick="doCancelAppt('${apid}')">Xác nhận hủy lịch</button></div></div>`);
}
function doCancelAppt(apid){
  const a=DB.appointments.find(x=>x.id===apid), c=custById(a.customer_id);
  const reason=$('#ca-reason').value, note=$('#ca-note').value;
  a.status='cancelled';
  if($('#ca-followup').checked){ c.next_call=d(3,9,30); if(c.status==='APPOINTMENT_BOOKED') c.status='CALLBACK'; }
  tl(c.id,new Date(),'ban','red','Hủy lịch hẹn '+fmtDT(a.at),reason+(note?' · '+note:''),S.user.name);
  au(new Date(),S.user.id,'status_change','appointments',apid,'booked','cancelled ('+reason+')');
  DB.timeline.sort((x,y)=>y.at-x.at); DB.audit.sort((x,y)=>y.at-x.at);
  closeModal(); toast('Đã hủy lịch hẹn','warn'); buildNav(); render();
}

/* ---------- PHIẾU THU ---------- */
function openReceipt(pid){
  const p=DB.payments.find(x=>x.id===pid), c=custById(p.customer_id), co=courseById(p.course_id);
  modal(`<div class="modal"><div class="modal-h"><h3>Phiếu thu ${p.ref}</h3><button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b" id="receipt">
    <div style="text-align:center;margin-bottom:16px">
      <img src="assets/logo.png" alt="Vitalife" style="height:30px">
      <div class="t-sub" style="margin-top:6px">${DB.clinic.address}<br>Hotline ${DB.clinic.hotline} · MST ${DB.clinic.tax}</div>
      <h2 style="margin:14px 0 2px;font-size:19px">PHIẾU THU</h2>
      <div class="t-sub mono">${p.ref} · ${fmtDT(p.at)}</div>
    </div>
    <div class="kv">
      <div class="k">Khách hàng</div><div class="v">${esc(c.name)} (${c.code})</div>
      <div class="k">Điện thoại</div><div class="v mono">${fmtPhone(c.phone)}</div>
      <div class="k">Nội dung</div><div class="v">${co?esc(pkgById(co.package_id).name):'Thanh toán dịch vụ'}</div>
      <div class="k">Mã liệu trình</div><div class="v mono">${co?co.code:'—'}</div>
      <div class="k">Hình thức</div><div class="v">${(PAY_METHODS.find(m=>m.code===p.method)||{label:''}).label}</div>
      <div class="k">Người thu</div><div class="v">${esc(userName(p.by))}</div>
    </div>
    <div style="margin-top:16px;padding:14px;background:var(--brand-50);border-radius:12px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:700">Số tiền${p.amount<0?' điều chỉnh':''}</span>
      <span style="font-size:22px;font-weight:800;color:${p.amount<0?'var(--danger)':'var(--brand)'}">${money(p.amount)}đ</span>
    </div>
    ${co?`<div class="kv" style="margin-top:14px"><div class="k">Tổng giá trị gói</div><div class="v">${money(co.total)}đ</div>
      <div class="k">Đã thanh toán</div><div class="v" style="color:var(--ok)">${money(co.paid)}đ</div>
      <div class="k">Còn lại</div><div class="v" style="color:${co.total-co.paid>0?'var(--danger)':'var(--ok)'}">${money(Math.max(0,co.total-co.paid))}đ</div></div>`:''}
    <div class="t-sub" style="margin-top:16px;text-align:center">${esc(p.note)}<br>Cảm ơn Quý khách đã tin tưởng Vitalife — ${DB.clinic.slogan}</div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Đóng</button>
    <button class="btn" onclick="toast('Đã gửi phiếu thu qua Zalo/SMS cho khách (demo)','ok')">${ic('mail',16)} Gửi cho khách</button>
    <button class="btn primary" onclick="window.print()">${ic('file',16)} In phiếu</button></div></div>`);
}

/* =========================================================================
   ADMIN › IMPORT DANH SÁCH NHÂN SỰ (TELESALES…) TỪ EXCEL
   ========================================================================= */
DB.staffImport = {
  filename:'Danh_sach_nhan_su_Telesales_T09.xlsx',
  sheets:['Telesales (12 dòng)','Toàn bộ nhân sự (34 dòng)','Hướng dẫn'],
  headers:['STT','Họ và tên','Email công ty','Số điện thoại','Vai trò','Cơ sở làm việc','Chức danh','Ngày vào làm','Ghi chú'],
  fields:[{key:'',label:'— Bỏ qua —'},{key:'name',label:'Họ tên *'},{key:'email',label:'Email *'},{key:'phone',label:'Số điện thoại'},
    {key:'role',label:'Vai trò *'},{key:'branch',label:'Cơ sở'},{key:'title',label:'Chức danh'},
    {key:'start',label:'Ngày vào làm'},{key:'note',label:'Ghi chú'},{key:'spec',label:'Chuyên môn'}],
  autoMap:['','name','email','phone','role','branch','title','start','note'],
  rows:[
    ['1','Nguyễn Thị Kim Ngân','ngan.ts@vitalife.vn','0912 004 511','Telesales','Thượng Đình','Nhân viên tư vấn','02/09/2026',''],
    ['2','Trần Hoài Nam','nam.ts@vitalife.vn','0987.004.512','Telesales','Thượng Đình','Nhân viên tư vấn','02/09/2026',''],
    ['3','Lê Thị Bích Hạnh','hanh.ts@vitalife.vn','+84903004513','Telesales','Cơ sở 2','Nhân viên tư vấn','02/09/2026',''],
    ['4','Phạm Quốc Thịnh','thinh.ts@vitalife.vn','0356004514','Telesales','Thượng Đình','Trưởng nhóm tư vấn','02/09/2026','Kiêm OP'],
    ['5','Vũ Thị Hồng Loan','loan.ts@vitalife.vn','0708 004 515','Telesales','Thượng Đình','Nhân viên tư vấn','02/09/2026',''],
    ['6','Đỗ Minh Khang','khang.ts@vitalife.vn','0912004516','Telesales, CSKH','Cơ sở 2','Nhân viên tư vấn','02/09/2026','2 vai trò'],
    ['7','Hoàng Thùy Dương','','0977004517','Telesales','Thượng Đình','Nhân viên tư vấn','02/09/2026','Thiếu email'],
    ['8','Bùi Văn Khoa','khoa.ts@vitalife.vn','0912004518','Telesales','Thượng Đình','Nhân viên tư vấn','02/09/2026','Email đã tồn tại'],
    ['9','Mai Thị Thu Trang','trang2.ts@vitalife.vn','0938004519','Chăm sóc khách hàng','Thượng Đình','Nhân viên CSKH','02/09/2026',''],
    ['10','Ngô Đức Trí','tri.ktv@vitalife.vn','0966004520','Kỹ thuật viên','Thượng Đình','KTV vật lý trị liệu','02/09/2026',''],
    ['11','Đinh Thị Hà My','my.lt@vitalife.vn','0822004521','Lễ tân','Cơ sở 2','Nhân viên lễ tân','02/09/2026',''],
    ['12','Lý Thanh Bình','binh.ts@vitalife.vn','0912.004.522','Telesale','Thượng Đình','Nhân viên tư vấn','02/09/2026','Viết sai chính tả vai trò'],
  ],
};
const ROLE_ALIAS = {
  'telesales':'telesales','telesale':'telesales','tư vấn':'telesales','sale':'telesales','tvv':'telesales',
  'chăm sóc khách hàng':'op','cskh':'op','op':'op',
  'lễ tân':'reception','le tan':'reception','tiếp đón':'reception','reception':'reception',
  'bác sĩ':'doctor','bs':'doctor','doctor':'doctor',
  'kỹ thuật viên':'tech','ktv':'tech','tech':'tech',
  'trưởng phòng':'manager','quản lý':'manager','manager':'manager',
  'marketing':'marketing','ads':'marketing','ads / marketing':'marketing',
  'admin':'admin','quản trị':'admin','quản trị viên':'admin',
};
function parseRoles(raw){
  return String(raw||'').split(/[,;/+]/).map(x=>ROLE_ALIAS[x.trim().toLowerCase()]).filter(Boolean)
    .filter((v,i,a)=>a.indexOf(v)===i);
}
function staffRowStatus(r, map){
  const g=k=>{ const i=map.indexOf(k); return i<0?'':r[i]; };
  const name=g('name').trim(), email=g('email').trim().toLowerCase(), roles=parseRoles(g('role'));
  if(!name) return {ok:false,type:'no_name',msg:'Thiếu họ tên'};
  if(!email) return {ok:false,type:'no_email',msg:'Thiếu email — không tạo được tài khoản đăng nhập'};
  if(DB.users.some(u=>u.email.toLowerCase()===email)) return {ok:false,type:'dup',msg:'Email đã tồn tại trong hệ thống'};
  if(!roles.length) return {ok:false,type:'no_role',msg:'Không nhận diện được vai trò'};
  return {ok:true,type:'ok',msg:'Hợp lệ',name,email,roles,phone:normPhone(g('phone')),branch:g('branch'),title:g('title')};
}
S.simp={step:1,map:null,dupMode:'skip',sendInvite:true};
function viewStaffImport(){
  const I=DB.staffImport, st=S.simp.step;
  if(!S.simp.map) S.simp.map=I.autoMap.slice();
  const steps=['Tải file','Chọn sheet','Ghép cột','Xem trước','Kiểm tra lỗi','Import'];
  const checked=I.rows.map(r=>staffRowStatus(r,S.simp.map));
  const okRows=checked.filter(x=>x.ok), badRows=checked.filter(x=>!x.ok);
  let body='';
  if(st===1) body=`
    <div class="dropzone" onclick="S.simp.step=2;render()" ondragover="event.preventDefault();this.classList.add('drag')"
         ondragleave="this.classList.remove('drag')" ondrop="event.preventDefault();S.simp.step=2;render()">
      <div class="ic-box">${ic('upload',26)}</div>
      <div style="font-weight:700;font-size:15px;margin-bottom:4px">Kéo thả file danh sách nhân sự vào đây</div>
      <div class="t-sub">Hỗ trợ .xlsx, .xls, .csv · mỗi dòng là một nhân viên</div>
      <button class="btn primary" style="margin-top:14px">Chọn file từ máy tính</button>
    </div>
    <div class="alert al-info" style="margin-top:14px">${ic('info',16)}<div>Cột <b>Vai trò</b> nhận cả tiếng Việt lẫn tiếng Anh và tự sửa lỗi thường gặp:
      “Telesale”, “TVV”, “Tư vấn” → <b>Telesales</b>; “CSKH” → <b>OP / CSKH</b>; “KTV” → <b>Kỹ thuật viên</b>.
      Một người có thể mang nhiều vai trò, phân cách bằng dấu phẩy.</div></div>
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn sm" onclick="downloadStaffTemplate()">${ic('download',15)} Tải file Excel mẫu</button>
      <button class="btn sm" onclick="location.hash='#/admin/users'">${ic('arrowLeft',15)} Về danh sách nhân sự</button>
    </div>`;
  if(st===2) body=`
    <div class="alert al-ok">${ic('check',16)}<div>Đã đọc file <b>${I.filename}</b> (86 KB) · ${I.sheets.length} sheet</div></div>
    <div class="sec-t">Chọn sheet chứa danh sách</div>
    ${I.sheets.map((s,i)=>`<label style="display:flex;align-items:center;gap:11px;padding:12px 14px;border:1px solid ${i===0?'var(--brand)':'var(--line)'};
      background:${i===0?'var(--brand-50)':'var(--surface)'};border-radius:12px;margin-bottom:7px;cursor:pointer">
      <input type="radio" name="ssheet" ${i===0?'checked':''}>
      <div style="flex:1"><div style="font-weight:650">${s}</div>
      <div class="t-sub">${i===0?'9 cột · dòng 1 là tiêu đề · toàn bộ là nhân viên Telesales và các vai trò liên quan':i===1?'12 cột · gồm cả nhân sự đã nghỉ việc':'Ghi chú cách điền'}</div></div>
      ${i===0?'<span class="badge b-green nodot">Đề xuất</span>':''}</label>`).join('')}
    <label class="fld" style="margin-top:12px"><span class="lb">Dòng tiêu đề</span><input class="inp" value="1" style="max-width:120px"></label>`;
  if(st===3) body=`
    <div class="alert al-ok">${ic('check',16)}<div>Đã tự ghép <b>8/9 cột</b>. Bắt buộc phải có <b>Họ tên</b>, <b>Email</b> và <b>Vai trò</b>.</div></div>
    <div class="tbl-wrap"><table style="min-width:760px"><thead><tr><th style="width:26%">Cột trong file</th><th style="width:24%">Dữ liệu mẫu</th>
      <th style="width:28%">Ghép vào trường hệ thống</th><th>Trạng thái</th></tr></thead>
      <tbody>${I.headers.map((h,i)=>`<tr>
        <td><b>${h}</b><div class="t-sub">Cột ${String.fromCharCode(65+i)}</div></td>
        <td class="t-sub">${esc(I.rows[0][i]||'—')}</td>
        <td><select class="inp sm" style="width:100%" onchange="S.simp.map[${i}]=this.value;render()">
          ${I.fields.map(f=>`<option value="${f.key}" ${S.simp.map[i]===f.key?'selected':''}>${f.label}</option>`).join('')}</select></td>
        <td>${S.simp.map[i]?'<span class="badge b-green">Đã ghép</span>':'<span class="badge b-gray">Bỏ qua</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  if(st===4){
    const cols=S.simp.map.map((k,i)=>({k,i,label:(I.fields.find(f=>f.key===k)||{}).label})).filter(c=>c.k);
    body=`<div class="alert al-info">${ic('info',16)}<div>Xem trước toàn bộ <b>${I.rows.length} dòng</b>. Số điện thoại đã chuẩn hóa, vai trò đã ánh xạ về mã hệ thống.</div></div>
    <div class="tbl-wrap"><table style="min-width:900px"><thead><tr><th>#</th>${cols.map(c=>`<th>${c.label.replace(' *','')}</th>`).join('')}<th>Vai trò nhận diện</th></tr></thead>
    <tbody>${I.rows.map((r,ri)=>{ const st2=checked[ri];
      return `<tr style="${st2.ok?'':'background:var(--danger-bg)'}"><td class="t-sub">${ri+1}</td>
      ${cols.map(c=>{ let v=r[c.i]||'';
        if(c.k==='phone'){ const n=normPhone(v); return `<td class="mono" style="font-size:12.5px">${n?fmtPhone(n):'<span class="t-sub">—</span>'}</td>`; }
        return `<td>${esc(v)||'<span class="t-sub">—</span>'}</td>`; }).join('')}
      <td>${parseRoles(r[S.simp.map.indexOf('role')]).map(x=>`<span class="badge ${roleColor(x)} nodot">${roleName(x)}</span>`).join(' ')||'<span class="badge b-red">Không xác định</span>'}</td></tr>`;}).join('')}</tbody></table></div>`;
  }
  if(st===5) body=`
    <div class="grid g4" style="margin-bottom:16px">
      ${stat('Tổng số dòng',I.rows.length,'','file')}
      ${stat('Hợp lệ',okRows.length,'Sẵn sàng tạo tài khoản','check','ok')}
      ${stat('Thiếu dữ liệu',badRows.filter(b=>b.type!=='dup').length,'Thiếu email / vai trò','alert','bad')}
      ${stat('Email đã tồn tại',badRows.filter(b=>b.type==='dup').length,'Cần chọn cách xử lý','repeat','bad')}
    </div>
    ${badRows.length?`<div class="alert al-warn">${ic('alert',16)}<div><b>${badRows.length} dòng cần xem lại.</b> Hệ thống sẽ không tạo tài khoản trùng email — mỗi nhân viên chỉ có một tài khoản đăng nhập.</div></div>`:''}
    <div class="tbl-wrap" style="border:1px solid var(--line);border-radius:12px;margin-bottom:16px">
      <table style="min-width:720px"><thead><tr><th>Dòng</th><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Kết quả kiểm tra</th></tr></thead>
      <tbody>${checked.map((x,i)=>`<tr><td class="t-sub">${i+1}</td>
        <td class="t-name">${esc(I.rows[i][1])}</td><td class="t-sub">${esc(I.rows[i][2])||'—'}</td>
        <td>${parseRoles(I.rows[i][4]).map(r=>`<span class="badge ${roleColor(r)} nodot">${roleName(r)}</span>`).join(' ')||'—'}</td>
        <td><span class="badge ${x.ok?'b-green':'b-red'}">${x.msg}</span></td></tr>`).join('')}</tbody></table></div>
    <div class="sec-t">Xử lý dòng trùng email</div>
    ${[['skip','Bỏ qua','Giữ nguyên tài khoản cũ (khuyến nghị)'],
       ['update','Cập nhật vai trò &amp; thông tin','Ghi đè lên tài khoản hiện có, giữ nguyên lịch sử hoạt động']]
      .map(([k,t,d2])=>`<label style="display:flex;gap:11px;padding:11px 13px;border:1px solid ${S.simp.dupMode===k?'var(--brand)':'var(--line)'};
        background:${S.simp.dupMode===k?'var(--brand-50)':'var(--surface)'};border-radius:11px;margin-bottom:6px;cursor:pointer">
        <input type="radio" name="sdup" ${S.simp.dupMode===k?'checked':''} onchange="S.simp.dupMode='${k}';render()">
        <div><div style="font-weight:650">${t}</div><div class="t-sub">${d2}</div></div></label>`).join('')}
    <div class="divider"></div>
    <label style="display:flex;gap:10px;align-items:center;font-size:13.5px;margin-bottom:10px">
      <input type="checkbox" ${S.simp.sendInvite?'checked':''} onchange="S.simp.sendInvite=this.checked">
      Gửi email mời đặt mật khẩu cho nhân viên mới (không lưu mật khẩu dạng văn bản thuần)</label>
    <button class="btn sm" onclick="downloadStaffErrors()">${ic('download',15)} Tải báo cáo ${badRows.length} dòng lỗi</button>`;
  if(st===6){
    const created=S.simp.result||{created:0,updated:0,skipped:0};
    body=`<div style="text-align:center;padding:22px 10px">
      <div class="ic-box" style="width:64px;height:64px;border-radius:18px;background:var(--ok-bg);color:var(--ok);display:grid;place-items:center;margin:0 auto">${ic('checkCircle',32)}</div>
      <h2 style="margin:14px 0 4px;font-size:22px">Đã tạo tài khoản nhân sự</h2>
      <p class="t-sub" style="margin:0 0 20px">Lô import <b>STAFF-${fmtD(TODAY).replace(/\//g,'')}</b> · thực hiện bởi ${esc(S.user.name)}</p>
      <div class="grid g3" style="text-align:left;max-width:640px;margin:0 auto">
        ${stat('Tạo mới',created.created,'Đã gửi email mời','userPlus','ok')}
        ${stat('Cập nhật',created.updated,'Tài khoản đã có','repeat')}
        ${stat('Bỏ qua',created.skipped,'Thiếu dữ liệu / trùng','ban','bad')}
      </div>
      <div class="alert al-info" style="max-width:640px;margin:20px auto 0;text-align:left">${ic('info',16)}<div>
        Nhân viên Telesales mới <b>chưa có lead nào</b>. Bước tiếp theo: Admin vào
        <b>Phân bổ lead</b> để chia khách hàng tiềm năng cho họ.</div></div>
      <div style="margin-top:20px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn" onclick="S.simp={step:1,map:null,dupMode:'skip',sendInvite:true};render()">Import file khác</button>
        <button class="btn" onclick="location.hash='#/admin/users'">Xem danh sách nhân sự</button>
        <button class="btn primary" onclick="location.hash='#/admin/assign'">${ic('repeat',16)} Phân bổ lead cho Telesales</button>
      </div></div>`;
  }
  return head('Import danh sách nhân sự từ Excel','Quản trị › Người dùng &amp; quyền › Import nhân sự — tạo tài khoản đăng nhập kèm vai trò',
    `<button class="btn" onclick="location.hash='#/admin/users'">${ic('arrowLeft',15)} Quay lại</button>`)
  + `<div class="card"><div class="card-b">
      <div class="steps">${steps.map((s,i)=>`${i?'<div class="step-line"></div>':''}
        <div class="step ${st===i+1?'on':''} ${st>i+1?'done':''}"><span class="n">${st>i+1?ic('check',13):i+1}</span>${s}</div>`).join('')}</div>
      ${body}
      ${st<6?`<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--line)">
        ${st>1?`<button class="btn" onclick="S.simp.step--;render()">${ic('arrowLeft',15)} Quay lại</button>`:''}
        <button class="btn primary" onclick="${st===5?`doStaffImport()`:'S.simp.step++;render()'}">${st===5?'Tạo '+okRows.length+' tài khoản':'Tiếp tục'} ${ic('arrowRight',15)}</button></div>`:''}
    </div></div>`;
}
function doStaffImport(){
  const I=DB.staffImport, map=S.simp.map;
  const checked=I.rows.map(r=>staffRowStatus(r,map));
  let created=0, updated=0, skipped=0;
  checked.forEach((x,i)=>{
    if(!x.ok){
      if(x.type==='dup'&&S.simp.dupMode==='update'){
        const u=DB.users.find(u=>u.email.toLowerCase()===String(I.rows[i][map.indexOf('email')]).trim().toLowerCase());
        const before=JSON.stringify(u.roles); u.roles=parseRoles(I.rows[i][map.indexOf('role')]);
        au(new Date(),S.user.id,'permission_change','user_roles',u.id,before,JSON.stringify(u.roles)); updated++;
      } else skipped++;
      return;
    }
    const branch = /cơ sở 2|cs2/i.test(x.branch)?'B2':'B1';
    const u={id:'U'+String(DB.users.length+1).padStart(2,'0'), name:x.name, email:x.email, roles:x.roles,
      active:true, branch, phone:x.phone, title:x.title, invited:S.simp.sendInvite};
    DB.users.push(u);
    au(new Date(),S.user.id,'create','users',u.id,'—',u.name+' · '+u.roles.map(roleName).join(', '));
    created++;
  });
  au(new Date(),S.user.id,'import','users','STAFF-'+fmtD(TODAY).replace(/\//g,''),'—',
     I.rows.length+' dòng · '+created+' tạo mới · '+updated+' cập nhật · '+skipped+' bỏ qua');
  DB.audit.sort((a,b)=>b.at-a.at);
  S.simp.result={created,updated,skipped}; S.simp.step=6;
  toast('Đã tạo '+created+' tài khoản nhân sự','ok'); buildNav(); render();
}
function downloadStaffTemplate(){
  downloadCSV('Mau_danh_sach_nhan_su_Vitalife.csv', DB.staffImport.headers,
    [['1','Nguyễn Văn A','a.ts@vitalife.vn','0912345678','Telesales','Thượng Đình','Nhân viên tư vấn','01/09/2026',''],
     ['2','Trần Thị B','b.cskh@vitalife.vn','0987654321','CSKH','Cơ sở 2','Nhân viên CSKH','01/09/2026','']]);
  toast('Đã tải file mẫu — điền theo đúng tên cột rồi import lại','ok');
}
function downloadStaffErrors(){
  const I=DB.staffImport, map=S.simp.map||I.autoMap, checked=I.rows.map(r=>staffRowStatus(r,map));
  const bad=I.rows.map((r,i)=>[i+1,...r,checked[i].msg]).filter((_,i)=>!checked[i].ok);
  if(!bad.length) return toast('Không có dòng lỗi nào để tải','info');
  downloadCSV('Loi_import_nhan_su.csv', ['Dòng',...I.headers,'Lý do'], bad);
  toast('Đã tải báo cáo '+bad.length+' dòng lỗi','ok');
}

/* =========================================================================
   ADMIN › PHÂN BỔ LEAD CHO TELESALES  (chỉ Admin được thực hiện)
   ========================================================================= */
S.assign={src:'',cp:'',scope:'unassigned',method:'even',targets:TELESALES.map(u=>u.id),q:''};
function tsStats(u){
  const leads=DB.customers.filter(c=>c.assigned_to===u.id);
  const open=leads.filter(c=>!['NOT_INTERESTED','TREATMENT_COMPLETED','CANCELLED'].includes(c.status));
  const booked=leads.filter(c=>['APPOINTMENT_BOOKED','ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','PACKAGE_PENDING','NO_SHOW'].includes(c.status));
  const pkgs=DB.courses.filter(co=>co.status!=='pending'&&leads.some(l=>l.id===co.customer_id));
  return {leads:leads.length, open:open.length, todayCalls:DB.calls.filter(c=>c.user_id===u.id&&sameDay(c.at,TODAY)).length,
    booked:booked.length, pkg:pkgs.length, rate:leads.length?Math.round(booked.length/leads.length*100):0,
    due:leads.filter(c=>c.next_call&&c.next_call<=d(0,23,59)).length};
}
function assignPool(){
  const f=S.assign;
  let list=DB.customers.filter(c=>['NEW_LEAD','ASSIGNED','CONTACTING','CALLBACK','NO_ANSWER','INTERESTED'].includes(c.status));
  if(f.scope==='unassigned') list=list.filter(c=>!c.assigned_to);
  if(f.scope==='new') list=list.filter(c=>daysBetween(c.created_at,TODAY)<=7);
  if(f.src) list=list.filter(c=>c.source===f.src);
  if(f.cp) list=list.filter(c=>c.campaign===f.cp);
  if(f.q){ const q=f.q.toLowerCase(), nq=normPhone(f.q);
    list=list.filter(c=>c.name.toLowerCase().includes(q)||normPhone(c.phone).includes(nq)); }
  return list.sort((a,b)=>b.created_at-a.created_at);
}
function assignPreview(list, targets, method){
  const res={}; targets.forEach(t=>res[t]=0);
  if(!targets.length||!list.length) return res;
  if(method==='even'){ list.forEach((_,i)=>res[targets[i%targets.length]]++); }
  else if(method==='load'){
    const load={}; targets.forEach(t=>load[t]=tsStats(userById(t)).open);
    list.forEach(()=>{ const t=targets.reduce((a,b)=>load[a]<=load[b]?a:b); res[t]++; load[t]++; });
  } else if(method==='perf'){
    const w={}; let tot=0; targets.forEach(t=>{ const s=tsStats(userById(t)); w[t]=1+s.rate/25; tot+=w[t]; });
    let left=list.length;
    targets.forEach((t,i)=>{ const n=i===targets.length-1?left:Math.round(list.length*w[t]/tot); res[t]=n; left-=n; });
  }
  return res;
}
function viewAdminAssign(){
  const f=S.assign, list=assignPool();
  const targets=f.targets.filter(t=>TELESALES.some(u=>u.id===t));
  const prev=assignPreview(list,targets,f.method);
  const unassigned=DB.customers.filter(c=>!c.assigned_to).length;
  const methods=[['even','Chia đều','Mỗi người số lượng bằng nhau'],
    ['load','Cân bằng tải','Ai đang giữ ít lead đang mở hơn thì nhận nhiều hơn'],
    ['perf','Theo hiệu suất','Ưu tiên người có tỷ lệ đặt lịch cao hơn']];
  return head('Phân bổ lead cho Telesales',
    'Chỉ <b>Admin</b> được phân bổ lead. Marketing chỉ import và theo dõi hiệu quả chiến dịch, Telesales chỉ thấy lead của mình.',
    `<button class="btn" onclick="location.hash='#/leads'">${ic('inbox',16)} Danh sách lead</button>
     <button class="btn" onclick="location.hash='#/admin/staff-import'">${ic('upload',16)} Import nhân sự</button>`)
  + `<div class="grid g4" style="margin-bottom:14px">
      ${stat('Lead chưa phân bổ',unassigned,unassigned?'Cần chia ngay':'Đã chia hết','inbox',unassigned?'bad':'ok',"S.assign.scope='unassigned';render()")}
      ${stat('Đang trong bộ lọc',list.length,'Sẽ được chia','filter')}
      ${stat('Nhân viên nhận',targets.length+' / '+TELESALES.length,'Telesales đang hoạt động','users')}
      ${stat('Trung bình mỗi người',targets.length?Math.round(list.length/targets.length):0,'lead','target')}
    </div>
    <div class="grid g-3-2">
      <div class="card">
        <div class="card-h"><h3>Lead chờ phân bổ</h3><span class="sub">${list.length} bản ghi</span>
          <div class="r"><button class="btn sm" onclick="exportCustomers(assignPool())">${ic('download',15)} Xuất</button></div></div>
        <div class="toolbar">
          <input class="inp" style="min-width:200px" placeholder="Tìm tên / SĐT…" value="${esc(f.q)}"
                 oninput="S.assign.q=this.value;clearTimeout(window._t);window._t=setTimeout(render,300)">
          <select class="inp" onchange="S.assign.scope=this.value;render()">
            <option value="unassigned" ${f.scope==='unassigned'?'selected':''}>Chưa có người phụ trách</option>
            <option value="new" ${f.scope==='new'?'selected':''}>Lead 7 ngày gần đây</option>
            <option value="all" ${f.scope==='all'?'selected':''}>Tất cả lead đang mở</option></select>
          <select class="inp" onchange="S.assign.src=this.value;render()"><option value="">Mọi nguồn</option>
            ${SOURCES.map(s=>`<option value="${s.code}" ${f.src===s.code?'selected':''}>${s.name}</option>`).join('')}</select>
          <select class="inp" onchange="S.assign.cp=this.value;render()"><option value="">Mọi chiến dịch</option>
            ${DB.campaigns.map(c=>`<option value="${c.id}" ${f.cp===c.id?'selected':''}>${c.name}</option>`).join('')}</select>
        </div>
        <div class="tbl-wrap" style="max-height:520px;overflow-y:auto">
          <table style="min-width:760px"><thead><tr>
            <th style="width:36px"><input type="checkbox" aria-label="Chọn tất cả" onchange="document.querySelectorAll('.as-cb').forEach(c=>c.checked=this.checked)"></th>
            <th>Khách hàng</th><th>Điện thoại</th><th>Nguồn</th><th>Bệnh lý quan tâm</th><th>Ngày có lead</th><th>Phụ trách</th></tr></thead>
          <tbody>${list.slice(0,60).map(c=>`<tr>
            <td><input type="checkbox" class="as-cb" value="${c.id}" aria-label="Chọn ${esc(c.name)}"></td>
            <td class="row-link" onclick="location.hash='#/customers/${c.id}'"><div class="t-name">${esc(c.name)}</div>
              <div class="t-sub">${c.code} · ${c.gender==='M'?'Nam':'Nữ'} ${age(c.dob)}t</div></td>
            <td><span class="t-phone">${fmtPhone(c.phone)}</span></td>
            <td><span class="badge ${srcColor(c.source)}">${srcName(c.source)}</span></td>
            <td class="t-sub">${esc(c.concern)}</td>
            <td class="t-sub">${fmtD(c.created_at)}</td>
            <td>${c.assigned_to?`<span class="t-sub">${esc(userName(c.assigned_to))}</span>`:'<span class="badge b-red nodot">Chưa giao</span>'}</td>
          </tr>`).join('')||`<tr><td colspan="7"><div class="empty"><div class="ic-box">${ic('checkCircle',22)}</div>
            <div class="t">Không còn lead nào chờ phân bổ</div><div>Đổi bộ lọc để xem các nhóm khác.</div></div></td></tr>`}</tbody></table></div>
        ${list.length>60?`<div class="t-sub" style="padding:10px 14px">Hiển thị 60/${list.length} dòng — thao tác phân bổ vẫn áp dụng cho toàn bộ ${list.length} lead trong bộ lọc.</div>`:''}
      </div>
      <div>
        <div class="card" style="margin-bottom:14px"><div class="card-h"><h3>Cách chia</h3></div><div class="card-b">
          ${methods.map(([k,t,d2])=>`<label style="display:flex;gap:11px;padding:11px 13px;border:1px solid ${f.method===k?'var(--brand)':'var(--line)'};
            background:${f.method===k?'var(--brand-50)':'var(--surface)'};border-radius:11px;margin-bottom:6px;cursor:pointer">
            <input type="radio" name="amethod" ${f.method===k?'checked':''} onchange="S.assign.method='${k}';render()">
            <div><div style="font-weight:650">${t}</div><div class="t-sub">${d2}</div></div></label>`).join('')}
        </div></div>
        <div class="card"><div class="card-h"><h3>Nhân viên Telesales</h3><span class="sub">${targets.length} được chọn</span>
          <div class="r"><button class="btn sm" onclick="S.assign.targets=TELESALES.map(u=>u.id);render()">Chọn tất cả</button></div></div>
          <div class="card-b tight">
            ${TELESALES.map(u=>{ const s=tsStats(u), on=targets.includes(u.id);
              return `<label class="queue-item" style="cursor:pointer">
                <input type="checkbox" ${on?'checked':''} aria-label="Chọn ${esc(u.name)}"
                  onchange="S.assign.targets=${'this.checked?S.assign.targets.concat([\''+u.id+'\']):S.assign.targets.filter(x=>x!==\''+u.id+'\')'};render()">
                <div class="avatar">${initials(u.name)}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:650;font-size:13.5px">${esc(u.name)}</div>
                  <div class="t-sub">${s.open} lead đang mở · ${s.todayCalls} cuộc gọi hôm nay · chốt lịch ${s.rate}%</div>
                  <div class="mini-bar" style="margin-top:5px"><i style="width:${Math.min(100,s.open*3)}%"></i></div>
                </div>
                ${on&&prev[u.id]?`<span class="badge b-teal nodot">+${prev[u.id]}</span>`:'<span class="t-sub">—</span>'}
              </label>`;}).join('')}
          </div>
          <div class="card-b" style="border-top:1px solid var(--line)">
            <div class="alert al-info" style="margin-bottom:12px">${ic('info',16)}<div>Chọn dòng ở bảng bên trái để phân bổ thủ công,
              hoặc bỏ trống để chia <b>toàn bộ ${list.length} lead</b> trong bộ lọc.</div></div>
            <button class="btn primary block" onclick="doAdminAssign()">${ic('repeat',16)} Thực hiện phân bổ</button>
            <button class="btn block" style="margin-top:8px" onclick="openReassign()">${ic('users',16)} Chuyển lead giữa nhân viên</button>
          </div>
        </div>
      </div>
    </div>`;
}
function doAdminAssign(){
  if(!can('leads.assign')) return toast('Chỉ Admin mới có quyền phân bổ lead','err');
  const targets=S.assign.targets.filter(t=>TELESALES.some(u=>u.id===t));
  if(!targets.length) return toast('Chọn ít nhất một nhân viên Telesales','err');
  const picked=[...document.querySelectorAll('.as-cb:checked')].map(x=>x.value);
  const list = picked.length ? picked.map(custById) : assignPool();
  if(!list.length) return toast('Không có lead nào để phân bổ','err');
  const prev=assignPreview(list,targets,S.assign.method);
  modal(`<div class="modal"><div class="modal-h"><h3>Xác nhận phân bổ</h3><button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="alert al-info">${ic('repeat',16)}<div>Chia <b>${list.length} lead</b> cho <b>${targets.length} nhân viên</b>
      theo cách <b>${{even:'chia đều',load:'cân bằng tải',perf:'theo hiệu suất'}[S.assign.method]}</b>.</div></div>
    ${targets.map(t=>{const s=tsStats(userById(t));
      return `<div style="display:flex;align-items:center;gap:11px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;margin-bottom:6px">
        <div class="avatar">${initials(userName(t))}</div>
        <div style="flex:1"><div style="font-weight:650">${esc(userName(t))}</div>
          <div class="t-sub">Đang giữ ${s.open} → <b>${s.open+(prev[t]||0)}</b> lead đang mở</div></div>
        <span class="badge b-teal nodot">+${prev[t]||0}</span></div>`;}).join('')}
    <label class="fld" style="margin-top:12px"><span class="lb">Ghi chú bàn giao (gửi kèm thông báo cho nhân viên)</span>
      <textarea class="inp" id="aa-note" rows="2" placeholder="VD: Lead chiến dịch TVDD tháng 9, ưu tiên gọi trong 2 giờ"></textarea></label>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="aa-notify" checked>
      Gửi thông báo trong hệ thống cho từng nhân viên</label>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" onclick="confirmAdminAssign()">Phân bổ ${list.length} lead</button></div></div>`);
  window._assignPlan={list,targets,prev};
}
function confirmAdminAssign(){
  const {list,targets,prev}=window._assignPlan||{};
  if(!list) return;
  const note=$('#aa-note').value.trim(), notify=$('#aa-notify').checked;
  const queue={}; targets.forEach(t=>queue[t]=prev[t]||0);
  let ti=0;
  list.forEach(c=>{
    while(queue[targets[ti]]<=0){ ti=(ti+1)%targets.length; }
    const uid=targets[ti]; queue[uid]--;
    const before=c.assigned_to?userName(c.assigned_to):'chưa giao';
    c.assigned_to=uid; if(c.status==='NEW_LEAD') c.status='ASSIGNED';
    tl(c.id,new Date(),'user','blue','Admin phân bổ cho Telesales',userName(uid)+(note?' · '+note:''),'Bởi '+S.user.name);
    au(new Date(),S.user.id,'assign','lead_assignments',c.id,before,userName(uid));
  });
  if(notify) targets.forEach(t=>{ if(prev[t]) DB.notifications.unshift({id:'N'+(DB.notifications.length+1),at:new Date(),
    icon:'inbox',cls:'b-blue',title:'Bạn được giao '+prev[t]+' lead mới',desc:note||'Từ Admin '+S.user.name,link:'#/telesales',read:false}); });
  DB.timeline.sort((a,b)=>b.at-a.at); DB.audit.sort((a,b)=>b.at-a.at);
  closeModal(); toast('Đã phân bổ '+list.length+' lead cho '+targets.length+' nhân viên','ok');
  initChrome(); buildNav(); render();
}
function openReassign(){
  modal(`<div class="modal"><div class="modal-h"><h3>Chuyển lead giữa nhân viên</h3><button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="alert al-warn">${ic('info',16)}<div>Dùng khi nhân viên nghỉ việc, nghỉ phép hoặc quá tải. Toàn bộ lịch sử cuộc gọi của lead vẫn được giữ nguyên.</div></div>
    <div class="grid g2">
      <label class="fld"><span class="lb">Chuyển từ <span class="req">*</span></span>
        <select class="inp" id="ra-from" onchange="raInfo()">${TELESALES.map(u=>`<option value="${u.id}">${u.name} (${tsStats(u).open} lead đang mở)</option>`).join('')}</select></label>
      <label class="fld"><span class="lb">Chuyển sang <span class="req">*</span></span>
        <select class="inp" id="ra-to">${TELESALES.map((u,i)=>`<option value="${u.id}" ${i===1?'selected':''}>${u.name} (${tsStats(u).open} lead đang mở)</option>`).join('')}</select></label>
    </div>
    <label class="fld"><span class="lb">Phạm vi</span><select class="inp" id="ra-scope">
      <option value="open">Chỉ lead đang mở (chưa chốt / chưa từ chối)</option>
      <option value="all">Toàn bộ lead đang giữ</option>
      <option value="cold">Chỉ lead chưa liên hệ được (không nghe máy / chưa gọi)</option></select></label>
    <label class="fld"><span class="lb">Lý do</span><input class="inp" id="ra-reason" placeholder="VD: Nhân viên nghỉ thai sản từ 05/09"></label>
    <div id="ra-info"></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" onclick="doReassign()">Chuyển lead</button></div></div>`);
  raInfo();
}
function raInfo(){
  const el=$('#ra-from'); if(!el) return;
  const from=el.value, u=userById(from); if(!u) return;
  const s=tsStats(u);
  $('#ra-info').innerHTML=`<div class="alert al-info">${ic('user',16)}<div><b>${esc(u.name)}</b> đang giữ ${s.leads} lead
    (${s.open} đang mở · ${s.due} đến hạn gọi hôm nay · tỷ lệ chốt lịch ${s.rate}%).</div></div>`;
}
function doReassign(){
  const from=$('#ra-from').value, to=$('#ra-to').value, scope=$('#ra-scope').value, reason=$('#ra-reason').value;
  if(from===to) return toast('Chọn hai nhân viên khác nhau','err');
  let list=DB.customers.filter(c=>c.assigned_to===from);
  if(scope==='open') list=list.filter(c=>!['NOT_INTERESTED','TREATMENT_COMPLETED','CANCELLED'].includes(c.status));
  if(scope==='cold') list=list.filter(c=>['NO_ANSWER','NEW_LEAD','ASSIGNED'].includes(c.status));
  if(!list.length) return toast('Không có lead nào phù hợp để chuyển','err');
  list.forEach(c=>{ c.assigned_to=to;
    tl(c.id,new Date(),'repeat','blue','Chuyển người phụ trách',userName(from)+' → '+userName(to),reason||S.user.name);
    au(new Date(),S.user.id,'assign','lead_assignments',c.id,userName(from),userName(to)); });
  DB.notifications.unshift({id:'N'+(DB.notifications.length+1),at:new Date(),icon:'repeat',cls:'b-blue',
    title:'Bạn nhận '+list.length+' lead chuyển từ '+userName(from),desc:reason||'Admin điều phối',link:'#/telesales',read:false});
  DB.timeline.sort((a,b)=>b.at-a.at); DB.audit.sort((a,b)=>b.at-a.at);
  closeModal(); toast('Đã chuyển '+list.length+' lead sang '+userName(to),'ok'); initChrome(); buildNav(); render();
}

/* =========================================================================
   ADMIN › VAI TRÒ & QUYỀN
   ========================================================================= */
const PERM_GROUPS=[
  {g:'Tổng quan', items:[['dashboard','Xem dashboard tổng quan']]},
  {g:'CRM & Lead', items:[['leads','Xem lead marketing'],['leads.import','Import lead từ Excel'],
    ['leads.assign','Phân bổ lead cho Telesales'],['customers','Xem hồ sơ khách hàng'],
    ['customers.edit_admin','Sửa thông tin hành chính']]},
  {g:'Telesales', items:[['telesales','Danh sách gọi của tôi'],['telesales.all','Xem lead của toàn bộ nhân viên']]},
  {g:'Lịch & Tiếp đón', items:[['calendar','Xem lịch phòng khám'],['calendar.book','Đặt / đổi lịch hẹn'],
    ['reception','Quầy tiếp đón, check-in/out']]},
  {g:'Y khoa', items:[['doctor','Hàng chờ bác sĩ'],['medical','Xem &amp; ghi hồ sơ khám'],
    ['medical.finalize','Chốt bệnh án'],['patients','Danh sách bệnh nhân']]},
  {g:'Điều trị', items:[['treatment','Xem liệu trình'],['treatment.propose','Đề xuất liệu trình'],
    ['treatment.approve','Duyệt &amp; kích hoạt liệu trình'],['treatment.sessions','Ghi nhận buổi điều trị']]},
  {g:'CSKH', items:[['op','Bảng chăm sóc khách hàng']]},
  {g:'Tài chính', items:[['payments','Thu tiền, tạo phiếu thu'],['payments.read','Chỉ xem giao dịch'],
    ['payments.reverse','Tạo bút toán điều chỉnh']]},
  {g:'Báo cáo & Quản trị', items:[['reports','Báo cáo tổng hợp'],['reports.marketing','Báo cáo marketing'],
    ['admin','Toàn quyền quản trị hệ thống']]},
];
function viewAdminRoles(){
  const roles=DB.roles;
  return head('Vai trò &amp; quyền hạn',
    'Ma trận phân quyền được kiểm tra ở <b>tầng máy chủ và Row-Level Security</b>, không chỉ ẩn menu ở giao diện.',
    `<button class="btn" onclick="location.hash='#/admin/users'">${ic('users',16)} Người dùng</button>
     <button class="btn primary" onclick="savePerms()">${ic('check',16)} Lưu ma trận quyền</button>`)
  + `<div class="alert al-warn">${ic('shield',16)}<div>Thay đổi quyền có hiệu lực với <b>phiên đăng nhập kế tiếp</b> của nhân viên và được ghi vào nhật ký kiểm toán.
      Vai trò <b>Admin</b> luôn có toàn quyền và không thể bỏ chọn.</div></div>
    <div class="card"><div class="tbl-wrap"><table class="no-cards" style="min-width:1100px">
      <thead><tr><th style="min-width:280px">Quyền</th>${roles.map(r=>`<th class="t-center"><span class="badge ${r.color} nodot">${r.name}</span></th>`).join('')}</tr></thead>
      <tbody>${PERM_GROUPS.map(g=>`
        <tr><td colspan="${roles.length+1}" style="background:var(--surface-2);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted)">${g.g}</td></tr>
        ${g.items.map(([p,lb])=>`<tr><td><div style="font-weight:600">${lb}</div><div class="t-code">${p}</div></td>
          ${roles.map(r=>{ const full=(PERMS[r.code]||[]).includes('*');
            const on= full || (PERMS[r.code]||[]).includes(p) || (PERMS[r.code]||[]).some(x=>p.startsWith(x+'.'));
            return `<td class="t-center"><input type="checkbox" class="pm-cb" data-role="${r.code}" data-perm="${p}"
              ${on?'checked':''} ${full?'disabled':''} aria-label="${lb} cho ${r.name}"></td>`;}).join('')}</tr>`).join('')}`).join('')}
      </tbody></table></div></div>
    <div class="grid g3" style="margin-top:14px">
      ${roles.slice(0,3).map(r=>`<div class="card"><div class="card-h"><span class="badge ${r.color} nodot">${r.name}</span>
        <span class="sub">${DB.users.filter(u=>u.roles.includes(r.code)).length} tài khoản</span></div>
        <div class="card-b"><div class="t-sub" style="margin-bottom:8px">${r.desc}</div>
        <div class="chips">${(PERMS[r.code]||[]).map(p=>`<span class="badge b-gray nodot mono" style="font-size:10.5px">${p}</span>`).join('')}</div></div></div>`).join('')}
    </div>`;
}
function savePerms(){
  const next={};
  document.querySelectorAll('.pm-cb').forEach(cb=>{
    const r=cb.dataset.role; next[r]=next[r]||[];
    if(cb.checked&&!cb.disabled) next[r].push(cb.dataset.perm);
  });
  let changed=0;
  Object.keys(next).forEach(r=>{
    if((PERMS[r]||[]).includes('*')) return;
    const before=JSON.stringify(PERMS[r]||[]);
    if(before!==JSON.stringify(next[r])){
      au(new Date(),S.user.id,'permission_change','roles',r,before,JSON.stringify(next[r]));
      PERMS[r]=next[r]; changed++;
    }
  });
  DB.audit.sort((a,b)=>b.at-a.at);
  toast(changed?('Đã lưu thay đổi quyền cho '+changed+' vai trò'):'Không có thay đổi nào','ok');
  buildNav(); render();
}

/* =========================================================================
   ADMIN › CẤU HÌNH PHÒNG KHÁM
   ========================================================================= */
function viewAdminSettings(){
  const cl=DB.clinic;
  return head('Cấu hình hệ thống','Thông tin phòng khám, cơ sở, phòng chức năng, nguồn khách và chiến dịch',
    `<button class="btn primary" onclick="toast('Đã lưu cấu hình hệ thống','ok')">${ic('check',16)} Lưu cấu hình</button>`)
  + `<div class="grid g-3-2" style="margin-bottom:14px">
      <div class="card"><div class="card-h"><h3>Thông tin phòng khám</h3><span class="sub">Hiển thị trên phiếu thu, phiếu khám</span></div>
        <div class="card-b">
          <div class="grid g2">
            <label class="fld"><span class="lb">Tên phòng khám</span><input class="inp" value="${esc(cl.name)}"></label>
            <label class="fld"><span class="lb">Pháp nhân</span><input class="inp" value="${esc(cl.company)}"></label>
          </div>
          <div class="grid g3">
            <label class="fld"><span class="lb">Hotline</span><input class="inp mono" value="${cl.hotline}"></label>
            <label class="fld"><span class="lb">Email</span><input class="inp" value="${cl.email}"></label>
            <label class="fld"><span class="lb">Mã số thuế</span><input class="inp mono" value="${cl.tax}"></label>
          </div>
          <label class="fld"><span class="lb">Địa chỉ</span><input class="inp" value="${esc(cl.address)}"></label>
          <div class="grid g2">
            <label class="fld"><span class="lb">Giờ làm việc</span><input class="inp" value="${cl.hours}"></label>
            <label class="fld"><span class="lb">Slogan</span><input class="inp" value="${esc(cl.slogan)}"></label>
          </div>
        </div></div>
      <div class="card"><div class="card-h"><h3>Bảo mật &amp; phiên làm việc</h3></div><div class="card-b">
        <label class="fld"><span class="lb">Tự động đăng xuất sau</span><select class="inp">
          <option>15 phút không hoạt động</option><option selected>30 phút không hoạt động</option><option>60 phút không hoạt động</option></select></label>
        <label class="fld"><span class="lb">Thời hạn signed URL tệp y khoa</span><select class="inp">
          <option>2 phút</option><option selected>5 phút</option><option>15 phút</option></select></label>
        <label style="display:flex;gap:9px;align-items:flex-start;font-size:13px;margin-bottom:10px"><input type="checkbox" checked>
          <span>Bắt buộc ghi lý do khi sửa bệnh án đã chốt</span></label>
        <label style="display:flex;gap:9px;align-items:flex-start;font-size:13px;margin-bottom:10px"><input type="checkbox" checked>
          <span>Chặn xóa giao dịch tài chính (chỉ cho phép bút toán điều chỉnh)</span></label>
        <label style="display:flex;gap:9px;align-items:flex-start;font-size:13px;margin-bottom:10px"><input type="checkbox" checked>
          <span>Telesales chỉ xem được lead được giao (Row-Level Security)</span></label>
        <label style="display:flex;gap:9px;align-items:flex-start;font-size:13px"><input type="checkbox" checked>
          <span>Ẩn hồ sơ y khoa với vai trò không có quyền <span class="mono t-sub">medical</span></span></label>
      </div></div>
    </div>
    <div class="grid g2" style="margin-bottom:14px">
      <div class="card"><div class="card-h"><h3>Cơ sở</h3>
        <div class="r"><button class="btn sm" onclick="openBranchForm()">${ic('plus',15)} Thêm</button></div></div>
        <div class="tbl-wrap"><table style="min-width:auto"><thead><tr><th>Tên cơ sở</th><th>Địa chỉ</th><th>Giờ làm việc</th><th class="t-center">Phòng</th></tr></thead>
        <tbody>${DB.branches.map(b=>`<tr class="row-link" onclick="openBranchForm('${b.id}')"><td class="t-name">${esc(b.name)}</td><td class="t-sub">${esc(b.addr)}</td>
          <td class="t-sub">${b.hours||'—'}</td><td class="t-center">${DB.rooms.filter(r=>r.branch===b.id).length}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Phòng chức năng</h3>
        <div class="r"><button class="btn sm" onclick="openRoomForm()">${ic('plus',15)} Thêm</button></div></div>
        <div class="tbl-wrap"><table style="min-width:auto"><thead><tr><th>Phòng</th><th>Cơ sở</th><th>Loại</th><th class="t-center">Cho phép trùng giờ</th></tr></thead>
        <tbody>${DB.rooms.map(r=>`<tr class="row-link" onclick="openRoomForm('${r.id}')"><td class="t-name">${esc(r.name)}</td>
          <td class="t-sub">${(DB.branches.find(b=>b.id===r.branch)||{name:''}).name}</td>
          <td><span class="badge b-gray nodot">${{exam:'Phòng khám',therapy:'Trị liệu',gym:'Tập PHCN'}[r.type]||r.type}</span></td>
          <td class="t-center"><input type="checkbox" ${r.type==='gym'?'checked':''} aria-label="Cho phép trùng giờ ${esc(r.name)}"></td></tr>`).join('')}</tbody></table></div></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Nguồn khách</h3></div>
        <div class="card-b"><div class="chips">${SOURCES.map(s=>`<span class="badge ${s.color}">${s.name}</span>`).join('')}</div>
        <div class="t-sub" style="margin-top:10px">Dùng cho lead, báo cáo marketing và phân tích doanh thu theo nguồn.</div></div></div>
      <div class="card"><div class="card-h"><h3>Chiến dịch quảng cáo</h3>
        <div class="r"><button class="btn sm" onclick="openCampaignForm()">${ic('plus',15)} Thêm</button></div></div>
        <div class="tbl-wrap"><table style="min-width:auto"><thead><tr><th>Chiến dịch</th><th>Nguồn</th><th class="t-right">Chi phí</th><th class="t-center">Lead</th></tr></thead>
        <tbody>${DB.campaigns.map(c=>`<tr class="row-link" onclick="openCampaignForm('${c.id}')"><td><div class="t-name">${esc(c.name)}</div><div class="t-code">${c.utm_campaign||'—'}</div></td>
          <td><span class="badge ${srcColor(c.source)}">${srcName(c.source)}</span></td>
          <td class="t-right">${c.spend?money(c.spend)+'đ':'—'}</td>
          <td class="t-center">${DB.customers.filter(x=>x.campaign===c.id).length}</td></tr>`).join('')}</tbody></table></div></div>
    </div>`;
}

/* =========================================================================
   DRILL-DOWN BÁO CÁO
   ========================================================================= */
function drillCampaign(cpid){
  const cp=DB.campaigns.find(c=>c.id===cpid);
  const leads=DB.customers.filter(c=>c.campaign===cpid);
  const courses=DB.courses.filter(co=>co.status!=='pending'&&leads.some(l=>l.id===co.customer_id));
  modal(`<div class="modal xwide"><div class="modal-h"><h3>${esc(cp.name)}</h3>
    <span class="badge ${srcColor(cp.source)}">${srcName(cp.source)}</span>
    <button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="grid g5" style="margin-bottom:14px">
      ${stat('Chi phí',cp.spend?moneyS(cp.spend)+'đ':'—','','banknote')}
      ${stat('Lead',leads.length,'','inbox')}
      ${stat('Đến khám',leads.filter(c=>['ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','PACKAGE_PENDING'].includes(c.status)).length,'','userCheck')}
      ${stat('Chốt gói',courses.length,'','package','ok')}
      ${stat('Doanh thu',moneyS(courses.reduce((a,b)=>a+b.paid,0))+'đ','','trendUp','ok')}
    </div>
    <div class="kv" style="margin-bottom:14px">
      <div class="k">Nhóm quảng cáo</div><div class="v">${esc(cp.adset)}</div>
      <div class="k">Mẫu quảng cáo</div><div class="v">${esc(cp.ad)}</div>
      <div class="k">UTM</div><div class="v mono" style="font-size:12px">utm_source=${cp.utm_source||'—'} &amp; utm_campaign=${cp.utm_campaign||'—'}</div>
    </div>
    <div class="sec-t">Danh sách lead của chiến dịch (${leads.length})</div>
    <div class="tbl-wrap" style="border:1px solid var(--line);border-radius:10px;max-height:340px;overflow-y:auto">
      <table style="min-width:820px"><thead><tr><th>Khách hàng</th><th>Điện thoại</th><th>Trạng thái</th><th>Phụ trách</th><th>Liệu trình</th><th class="t-right">Đã thu</th></tr></thead>
      <tbody>${leads.slice(0,40).map(c=>{const co=custCourses(c.id)[0];
        return `<tr class="row-link" onclick="closeModal();location.hash='#/customers/${c.id}'">
        <td class="t-name">${esc(c.name)}</td><td><span class="t-phone">${fmtPhone(c.phone)}</span></td>
        <td><span class="badge ${stColor(c.status)}">${stLabel(c.status)}</span></td>
        <td class="t-sub">${c.assigned_to?esc(userName(c.assigned_to)):'—'}</td>
        <td class="t-sub">${co?esc(pkgById(co.package_id).name):'—'}</td>
        <td class="t-right">${co?money(co.paid)+'đ':'—'}</td></tr>`;}).join('')}</tbody></table></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Đóng</button>
    <button class="btn primary" onclick="closeModal();exportCustomers(DB.customers.filter(c=>c.campaign==='${cpid}'))">${ic('download',16)} Xuất danh sách lead</button></div></div>`);
}
function drillRevenue(kind, key){
  let pays=[];
  if(kind==='pkg') pays=DB.payments.filter(p=>{const co=courseById(p.course_id); return co&&pkgById(co.package_id).name===key;});
  if(kind==='src') pays=DB.payments.filter(p=>srcName(custById(p.customer_id).source)===key);
  if(kind==='doc') pays=DB.payments.filter(p=>{const co=courseById(p.course_id); return co&&userName(co.doctor_id)===key;});
  const tot=pays.reduce((a,b)=>a+b.amount,0);
  modal(`<div class="modal wide"><div class="modal-h"><h3>Doanh thu: ${esc(key)}</h3>
    <span class="badge b-green nodot">${money(tot)}đ · ${pays.length} giao dịch</span>
    <button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="tbl-wrap" style="border:1px solid var(--line);border-radius:10px;max-height:420px;overflow-y:auto">
      <table style="min-width:760px"><thead><tr><th>Thời gian</th><th>Mã GD</th><th>Khách hàng</th><th>Liệu trình</th><th class="t-right">Số tiền</th><th>Hình thức</th><th>Người thu</th></tr></thead>
      <tbody>${pays.map(p=>`<tr><td>${fmtDT(p.at)}</td><td class="t-code">${p.ref}</td>
        <td class="row-link" onclick="closeModal();location.hash='#/customers/${p.customer_id}'"><span class="t-name">${esc(custById(p.customer_id).name)}</span></td>
        <td class="t-code">${(courseById(p.course_id)||{code:'—'}).code}</td>
        <td class="t-right" style="font-weight:700;color:${p.amount<0?'var(--danger)':'var(--ok)'}">${money(p.amount)}đ</td>
        <td>${(PAY_METHODS.find(m=>m.code===p.method)||{label:''}).label}</td><td class="t-sub">${esc(userName(p.by))}</td></tr>`).join('')
        ||`<tr><td colspan="7"><div class="empty"><div class="t">Chưa có giao dịch</div></div></td></tr>`}</tbody></table></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Đóng</button>
    <button class="btn primary" onclick="closeModal();exportPayments(${JSON.stringify(pays.map(p=>p.id))}.map(id=>DB.payments.find(x=>x.id===id)))">${ic('download',16)} Xuất giao dịch</button></div></div>`);
}

/* =========================================================================
   LƯU DỮ LIỆU CÁC FORM CÒN LẠI
   ========================================================================= */
function saveSession(sid){
  const s=DB.sessions.find(x=>x.id===sid), co=courseById(s.course_id);
  const g=id=>{ const e=$(id); return e?e.value:''; };
  const dt=g('#se-date'), tm=g('#se-time');
  if(dt) s.at=new Date(dt+'T'+(tm||'09:00'));
  const doc=DOCTORS.find(u=>u.name===g('#se-doc')); if(doc) s.doctor_id=doc.id;
  const tech=TECHS.find(u=>u.name===g('#se-tech')); if(tech) s.tech_id=tech.id;
  const svc=[...document.querySelectorAll('.se-svc.on')].map(x=>x.textContent.trim());
  if(svc.length) s.services=svc;
  s.before=g('#se-before'); s.intervention=g('#se-interv'); s.after=g('#se-after');
  s.reaction=g('#se-react'); s.note=g('#se-note'); s.recommend=g('#se-rec');
  au(new Date(),S.user.id,'update','treatment_sessions',sid,'—','buổi '+s.no+' · '+co.code);
  DB.audit.sort((a,b)=>b.at-a.at);
  toast('Đã lưu thông tin buổi '+s.no,'ok');
}
function savePkg(pid){
  const g=id=>$(id).value;
  const services=g('#pk-svc').split('\n').map(x=>x.trim()).filter(Boolean);
  const data={name:g('#pk-name').trim(), code:g('#pk-code').trim().toUpperCase(), group:g('#pk-group'),
    sessions:+g('#pk-n')||1, duration:+g('#pk-dur')||45, price:+g('#pk-price')||0, services, active:$('#pk-active').checked};
  if(!data.name||!data.code) return toast('Nhập tên và mã gói','err');
  if(!services.length) return toast('Nhập ít nhất một dịch vụ trong buổi','err');
  if(pid){ const p=pkgById(pid); const before=p.name+' · '+money(p.price);
    Object.assign(p,data); au(new Date(),S.user.id,'update','treatment_package_templates',pid,before,p.name+' · '+money(p.price));
    toast('Đã cập nhật gói '+p.code,'ok');
  } else {
    if(DB.packages.some(p=>p.code===data.code)) return toast('Mã gói đã tồn tại','err');
    const p=Object.assign({id:'PKG'+String(DB.packages.length+1).padStart(2,'0')},data);
    DB.packages.push(p); au(new Date(),S.user.id,'create','treatment_package_templates',p.id,'—',p.name+' · '+money(p.price));
    toast('Đã thêm gói '+p.code,'ok');
  }
  DB.audit.sort((a,b)=>b.at-a.at); closeModal(); render();
}
function saveMetric(mid){
  const g=id=>$(id).value;
  const data={name:g('#mt-name').trim(), code:g('#mt-code').trim().toUpperCase(), unit:g('#mt-unit').trim(),
    min:+g('#mt-min'), max:+g('#mt-max'), higher_is_better:g('#mt-dir')==='up', color:g('#mt-color'),
    desc:g('#mt-desc').trim(), active:$('#mt-active').checked};
  if(!data.name||!data.code) return toast('Nhập tên và mã chỉ số','err');
  if(data.max<=data.min) return toast('Giá trị lớn nhất phải lớn hơn giá trị nhỏ nhất','err');
  if(mid){ const m=metricById(mid); const before=m.name+' ['+m.min+'-'+m.max+'] '+(m.higher_is_better?'↑':'↓');
    Object.assign(m,data); au(new Date(),S.user.id,'update','clinical_metric_definitions',mid,before,m.name+' ['+m.min+'-'+m.max+']');
    toast('Đã cập nhật chỉ số '+m.code,'ok');
  } else {
    if(DB.metrics.some(m=>m.code===data.code)) return toast('Mã chỉ số đã tồn tại','err');
    const m=Object.assign({id:'M'+(DB.metrics.length+1)},data);
    DB.metrics.push(m); au(new Date(),S.user.id,'create','clinical_metric_definitions',m.id,'—',m.name);
    toast('Đã thêm chỉ số '+m.code,'ok');
  }
  DB.audit.sort((a,b)=>b.at-a.at); closeModal(); render();
}
function markNotif(id, link){
  const n=DB.notifications.find(x=>x.id===id); if(n) n.read=true;
  initChrome(); closeDrawer(); if(link) location.hash=link;
}
function markAllNotif(){
  DB.notifications.forEach(n=>n.read=true); initChrome(); closeDrawer();
  toast('Đã đánh dấu tất cả thông báo là đã đọc','ok');
}
/* Import lead: file mẫu + báo cáo lỗi thật */
function downloadLeadTemplate(){
  downloadCSV('Mau_import_lead_Vitalife.csv', DB.importSample.headers, DB.importSample.rows.slice(0,3));
  toast('Đã tải file mẫu import lead','ok');
}
function downloadLeadErrors(){
  const I=DB.importSample;
  const rows=I.rows.map((r,i)=>{
    const phone=normPhone(r[2]);
    let why='';
    if(!phone) why='Thiếu số điện thoại';
    else if(i===4) why='Số điện thoại trùng với dòng 1';
    return why?[i+1,...r,why]:null;
  }).filter(Boolean);
  downloadCSV('Loi_import_lead.csv', ['Dòng',...I.headers,'Lý do'], rows);
  toast('Đã tải báo cáo '+rows.length+' dòng lỗi (mẫu)','ok');
}
function downloadImportReport(){
  const R=DB.importSample.result;
  downloadCSV('Bao_cao_import_lead.csv', ['Chỉ tiêu','Số lượng'],
    [['Tổng số dòng',R.total],['Hợp lệ',R.valid],['Thiếu số điện thoại',R.missing_phone],
     ['Số điện thoại đã tồn tại',R.dup_existing],['Người thực hiện',S.user.name],['Thời gian',fmtDT(new Date())]]);
  toast('Đã tải báo cáo import','ok');
}

/* =========================================================================
   ĐĂNG KÝ ROUTE & MENU BỔ SUNG
   ========================================================================= */
ROUTES.push(
  [/^#\/admin\/staff-import$/, ()=>viewStaffImport()],
  [/^#\/admin\/assign$/, ()=>viewAdminAssign()],
  [/^#\/admin\/roles$/, ()=>viewAdminRoles()],
  [/^#\/admin\/settings$/, ()=>viewAdminSettings()],
);
(function extendNav(){
  const crm=NAV.find(g=>g.group==='CRM');
  crm.items.push({k:'assign', ic:'repeat', lb:'Phân bổ lead', to:'#/admin/assign', perm:'leads.assign',
    badge:()=>DB.customers.filter(c=>!c.assigned_to).length, hot:true});
  const admin=NAV.find(g=>g.group==='Quản trị');
  admin.items.splice(1,0,{k:'admin-roles', ic:'shield', lb:'Vai trò & quyền', to:'#/admin/roles', perm:'admin'});
  admin.items.push({k:'admin-settings', ic:'settings', lb:'Cấu hình hệ thống', to:'#/admin/settings', perm:'admin'});
})();

/* Nhắc lại quy tắc nghiệp vụ: chỉ Admin được phân bổ lead cho Telesales.
   Marketing chỉ import lead và theo dõi hiệu quả chiến dịch. */
if(PERMS.marketing.includes('leads.assign')) PERMS.marketing=PERMS.marketing.filter(p=>p!=='leads.assign');

/* =========================================================================
   BỔ SUNG: WALK-IN, KHOẢNG THỜI GIAN BÁO CÁO, TÌM KIẾM BÀN PHÍM, KHÓA TÀI KHOẢN
   ========================================================================= */
/* --- Khách vãng lai: tạo hồ sơ + đặt lịch + check-in ngay --- */
function openWalkIn(){
  modal(`<div class="modal wide"><div class="modal-h"><h3>Tiếp nhận khách vãng lai (walk-in)</h3>
    <button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="alert al-info">${ic('info',16)}<div>Nhập số điện thoại trước — nếu khách <b>đã có hồ sơ</b>, hệ thống dùng lại hồ sơ đó thay vì tạo mới.</div></div>
    <label class="fld" for="wi-phone"><span class="lb">Số điện thoại <span class="req">*</span></span>
      <input class="inp mono" id="wi-phone" type="tel" inputmode="tel" placeholder="0912 345 678" oninput="wiLookup()">
      <div class="hint" id="wi-hint">Nhập tối thiểu 9 chữ số.</div></label>
    <div id="wi-body"></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" onclick="doWalkIn()">${ic('checkCircle',16)} Tiếp nhận &amp; check-in</button></div></div>`);
}
function wiLookup(){
  const v=normPhone($('#wi-phone').value), hint=$('#wi-hint'), body=$('#wi-body');
  window._wiCust=null;
  if(v.length<9){ hint.className='hint'; hint.textContent='Nhập tối thiểu 9 chữ số.'; body.innerHTML=''; return; }
  const c=DB.customers.find(x=>normPhone(x.phone)===v);
  if(c){
    window._wiCust=c.id;
    hint.className='hint'; hint.innerHTML=ic('check',13)+' Đã tìm thấy hồ sơ sẵn có.';
    body.innerHTML=`<div class="alert al-ok">${ic('userCheck',16)}<div><b>${esc(c.name)}</b> · ${c.code} · ${c.gender==='M'?'Nam':'Nữ'} ${age(c.dob)} tuổi<br>
      <span class="t-sub">${esc(c.address)}</span><br><span class="t-sub">Trạng thái: ${stLabel(c.status)} · ${custCourses(c.id).length} liệu trình</span></div></div>
      ${wiCommon(c)}`;
  } else {
    hint.className='hint'; hint.innerHTML=ic('info',13)+' Chưa có hồ sơ — điền thông tin để tạo mới.';
    body.innerHTML=`<div class="grid g2">
        <label class="fld" for="wi-name"><span class="lb">Họ tên <span class="req">*</span></span><input class="inp" id="wi-name"></label>
        <label class="fld" for="wi-dob"><span class="lb">Năm sinh</span><input class="inp" id="wi-dob" type="number" min="1920" max="2026" placeholder="1980"></label>
      </div>
      <div class="grid g2">
        <label class="fld" for="wi-gender"><span class="lb">Giới tính</span><select class="inp" id="wi-gender"><option value="M">Nam</option><option value="F">Nữ</option></select></label>
        <label class="fld" for="wi-src"><span class="lb">Nguồn khách</span><select class="inp" id="wi-src">
          ${SOURCES.map(s=>`<option value="${s.code}" ${s.code==='walkin'?'selected':''}>${s.name}</option>`).join('')}</select></label>
      </div>
      <label class="fld" for="wi-addr"><span class="lb">Địa chỉ</span><input class="inp" id="wi-addr"></label>
      ${wiCommon(null)}`;
  }
}
function wiCommon(c){
  return `<div class="divider"></div>
    <div class="grid g3">
      <label class="fld" for="wi-need"><span class="lb">Lý do đến khám</span>
        <select class="inp" id="wi-need">${NHU_CAU.map(n=>`<option ${c&&c.need===n?'selected':''}>${n}</option>`).join('')}</select></label>
      <label class="fld" for="wi-doc"><span class="lb">Bác sĩ</span>
        <select class="inp" id="wi-doc">${DOCTORS.map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}</select></label>
      <label class="fld" for="wi-room"><span class="lb">Phòng</span>
        <select class="inp" id="wi-room">${DB.rooms.filter(r=>r.type==='exam').map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select></label>
    </div>`;
}
function doWalkIn(){
  const phone=normPhone($('#wi-phone').value);
  if(phone.length<9) return toast('Nhập số điện thoại hợp lệ','err');
  let c=window._wiCust?custById(window._wiCust):null;
  if(!c){
    const name=($('#wi-name')||{value:''}).value.trim();
    if(!name) return toast('Nhập họ tên khách hàng','err');
    const yr=+($('#wi-dob')||{value:0}).value||TODAY.getFullYear()-40;
    const n=DB.customers.length+1;
    c={id:'C'+String(n).padStart(4,'0'), code:'KH-'+String(100+n).padStart(6,'0'), name, phone, phone2:'', email:'',
      dob:new Date(yr,0,1), gender:($('#wi-gender')||{value:'M'}).value, address:($('#wi-addr')||{value:''}).value,
      job:'', contact_person:'', source:($('#wi-src')||{value:'walkin'}).value, campaign:'CP06',
      need:$('#wi-need').value, concern:$('#wi-need').value, note:'Khách vãng lai',
      status:'ARRIVED', lifecycle:'patient', assigned_to:null, created_at:new Date(),
      last_call:null, next_call:null, call_count:0, interest:5};
    DB.customers.push(c);
    tl(c.id,new Date(),'userPlus','blue','Tạo hồ sơ khách vãng lai tại quầy',srcName(c.source),S.user.name);
    au(new Date(),S.user.id,'create','customers',c.id,'—',c.name+' · walk-in');
  }
  const at=new Date();
  const a=addAppt({customer_id:c.id, at, status:'waiting', doctor:$('#wi-doc').value, room:$('#wi-room').value,
    type:'Khám lần đầu (walk-in)', booked_by:S.user.id, checkin_at:at});
  DB.appointments.sort((x,y)=>x.at-y.at);
  c.status='WAITING_DOCTOR'; c.lifecycle='patient';
  tl(c.id,at,'checkCircle','green','Lễ tân tiếp nhận khách vãng lai và check-in',
     (DB.rooms.find(r=>r.id===a.room)||{name:''}).name+' · '+userName(a.doctor), S.user.name);
  DB.timeline.sort((x,y)=>y.at-x.at); DB.audit.sort((x,y)=>y.at-x.at);
  closeModal(); toast(c.name+' đã được tiếp nhận và đưa vào hàng chờ bác sĩ','ok'); initChrome(); buildNav(); render();
}

/* --- Khoảng thời gian cho dashboard & báo cáo --- */
S.range='30d';
const RANGES={today:'Hôm nay','7d':'7 ngày qua','30d':'30 ngày qua',month:'Tháng này',all:'Toàn bộ dữ liệu'};
function rangeStart(){
  if(S.range==='today') return d(0,0,0);
  if(S.range==='7d') return d(-6,0,0);
  if(S.range==='30d') return d(-29,0,0);
  if(S.range==='month') return new Date(TODAY.getFullYear(),TODAY.getMonth(),1);
  return new Date(2000,0,1);
}
function inRange(dt){ return dt && new Date(dt)>=rangeStart() && new Date(dt)<=d(0,23,59); }
function setRange(v){ S.range=v; render(); }
function rangeSelect(){
  return `<label class="sr-only" for="rg-sel">Khoảng thời gian</label>
    <select class="inp" id="rg-sel" onchange="setRange(this.value)">
      ${Object.entries(RANGES).map(([k,v])=>`<option value="${k}" ${S.range===k?'selected':''}>${v}</option>`).join('')}</select>`;
}

/* --- Tìm kiếm: điều hướng bằng bàn phím --- */
document.addEventListener('keydown',e=>{
  const box=$('#search-res');
  if(!box||!box.classList.contains('on')) return;
  const items=[...box.querySelectorAll('.sr-item')];
  if(!items.length) return;
  const cur=items.indexOf(document.activeElement);
  if(e.key==='ArrowDown'){ e.preventDefault(); (items[cur+1]||items[0]).focus(); }
  if(e.key==='ArrowUp'){ e.preventDefault(); (items[cur-1]||items[items.length-1]).focus(); }
  if(e.key==='Enter'&&cur>=0){ e.preventDefault(); items[cur].click(); }
});

/* --- Khóa / mở khóa tài khoản --- */
function toggleUserActive(uid){
  const u=userById(uid);
  if(u.id===S.user.id) return toast('Không thể tự khóa tài khoản đang đăng nhập','err');
  confirmDlg(u.active?'Khóa tài khoản':'Mở khóa tài khoản',
    u.active?`Tài khoản <b>${esc(u.name)}</b> sẽ không đăng nhập được. Lead đang giữ vẫn thuộc về người này — hãy dùng <b>Chuyển lead</b> nếu cần bàn giao.`
            :`Cho phép <b>${esc(u.name)}</b> đăng nhập trở lại.`,
    ()=>{ const before=u.active?'active':'locked'; u.active=!u.active;
      au(new Date(),S.user.id,'update','users',uid,before,u.active?'active':'locked'); DB.audit.sort((a,b)=>b.at-a.at);
      toast(u.active?('Đã mở khóa '+u.name):('Đã khóa '+u.name),'ok'); render(); },
    u.active?'Khóa tài khoản':'Mở khóa', u.active);
}

/* --- Cấu hình: cơ sở / phòng / chiến dịch --- */
function openBranchForm(bid){
  const b=bid?DB.branches.find(x=>x.id===bid):{name:'',addr:'',hours:'7:00-12:00 | 13:00-20:00'};
  modal(`<div class="modal"><div class="modal-h"><h3>${bid?'Sửa':'Thêm'} cơ sở</h3>
    <button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <label class="fld" for="br-name"><span class="lb">Tên cơ sở <span class="req">*</span></span><input class="inp" id="br-name" value="${esc(b.name)}"></label>
    <label class="fld" for="br-addr"><span class="lb">Địa chỉ <span class="req">*</span></span><input class="inp" id="br-addr" value="${esc(b.addr)}"></label>
    <label class="fld" for="br-hours"><span class="lb">Giờ làm việc</span><input class="inp" id="br-hours" value="${esc(b.hours||'')}"></label>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" onclick="saveBranch('${bid||''}')">Lưu</button></div></div>`);
}
function saveBranch(bid){
  const name=$('#br-name').value.trim(), addr=$('#br-addr').value.trim(), hours=$('#br-hours').value.trim();
  if(!name||!addr) return toast('Nhập tên và địa chỉ cơ sở','err');
  if(bid){ Object.assign(DB.branches.find(x=>x.id===bid),{name,addr,hours});
    au(new Date(),S.user.id,'update','branches',bid,'—',name); }
  else { const b={id:'B'+(DB.branches.length+1),name,addr,hours}; DB.branches.push(b);
    au(new Date(),S.user.id,'create','branches',b.id,'—',name); }
  DB.audit.sort((a,b)=>b.at-a.at); closeModal(); toast('Đã lưu cơ sở','ok'); render();
}
function openRoomForm(rid){
  const r=rid?DB.rooms.find(x=>x.id===rid):{name:'',branch:'B1',type:'exam'};
  const types={exam:'Phòng khám',therapy:'Phòng trị liệu',gym:'Phòng tập PHCN'};
  modal(`<div class="modal"><div class="modal-h"><h3>${rid?'Sửa':'Thêm'} phòng chức năng</h3>
    <button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <label class="fld" for="rm-name"><span class="lb">Tên phòng <span class="req">*</span></span><input class="inp" id="rm-name" value="${esc(r.name)}"></label>
    <div class="grid g2">
      <label class="fld" for="rm-branch"><span class="lb">Cơ sở</span><select class="inp" id="rm-branch">
        ${DB.branches.map(b=>`<option value="${b.id}" ${r.branch===b.id?'selected':''}>${b.name}</option>`).join('')}</select></label>
      <label class="fld" for="rm-type"><span class="lb">Loại phòng</span><select class="inp" id="rm-type">
        ${Object.entries(types).map(([k,v])=>`<option value="${k}" ${r.type===k?'selected':''}>${v}</option>`).join('')}</select></label>
    </div>
    <label style="display:flex;gap:9px;align-items:center;font-size:13.5px"><input type="checkbox" id="rm-overlap" ${r.type==='gym'?'checked':''}>
      Cho phép nhiều lịch trùng giờ (phòng tập nhóm)</label>
    <div class="hint" style="margin-top:8px">Nếu không bật, hệ thống sẽ chặn đặt hai lịch cùng phòng trong cùng khung 30 phút.</div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" onclick="saveRoom('${rid||''}')">Lưu</button></div></div>`);
}
function saveRoom(rid){
  const name=$('#rm-name').value.trim();
  if(!name) return toast('Nhập tên phòng','err');
  const data={name, branch:$('#rm-branch').value, type:$('#rm-type').value, overlap:$('#rm-overlap').checked};
  if(rid){ Object.assign(DB.rooms.find(x=>x.id===rid),data); au(new Date(),S.user.id,'update','rooms',rid,'—',name); }
  else { const r=Object.assign({id:'R'+(DB.rooms.length+1)},data); DB.rooms.push(r);
    au(new Date(),S.user.id,'create','rooms',r.id,'—',name); }
  DB.audit.sort((a,b)=>b.at-a.at); closeModal(); toast('Đã lưu phòng','ok'); render();
}
function openCampaignForm(cid){
  const c=cid?DB.campaigns.find(x=>x.id===cid):{name:'',source:'facebook',adset:'',ad:'',spend:0,utm_source:'',utm_campaign:''};
  modal(`<div class="modal"><div class="modal-h"><h3>${cid?'Sửa':'Thêm'} chiến dịch quảng cáo</h3>
    <button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <label class="fld" for="cp-name"><span class="lb">Tên chiến dịch <span class="req">*</span></span><input class="inp" id="cp-name" value="${esc(c.name)}"></label>
    <div class="grid g2">
      <label class="fld" for="cp-src"><span class="lb">Nguồn</span><select class="inp" id="cp-src">
        ${SOURCES.map(x=>`<option value="${x.code}" ${c.source===x.code?'selected':''}>${x.name}</option>`).join('')}</select></label>
      <label class="fld" for="cp-spend"><span class="lb">Chi phí (đ)</span><input class="inp" id="cp-spend" type="number" step="100000" value="${c.spend}"></label>
    </div>
    <div class="grid g2">
      <label class="fld" for="cp-adset"><span class="lb">Nhóm quảng cáo</span><input class="inp" id="cp-adset" value="${esc(c.adset)}"></label>
      <label class="fld" for="cp-ad"><span class="lb">Mẫu quảng cáo</span><input class="inp" id="cp-ad" value="${esc(c.ad)}"></label>
    </div>
    <div class="grid g2">
      <label class="fld" for="cp-us"><span class="lb">utm_source</span><input class="inp mono" id="cp-us" value="${esc(c.utm_source)}"></label>
      <label class="fld" for="cp-uc"><span class="lb">utm_campaign</span><input class="inp mono" id="cp-uc" value="${esc(c.utm_campaign)}"></label>
    </div>
    <div class="alert al-info">${ic('info',16)}<div>Chi phí dùng để tính <b>CPL</b> và <b>ROAS</b> trong báo cáo Marketing.
      Khi tích hợp Facebook Lead Ads, các trường UTM sẽ được điền tự động.</div></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" onclick="saveCampaign('${cid||''}')">Lưu</button></div></div>`);
}
function saveCampaign(cid){
  const name=$('#cp-name').value.trim();
  if(!name) return toast('Nhập tên chiến dịch','err');
  const data={name, source:$('#cp-src').value, spend:+$('#cp-spend').value||0, adset:$('#cp-adset').value.trim(),
    ad:$('#cp-ad').value.trim(), utm_source:$('#cp-us').value.trim(), utm_campaign:$('#cp-uc').value.trim()};
  if(cid){ Object.assign(DB.campaigns.find(x=>x.id===cid),data); au(new Date(),S.user.id,'update','campaigns',cid,'—',name); }
  else { const c=Object.assign({id:'CP'+String(DB.campaigns.length+1).padStart(2,'0')},data); DB.campaigns.push(c);
    au(new Date(),S.user.id,'create','campaigns',c.id,'—',name); }
  DB.audit.sort((a,b)=>b.at-a.at); closeModal(); toast('Đã lưu chiến dịch','ok'); render();
}

/* =========================================================================
   MOBILE: chuyển bảng dữ liệu thành danh sách thẻ (không phải cuộn ngang)
   Nhãn cột lấy tự động từ <th> nên không cần sửa markup từng bảng.
   ========================================================================= */
function tablesToCards(root){
  root.querySelectorAll('table').forEach(t=>{
    t.classList.remove('as-cards');
    const wrap=t.closest('.tbl-wrap'); if(wrap) wrap.classList.remove('cards');
    if(t.classList.contains('no-cards')) return;
    if(!isMobile()) return;
    const ths=[...t.querySelectorAll('thead th')].map(th=>th.textContent.replace(/\s+/g,' ').trim());
    if(!ths.length) return;
    const rows=[...t.querySelectorAll('tbody tr')];
    if(!rows.length) return;
    t.classList.add('as-cards');
    if(wrap) wrap.classList.add('cards');
    rows.forEach(tr=>{
      const tds=[...tr.children];
      if(tds.length===1&&tds[0].hasAttribute('colspan')){ tr.classList.add('full-row'); return; }
      let head=false;
      tds.forEach((td,i)=>{
        const lb=ths[i]||'';
        const onlyBox=td.children.length===1&&/^(INPUT)$/.test(td.children[0].tagName)&&!td.textContent.trim();
        if(onlyBox){ td.classList.add('cell-check'); return; }
        if(!td.textContent.trim()&&!td.querySelector('button,a,svg')){ td.classList.add('cell-empty'); return; }
        if(!head){ td.classList.add('cell-head'); head=true; return; }
        if(lb) td.setAttribute('data-label',lb);
        if(td.querySelector('.row-actions,.btn')) td.classList.add('cell-actions');
      });
    });
  });
}
/* Đóng menu / thanh tìm kiếm khi xoay ngang hoặc phóng to màn hình */
let _lastMobile=null;
window.addEventListener('resize',()=>{
  const m=isMobile();
  if(_lastMobile===null){ _lastMobile=m; return; }
  if(m!==_lastMobile){ _lastMobile=m; toggleSidebar(false); toggleSearch(false); render(); }
});

/* ================= KHỞI ĐỘNG ỨNG DỤNG ================= */
bootApp();
