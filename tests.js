/* =========================================================================
   VITALIFE CLINIC MANAGER — KIỂM THỬ NGHIỆP VỤ
   Chạy bằng: index.html?test=1  (kết quả in ra console + bảng trên màn hình)
   hoặc gọi runVitalifeTests() trong console.

   Bám sát 10 tiêu chí nghiệm thu trong yêu cầu. Test chạy trên chính DB
   trong bộ nhớ nên sau khi chạy hãy F5 để về dữ liệu seed ban đầu.
   ========================================================================= */
(function(){
  const T=[]; let only=null;
  function test(name, fn){ T.push({name, fn}); }
  function ok(cond, msg){ if(!cond) throw new Error(msg||'Kỳ vọng đúng nhưng nhận được sai'); }
  function eq(a,b,msg){ if(a!==b) throw new Error((msg||'Giá trị không khớp')+': '+JSON.stringify(a)+' ≠ '+JSON.stringify(b)); }
  function has(hay, needle, msg){ if(String(hay).indexOf(needle)<0) throw new Error((msg||'Không tìm thấy')+': "'+needle+'"'); }

  /* ---- tiện ích: đăng nhập giả theo vai trò, không đụng tới UI ---- */
  function asRole(code){
    const u=DB.users.find(x=>x.roles.includes(code));
    if(!u) throw new Error('Không có tài khoản vai trò '+code);
    S.user=u; return u;
  }
  function asUser(u){ S.user=u; return u; }
  /* toast() cần DOM; khi chạy test ta chỉ cần nó không ném lỗi */
  function silent(fn){ const t=window.toast; window.toast=function(){}; try{ return fn(); } finally { window.toast=t; } }

  /* ================= TEST 1 — Lưu bệnh án ================= */
  test('TEST 1 · Bác sĩ nhập bệnh án → Lưu → mở lại vẫn còn dữ liệu', ()=>{
    const doc=asRole('doctor');
    const c=DB.customers.find(x=>x.lifecycle==='patient');
    const e=mkEncounter(c,new Date(),doc.id);
    e.status='draft'; e.saved_at=null; e.finalized_at=null; e._dirty=false;
    e.reason=''; e.symptoms=''; e.diagnosis='';
    DB.encounters.push(e);

    eq(encState(e),'unsaved','Hồ sơ mới phải ở trạng thái Chưa lưu');
    ok(!encPrintable(e),'Chưa lưu thì không được in');

    encEdit(e.id,'reason','Đau thắt lưng 3 tháng');
    encEdit(e.id,'symptoms','Tê lan mặt sau đùi trái');
    encEdit(e.id,'diagnosis','Thoát vị đĩa đệm L4-L5');
    eq(encState(e),'unsaved','Đang gõ dở phải là Chưa lưu');

    silent(()=>saveEnc(e.id,true));
    eq(encState(e),'saved','Sau khi bấm Lưu phải là Đã lưu');
    ok(!!e.saved_at,'Phải ghi nhận thời điểm lưu');
    ok(encPrintable(e),'Đã lưu thì in / xuất được');

    /* "đóng màn hình rồi mở lại" = đọc lại bản ghi từ DB qua id */
    const again=encById(e.id);
    eq(again.reason,'Đau thắt lưng 3 tháng','Dữ liệu phải còn nguyên sau khi mở lại');
    eq(again.symptoms,'Tê lan mặt sau đùi trái');
    eq(encState(again),'saved');

    /* chốt bệnh án vẫn hoạt động như cũ */
    again.status='final'; again.finalized_at=new Date(); again._dirty=false;
    eq(encState(again),'final','Sau khi chốt phải là Đã chốt bệnh án');
    window._t1enc=again.id;
  });

  /* ================= TEST 2 — Xuất PDF ================= */
  test('TEST 2 · PDF đúng bệnh nhân và đúng lần khám', ()=>{
    asRole('doctor');
    const e=encById(window._t1enc)||DB.encounters[0];
    const c=custById(e.customer_id);
    const html=encounterDocHTML(e.id);
    has(html,'HỒ SƠ KHÁM BỆNH','PDF phải có tiêu đề hồ sơ');
    has(html,esc(c.name),'PDF phải có tên đúng bệnh nhân');
    has(html,c.code,'PDF phải có mã khách hàng');
    has(html,e.id,'PDF phải có mã lần khám');
    has(html,esc(e.reason),'PDF phải chứa lý do khám của chính lần khám này');
    has(html,'@page','PDF phải khai báo khổ giấy A4');
    has(html,esc(DB.clinic.name),'PDF phải có tiêu đề phòng khám');
    /* không được lẫn dữ liệu của lần khám khác */
    const other=DB.encounters.find(x=>x.id!==e.id && x.customer_id!==e.customer_id);
    if(other && other.reason && other.reason!==e.reason)
      ok(html.indexOf(esc(other.reason))<0,'PDF không được chứa dữ liệu lần khám khác');
  });

  /* ================= TEST 3 — Mua thêm gói ================= */
  test('TEST 3 · Khách có gói A → thêm gói B → cả hai cùng tồn tại', ()=>{
    asRole('manager');                       // manager có treatment.purchase + approve
    const coA=DB.courses.find(x=>x.status==='active');
    const cid=coA.customer_id;
    const beforeIds=custCourses(cid).map(x=>x.id);
    const beforeA={done:coA.done_sessions, total:coA.total_sessions, status:coA.status, area:coA.area};
    const sessBefore=courseSessions(coA.id).length;

    const coB=silent(()=>createCourse(cid,{package_id:'PKG03', area:'Khớp vai', total_sessions:8,
      discount:0, doctor_id:coA.doctor_id, diagnosis:'Viêm quanh khớp vai', activate:true}));
    ok(!!coB,'Phải tạo được gói mới');
    ok(coB.id!==coA.id,'Gói mới phải là bản ghi khác');

    const after=custCourses(cid);
    eq(after.length, beforeIds.length+1, 'Số gói của khách phải tăng đúng 1');
    ok(after.some(x=>x.id===coA.id),'Gói cũ phải còn nguyên trong danh sách');

    /* gói cũ không bị ghi đè */
    eq(coA.done_sessions, beforeA.done,'Số buổi đã dùng của gói cũ không được đổi');
    eq(coA.total_sessions, beforeA.total,'Tổng buổi của gói cũ không được đổi');
    eq(coA.status, beforeA.status,'Trạng thái gói cũ không được đổi');
    eq(coA.area, beforeA.area,'Vùng điều trị gói cũ không được đổi');
    eq(courseSessions(coA.id).length, sessBefore,'Buổi của gói cũ không được đổi');

    /* gói mới giữ đủ thuộc tính nghiệp vụ */
    eq(coB.area,'Khớp vai','Gói mới giữ vùng điều trị riêng');
    eq(coB.total_sessions,8);
    eq(coB.done_sessions,0);
    eq(courseRemaining(coB),8,'Số buổi còn lại phải đúng');
    ok(!!coB.start_date,'Gói đã kích hoạt phải có ngày bắt đầu');
    ok(!!coB.end_date_est,'Phải có ngày dự kiến kết thúc');
    eq(courseSessions(coB.id).length,8,'Phải sinh đủ lịch sử buổi cho gói mới');
    ok(coB.total>0,'Phải có thông tin giá');

    /* id không trùng */
    const ids=DB.courses.map(x=>x.id);
    eq(new Set(ids).size, ids.length,'Mã liệu trình không được trùng');
    const sids=DB.sessions.map(x=>x.id);
    eq(new Set(sids).size, sids.length,'Mã buổi điều trị không được trùng');

    /* mua thêm gói CÙNG LOẠI cho vùng khác vẫn được */
    const coC=silent(()=>createCourse(cid,{package_id:coA.package_id, area:'Khớp gối', total_sessions:5, activate:false}));
    ok(!!coC && coC.id!==coA.id,'Phải mua thêm được gói cùng loại');
    eq(custCourses(cid).length, beforeIds.length+2);
    eq(coC.status,'pending','Không có quyền/không tick kích hoạt thì gói ở trạng thái Chờ kích hoạt');

    /* audit */
    ok(DB.audit.some(a=>a.action==='add_package'&&a.entity_id===coB.id),'Phải ghi audit khi thêm gói');
    window._t3 = {cid, a:coA.id, b:coB.id};
  });

  /* ================= TEST 4 — Quyền xem số điện thoại ================= */
  test('TEST 4 · Không có customer.view_phone thì không xem được SĐT đầy đủ', ()=>{
    const c=DB.customers.find(x=>normPhone(x.phone).length===10);
    const real=normPhone(c.phone);

    asRole('tech');                                  // KTV: không có customer.view_phone
    ok(!can('customer.view_phone'),'KTV không được cấp quyền xem SĐT');
    const masked=fmtPhone(c.phone);
    ok(masked.indexOf('*')>=0,'SĐT phải bị che');
    ok(masked.replace(/\s/g,'')!==real,'Không được hiển thị số đầy đủ');
    eq(masked.slice(0,2), real.slice(0,2),'Vẫn giữ 2 số đầu để nhận diện');
    eq(masked.slice(-2), real.slice(-2),'Vẫn giữ 2 số cuối để nhận diện');
    eq(masked.length, real.length,'Độ dài mặt nạ khớp độ dài số thật');

    /* dữ liệu gốc trong DB không bị hỏng */
    eq(normPhone(c.phone), real,'Che hiển thị nhưng không được sửa dữ liệu gốc');

    asRole('reception');                             // Lễ tân: có quyền
    ok(can('customer.view_phone'));
    eq(normPhone(fmtPhone(c.phone)), real,'Có quyền thì thấy số đầy đủ');
  });

  /* ================= TEST 5 — Quyền xuất dữ liệu ================= */
  test('TEST 5 · Không có quyền export thì backend từ chối, không chỉ ẩn nút', ()=>{
    asRole('tech');
    ok(!can('data.export'),'KTV không được cấp quyền xuất dữ liệu');
    const auBefore=DB.audit.length;
    /* gọi thẳng hàm như khi người dùng gọi API trực tiếp, bỏ qua giao diện */
    _exportCfg=null;
    const r=silent(()=>openExport({title:'x', filename:'x', columns:[{k:'a',lb:'A'}], rows:[{a:1}]}));
    eq(r, undefined, 'openExport phải dừng ngay');
    eq(_exportCfg, null, 'Không được nhận cấu hình xuất khi thiếu quyền');
    ok(DB.audit.length>auBefore,'Phải ghi thêm bản ghi nhật ký');
    ok(DB.audit.some(x=>x.action==='denied'&&x.entity_id==='data.export'),'Phải ghi nhật ký từ chối quyền data.export');

    /* doExport cũng phải tự kiểm tra quyền, không tin vào việc nút đã bị ẩn */
    _exportCfg={title:'x', filename:'x', entity:'customers', columns:[{k:'a',lb:'A'}], rows:[{a:1}]};
    let downloaded=false; const dl=window.downloadCSV; window.downloadCSV=()=>{downloaded=true;};
    silent(()=>doExport());
    window.downloadCSV=dl; _exportCfg=null;
    ok(!downloaded,'doExport gọi trực tiếp cũng phải bị chặn, không được tải file');

    asRole('reception');
    ok(can('data.export'),'Lễ tân được xuất dữ liệu');
  });

  /* ============ TEST 6 & 7 — check-in hiện ở cả 2 nơi, không trùng visit ============ */
  test('TEST 6+7 · Check-in → hiện ở hàng chờ bác sĩ VÀ luồng check-out, không tạo visit trùng', ()=>{
    asRole('reception');
    const ap=todayAppts().find(a=>['booked','confirmed'].includes(a.status));
    ok(!!ap,'Cần có lịch hẹn chưa check-in để kiểm thử');
    const cid=ap.customer_id;
    const visitsBefore=DB.appointments.filter(a=>a.customer_id===cid).length;
    const custBefore=DB.customers.length;

    const tech=techList()[0], tvv=consultantList()[0], doc=doctorList()[0];
    const a=silent(()=>checkInVisit(ap.id,{doctor:doc.id, room:'R1', technician_id:tech.id,
      consultant_id:tvv.id, reason:'Đau vai gáy', flow:'doctor'}));
    ok(!!a,'Check-in phải thành công');
    eq(a.id, ap.id, 'Phải dùng lại đúng bản ghi visit, không tạo mới');
    eq(DB.appointments.filter(x=>x.customer_id===cid).length, visitsBefore,'TEST 7: không được sinh visit trùng');
    eq(DB.customers.length, custBefore,'Không được tạo khách hàng trùng');

    /* TEST 6: xuất hiện trong hàng chờ bác sĩ */
    const docQueue=todayAppts().filter(x=>x.status==='waiting');
    ok(docQueue.some(x=>x.id===a.id),'TEST 6: khách phải nằm trong hàng chờ bác sĩ');

    /* TEST 7: đồng thời nằm trong luồng check-out */
    const checkoutQueue=todayAppts().filter(isPresent);
    ok(checkoutQueue.some(x=>x.id===a.id),'TEST 7: khách phải nằm trong danh sách chờ check-out');
    eq(checkoutQueue.filter(x=>x.id===a.id).length,1,'Chỉ được xuất hiện đúng 1 lần');

    ok(DB.audit.some(x=>x.action==='checkin'&&x.entity_id===a.id),'Phải ghi audit check-in');
    window._t6ap=a.id;
  });

  /* ================= TEST 8 — luồng B: không qua bác sĩ ================= */
  test('TEST 8 · Khách không qua bác sĩ vẫn trị liệu → check-out được', ()=>{
    asRole('reception');
    const ap=todayAppts().find(a=>['booked','confirmed'].includes(a.status)&&a.id!==window._t6ap);
    ok(!!ap,'Cần thêm một lịch hẹn để kiểm thử luồng B');
    const a=silent(()=>checkInVisit(ap.id,{flow:'treatment', technician_id:techList()[0].id}));
    ok(!!a);
    eq(a.flow,'treatment');
    ok(todayAppts().filter(isPresent).some(x=>x.id===a.id),'Vẫn phải nằm trong luồng check-out');
    ok(todayAppts().filter(x=>x.status==='waiting').some(x=>x.id===a.id),'Vẫn hiển thị cho bác sĩ biết khách đang có mặt');

    silent(()=>startTreatment(a.id));
    eq(a.status,'in_treatment','Chuyển thẳng sang trị liệu không cần qua bác sĩ');
    ok(!a.exam_start,'Không được tự tạo lượt khám bác sĩ');
    ok(isPresent(a),'Đang trị liệu vẫn là "đang có mặt"');

    /* check-out trực tiếp từ trạng thái trị liệu */
    const dlgOk=(()=>{ const orig=window.confirmDlg; let fn=null;
      window.confirmDlg=(t,m,cb)=>{fn=cb;}; silent(()=>checkOut(a.id)); window.confirmDlg=orig;
      if(!fn) return false; silent(fn); return true; })();
    ok(dlgOk,'Phải mở hộp thoại xác nhận check-out');
    eq(a.status,'done','Check-out thành công từ trạng thái trị liệu');
    ok(!!a.checkout_at,'Phải ghi giờ check-out');
    ok(DB.audit.some(x=>x.action==='checkout'&&x.entity_id===a.id),'Phải ghi audit check-out');
  });

  /* ================= TEST 9 — KTV & Tư vấn viên ================= */
  test('TEST 9 · Check-in chọn KTV + tư vấn viên → mở lại vẫn đúng', ()=>{
    asRole('reception');
    const ap=todayAppts().find(a=>['booked','confirmed'].includes(a.status));
    ok(!!ap,'Cần lịch hẹn chưa check-in');
    const tech=techList()[1]||techList()[0];
    const tvv=consultantList()[1]||consultantList()[0];
    const a=silent(()=>checkInVisit(ap.id,{technician_id:tech.id, consultant_id:tvv.id, flow:'doctor'}));
    ok(!!a);

    /* đọc lại bản ghi từ DB như khi mở lại màn hình */
    const again=DB.appointments.find(x=>x.id===ap.id);
    eq(again.technician_id, tech.id,'KTV đã chọn phải được lưu vào visit');
    eq(again.consultant_id, tvv.id,'Tư vấn viên đã chọn phải được lưu vào visit');
    has(visitStaffLine(again), tech.name.replace('KTV. ',''),'Màn hình phải hiển thị lại KTV');
    has(visitStaffLine(again), tvv.name,'Màn hình phải hiển thị lại tư vấn viên');

    /* danh sách nhân sự lấy động từ DB.users, không hard-code */
    ok(techList().every(u=>u.roles.includes('tech')),'Chỉ hiện nhân sự có vai trò KTV');
    ok(consultantList().every(u=>u.roles.some(r=>r==='telesales'||r==='op')),'Chỉ hiện nhân sự Telesales/CSKH');
    const newTech={id:'U99',name:'KTV. Nhân sự mới',email:'moi@vitalife.vn',roles:['tech'],active:true,branch:'B1'};
    DB.users.push(newTech);
    ok(techList().some(u=>u.id==='U99'),'Nhân sự mới thêm phải xuất hiện ngay trong dropdown');
    DB.users.pop();

    /* đổi KTV / tư vấn viên có ghi audit */
    const t2=techList()[0];
    const before=again.technician_id;
    again.technician_id=t2.id;
    au(new Date(),S.user.id,'change_technician','appointments',again.id,before,t2.id);
    ok(DB.audit.some(x=>x.action==='change_technician'),'Đổi KTV phải ghi audit');
  });

  /* ================= TEST 10 — không hỏng chức năng cũ ================= */
  test('TEST 10 · Toàn bộ màn hình cũ vẫn render được với mọi vai trò', ()=>{
    const routes=['#/dashboard','#/leads','#/telesales','#/customers','#/calendar','#/reception',
      '#/doctor','#/treatment','#/sessions','#/op','#/payments','#/reports','#/reports/telesales',
      '#/reports/marketing','#/reports/revenue','#/admin/users','#/admin/packages',
      '#/admin/clinical-metrics','#/admin/audit-log','#/admin/roles','#/admin/settings','#/admin/assign'];
    const errs=[];
    DB.roles.forEach(r=>{
      const u=DB.users.find(x=>x.roles.includes(r.code)); if(!u) return;
      asUser(u);
      routes.forEach(h=>{
        const rt=ROUTES.find(([re])=>re.test(h)); if(!rt) return;
        try{ const out=rt[1](h.match(rt[0])); if(typeof out!=='string'||!out.length) errs.push(r.code+' '+h+': rỗng'); }
        catch(e){ errs.push(r.code+' '+h+': '+e.message); }
      });
      /* các màn hình chi tiết */
      try{ asUser(u); viewCustomer360(DB.customers[0].id); }catch(e){ errs.push(r.code+' customer360: '+e.message); }
      try{ viewCourse(DB.courses.find(x=>x.status==='active').id); }catch(e){ errs.push(r.code+' course: '+e.message); }
      try{ viewEncounter(DB.encounters[0].id); }catch(e){ errs.push(r.code+' encounter: '+e.message); }
    });
    ok(errs.length===0,'Có màn hình lỗi:\n - '+errs.join('\n - '));
  });

  /* ================= phụ: các tab hồ sơ 360 ================= */
  test('BỔ SUNG · Tab liệu trình hiển thị đủ nhiều gói và chuyển được', ()=>{
    asRole('manager');
    const t3=window._t3; ok(!!t3,'Cần TEST 3 chạy trước');
    const cos=custCourses(t3.cid);
    S.filters.coSel=t3.b;
    const html=courseTabBlock(t3.cid, cos);
    has(html,'Các gói trị liệu');
    has(html,courseById(t3.a).code.split('-')[0],'Phải liệt kê gói cũ');
    ok((html.match(/class="chip/g)||[]).length>=cos.length,'Mỗi gói một chip để chuyển qua lại');
    has(html,'Mua thêm gói','Phải có nút mua thêm gói cho vai trò có quyền');
    asRole('tech');
    ok(courseTabBlock(t3.cid,cos).indexOf('Mua thêm gói')<0,'Vai trò không có quyền thì ẩn nút mua thêm');
  });

  /* ================= chạy ================= */
  /* Một số hàm nghiệp vụ (startTreatment, checkOut…) gọi render() ở cuối.
     Khi đang đứng ở route #/tests, render() vẽ lại chính báo cáo này — nếu
     không chặn tái nhập thì bộ test sẽ tự gọi lại chính nó nhiều lần. */
  let _running=false;
  window.runVitalifeTests=function(){
    if(_running) return _lastRun||{pass:0,total:0,results:[]};
    _running=true;
    try{ return _runAll(); } finally { _running=false; }
  };
  function _runAll(){
    const res=[]; let pass=0;
    const savedUser=S.user;
    T.forEach(t=>{
      try{ t.fn(); res.push({name:t.name, ok:true}); pass++; }
      catch(e){ res.push({name:t.name, ok:false, err:e.message}); }
    });
    S.user=savedUser;
    console.log('%c VITALIFE — KIỂM THỬ NGHIỆP VỤ ','background:#0167B8;color:#fff;font-weight:700');
    res.forEach(r=>console.log((r.ok?'%c PASS ':'%c FAIL ')+' '+r.name,
      'background:'+(r.ok?'#0EBB98':'#EF4444')+';color:#fff', r.err||''));
    console.log(pass+'/'+T.length+' test đạt');
    return {pass, total:T.length, results:res};
  }
  /* Màn hình báo cáo — đăng ký như một route bình thường của ứng dụng
     (#/tests), không nằm trong menu để không làm rối giao diện demo. */
  let _lastRun=null;
  window.testReportHTML=function(rerun){
    if(_running) return `<div class="card"><div class="empty"><div class="t">Đang chạy kiểm thử…</div></div></div>`;
    const r=(rerun||!_lastRun)?(_lastRun=runVitalifeTests()):_lastRun;
    const bad=r.results.filter(x=>!x.ok).length;
    return head('Kiểm thử nghiệp vụ', r.pass+'/'+r.total+' test đạt · chạy trên dữ liệu giả lập trong bộ nhớ · F5 để khôi phục dữ liệu seed',
      `<button class="btn primary" onclick="testReportRerun()">${ic('refresh',16)} Chạy lại</button>`)
    + `<div class="grid g3" style="margin-bottom:14px">
        ${stat('Tổng số test',r.total,'','clipboard')}
        ${stat('Đạt',r.pass,'','checkCircle','up')}
        ${stat('Không đạt',bad,bad?'Cần sửa':'','alert',bad?'dn':'up')}
      </div>
      <div class="card"><div class="card-b tight">${r.results.map(x=>`<div class="queue-item">
        <span class="badge ${x.ok?'b-green':'b-red'}">${x.ok?'PASS':'FAIL'}</span>
        <div style="flex:1;min-width:0"><div style="font-weight:650">${esc(x.name)}</div>
        ${x.err?`<div class="t-sub" style="white-space:pre-wrap;color:var(--danger)">${esc(x.err)}</div>`:''}</div></div>`).join('')}
      </div></div>`;
  };
  window.testReportRerun=function(){ _lastRun=null; render(); };
  window.renderTestReport=function(){ location.hash='#/tests'; render(); return _lastRun||runVitalifeTests(); };
  if(typeof ROUTES!=='undefined') ROUTES.push([/^#\/tests$/, ()=>testReportHTML()]);

  /* tự chạy khi mở index.html?test=1 */
  window.addEventListener('load',()=>{
    if(!/[?&]test=1/.test(location.search)) return;
    setTimeout(()=>{ if(!S.user) loginAs('U01'); location.hash='#/tests'; render(); }, 400);
  });
})();
