/* ================= APP CORE ================= */
const S = { user:null, route:'#/dashboard', filters:{}, sel:new Set() };
const $ = s => document.querySelector(s);
const el = (h) => { const t=document.createElement('template'); t.innerHTML=h.trim(); return t.content.firstElementChild; };
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const initials = n => n.split(' ').filter(w=>!/^(BS\.|KTV\.)$/.test(w)).slice(-2).map(w=>w[0]).join('').toUpperCase();

/* ---------- RBAC ---------- */
/* RBAC: '*' = toàn quyền; 'x.*' = toàn bộ quyền con của x; còn lại là khớp chính xác.
   Quyền cha KHÔNG tự động cấp quyền con (VD: có 'leads' không đồng nghĩa được 'leads.assign'). */
const PERMS = {
  admin:['*'],
  marketing:['dashboard','leads','leads.import','customers','customers.read','reports','reports.marketing','calendar','calendar.read','data.export'],
  telesales:['dashboard','telesales','customers','customers.read','calendar','calendar.book','calendar.read','leads.read','customer.view_phone','data.export'],
  op:['dashboard','op','customers','customers.read','calendar','calendar.book','calendar.read','treatment','treatment.read','treatment.purchase','customer.view_phone'],
  reception:['dashboard','reception','calendar','calendar.book','calendar.read','customers','customers.read','customers.edit_admin','payments','treatment.purchase','customer.view_phone','data.export'],
  doctor:['dashboard','doctor','customers','customers.read','medical','medical.finalize','treatment','treatment.propose','treatment.sessions','calendar','calendar.read','patients','customer.view_phone','data.export'],
  manager:['dashboard','treatment','treatment.approve','treatment.read','treatment.purchase','reports','reports.marketing','customers','customers.read','calendar','calendar.read','payments.read','data.export'],
  tech:['dashboard','treatment','treatment.sessions','treatment.read','customers.read','calendar','calendar.read'],
};
function can(p){
  if(!S.user) return false;
  return S.user.roles.some(r=>{
    const list=PERMS[r]||[];
    return list.includes('*') || list.includes(p) ||
           list.some(x=>x.endsWith('.*') && p.startsWith(x.slice(0,-1)));
  });
}
/* Chốt chặn quyền ở TẦNG NGHIỆP VỤ (tương đương kiểm tra ở server + RLS).
   Mọi hàm ghi dữ liệu / xuất dữ liệu gọi guard() ở dòng đầu tiên, nên gọi thẳng
   hàm từ console cũng bị chặn chứ không chỉ ẩn nút ngoài giao diện. */
function guard(perm, msg){
  if(can(perm)) return true;
  const m = msg || 'Bạn không có quyền thực hiện thao tác này';
  try{ toast(m+' (thiếu quyền: '+perm+')','err'); }catch(e){}
  try{ au(new Date(), S.user?S.user.id:'—','denied','permissions',perm,'—',location.hash); DB.audit.sort((a,b)=>b.at-a.at); }catch(e){}
  console.warn('[RBAC] Từ chối: thiếu quyền "'+perm+'"');
  return false;
}
const NAV = [
  {group:null, items:[{k:'dashboard', ic:'dashboard', lb:'Tổng quan', to:'#/dashboard', perm:'dashboard'}]},
  {group:'CRM', items:[
    {k:'customers', ic:'users', lb:'Khách hàng', to:'#/customers', perm:'customers'},
    {k:'leads', ic:'inbox', lb:'Lead marketing', to:'#/leads', perm:'leads'},
  ]},
  {group:'Telesales', items:[
    {k:'telesales', ic:'phone', lb:'Danh sách gọi', to:'#/telesales', perm:'telesales', badge:()=>myLeads().filter(c=>needCallToday(c)).length},
  ]},
  {group:'Vận hành', items:[
    {k:'calendar', ic:'calendar', lb:'Lịch phòng khám', to:'#/calendar', perm:'calendar'},
    {k:'reception', ic:'reception', lb:'Tiếp đón', to:'#/reception', perm:'reception', badge:()=>todayAppts().filter(a=>a.status==='waiting').length},
    {k:'doctor', ic:'stethoscope', lb:'Khám bệnh', to:'#/doctor', perm:'doctor', badge:()=>todayAppts().filter(a=>a.status==='waiting').length},
  ]},
  {group:'Điều trị', items:[
    {k:'treatment', ic:'pill', lb:'Liệu trình', to:'#/treatment', perm:'treatment', badge:()=>DB.courses.filter(c=>c.status==='pending').length, hot:true},
    {k:'sessions', ic:'activity', lb:'Buổi điều trị', to:'#/sessions', perm:'treatment.sessions'},
    {k:'op', ic:'heart', lb:'CSKH / OP', to:'#/op', perm:'op', badge:()=>DB.careTasks.length},
  ]},
  {group:'Tài chính & Báo cáo', items:[
    {k:'payments', ic:'banknote', lb:'Thanh toán', to:'#/payments', perm:'payments'},
    {k:'reports', ic:'chart', lb:'Báo cáo', to:'#/reports', perm:'reports'},
  ]},
  {group:'Quản trị', items:[
    {k:'admin-users', ic:'settings', lb:'Người dùng & quyền', to:'#/admin/users', perm:'admin'},
    {k:'admin-packages', ic:'package', lb:'Gói điều trị', to:'#/admin/packages', perm:'admin'},
    {k:'admin-metrics', ic:'lineChart', lb:'Chỉ số lượng giá', to:'#/admin/clinical-metrics', perm:'admin'},
    {k:'admin-audit', ic:'history', lb:'Nhật ký hệ thống', to:'#/admin/audit-log', perm:'admin'},
  ]},
];

/* ---------- LOGIN ---------- */
const QUICK = ['U01','U02','U03','U08','U10','U18','U13','U16'];
function renderDemoUsers(){
  $('#demo-user-list').innerHTML = QUICK.map(id=>{const u=userById(id);
    return `<button class="demo-user" onclick="loginAs('${u.id}')">
      <div class="avatar">${initials(u.name)}</div>
      <div style="flex:1"><div class="nm">${esc(u.name)}</div><div class="rl">${esc(u.email)}${u.roles.length>1?' · '+u.roles.map(roleName).join(' + '):''}</div></div>
      <span class="badge ${roleColor(u.roles[0])} nodot">${roleName(u.roles[0])}</span>${ic('chevronRight',15)}</button>`}).join('');
}
function doLogin(){
  const inp=$('#lg-email'), err=$('#lg-email-err'), em=inp.value.trim().toLowerCase();
  const u=DB.users.find(x=>x.email.toLowerCase()===em);
  if(!u){ err.innerHTML=ic('alert',14)+' Email này chưa có tài khoản. Hãy chọn một vai trò demo bên dưới.'; inp.setAttribute('aria-invalid','true'); inp.focus(); return; }
  err.innerHTML=''; inp.removeAttribute('aria-invalid'); loginAs(u.id);
}
function loginAs(id){
  S.user = userById(id);
  $('#login').style.display='none'; $('#app').classList.add('on'); initChrome();
  $('#hd-name').textContent=S.user.name; $('#hd-avatar').textContent=initials(S.user.name);
  $('#hd-role').textContent=S.user.roles.map(roleName).join(' · ');
  $('#branch-lb').textContent=((DB.branches.find(b=>b.id===S.user.branch)||{}).name||'').replace('Vitalife ','');
  buildNav(); buildBottomNav();
  const home = {marketing:'#/leads',telesales:'#/telesales',reception:'#/reception',doctor:'#/doctor',manager:'#/treatment',tech:'#/sessions',op:'#/op'}[S.user.roles[0]] || '#/dashboard';
  const keep = location.hash && location.hash.length>2;
  if(!keep) location.hash = home;
  render();
  toast('Xin chào '+S.user.name.split(' ').slice(-1)+'! Đăng nhập với vai trò '+S.user.roles.map(roleName).join(', '),'ok');
}
function logout(){ S.user=null; $('#app').classList.remove('on'); $('#login').style.display='grid'; closeModal(); }

function buildNav(){
  let h='';
  NAV.forEach(g=>{
    const items=g.items.filter(i=>can(i.perm));
    if(!items.length) return;
    if(g.group) h+=`<div class="nav-group">${g.group}</div>`;
    items.forEach(i=>{
      let b='';
      try{ const n=i.badge?i.badge():0; if(n) b=`<span class="cnt ${i.hot?'hot':''}">${n}</span>`; }catch(e){}
      h+=`<a data-k="${i.k}" href="${i.to}">${ic(i.ic,18)}<span>${i.lb}</span>${b}</a>`;
    });
  });
  $('#nav').innerHTML=h;
  if($('#bottomnav')&&$('#bottomnav').children.length) buildBottomNav();
}
function markNav(){
  const r=location.hash;
  document.querySelectorAll('#nav a, #bottomnav a').forEach(a=>{
    const to=a.getAttribute('href');
    a.classList.toggle('active', r===to || (to!=='#/dashboard' && r.startsWith(to)));
  });
}

/* ---------- THIẾT BỊ ---------- */
function isMobile(){ return window.innerWidth<768; }
function isTouch(){ return window.matchMedia&&matchMedia('(hover:none)').matches; }

/* ---------- THEME & SHELL CHROME ---------- */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  try{ localStorage.setItem('vt-theme',t); }catch(e){}
  const b=$('#theme-btn');
  if(b){ b.innerHTML=ic(t==='dark'?'sun':'moon',18);
    b.setAttribute('aria-label', t==='dark'?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối'); }
}
function toggleTheme(){ applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'); }
function initTheme(){
  let t='light';
  try{ t=localStorage.getItem('vt-theme') || (window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'); }catch(e){}
  applyTheme(t);
}
function toggleSidebar(force){
  const sb=$('#sidebar'), sc=$('#scrim'); if(!sb) return;
  const on = force===undefined ? !sb.classList.contains('open') : !!force;
  sb.classList.toggle('open',on); sc.classList.toggle('on',on);
  $('#burger').setAttribute('aria-expanded', on?'true':'false');
}
function toggleSearch(on){
  const w=$('.search'); if(!w) return;
  w.classList.toggle('mobile-open',on);
  if(on) setTimeout(()=>$('#gsearch').focus(),40);
  else { $('#gsearch').value=''; $('#search-res').classList.remove('on'); }
}
/* Thanh điều hướng dưới cùng cho điện thoại: 4 mục hay dùng nhất theo vai trò + nút Thêm */
function buildBottomNav(){
  const host=$('#bottomnav'); if(!host) return;
  const flat=NAV.flatMap(g=>g.items).filter(i=>can(i.perm));
  const PRIO=['dashboard','telesales','reception','doctor','sessions','op','assign','calendar','treatment','customers','leads','payments','reports','admin-users'];
  const picked=[];
  PRIO.forEach(k=>{ if(picked.length<4){ const it=flat.find(i=>i.k===k); if(it&&!picked.includes(it)) picked.push(it); } });
  flat.forEach(i=>{ if(picked.length<4&&!picked.includes(i)) picked.push(i); });
  const SHORT={dashboard:'Tổng quan',customers:'Khách hàng',leads:'Lead',assign:'Phân bổ',telesales:'Gọi khách',
    calendar:'Lịch',reception:'Tiếp đón',doctor:'Khám bệnh',treatment:'Liệu trình',sessions:'Buổi ĐT',
    op:'CSKH',payments:'Thu tiền',reports:'Báo cáo','admin-users':'Quản trị'};
  host.innerHTML=picked.map(i=>{
    let b=''; try{ const n=i.badge?i.badge():0; if(n) b=`<span class="bn-badge">${n>99?'99+':n}</span>`; }catch(e){}
    return `<a href="${i.to}" data-bk="${i.k}">${ic(i.ic,21)}<span>${SHORT[i.k]||i.lb}</span>${b}</a>`;})
    .join('')+`<button data-bk="more" onclick="toggleSidebar(true)" aria-label="Mở toàn bộ menu">${ic('menu',21)}<span>Thêm</span></button>`;
  markNav();
}
function initChrome(){
  $('#burger').innerHTML=ic('menu',18);
  $('#search-btn').innerHTML=ic('search',18);
  document.querySelector('.search-close').innerHTML=ic('x',18);
  $('#search-ic').innerHTML=ic('search',17);
  const un=DB.notifications.filter(n=>!n.read).length;
  $('#notif-btn').innerHTML=ic('bell',18)+(un?'<span class="dot" id="notif-count">'+un+'</span>':'');
  $('#notif-btn').setAttribute('aria-label', un?('Thông báo — '+un+' chưa đọc'):'Thông báo');
  $('#user-chip').insertAdjacentHTML('beforeend', ic('chevronDown',14));
}
function renderLoginArt(){
  $('#login-feats').innerHTML=[
    ['layers','Toàn bộ hành trình khách hàng trên một timeline duy nhất'],
    ['lineChart','Biểu đồ tiến triển điều trị theo chỉ số lượng giá tùy biến'],
    ['clipboard','Bệnh án điện tử có autosave, chốt bản và lưu phiên bản'],
    ['shield','Phân quyền 8 vai trò &amp; nhật ký kiểm toán đầy đủ'],
  ].map(([i,t])=>`<div class="login-feat"><i>${ic(i,16)}</i><span>${t}</span></div>`).join('');
}

/* Cho phép thao tác bằng bàn phím với các control tuỳ biến (tab, chip, hàng danh sách) */
function a11yPass(root){
  root.querySelectorAll('.tab').forEach(t=>{ t.setAttribute('role','tab'); t.setAttribute('tabindex','0');
    t.setAttribute('aria-selected', t.classList.contains('on')?'true':'false'); });
  root.querySelectorAll('.chip').forEach(c=>{ c.setAttribute('role','button'); c.setAttribute('tabindex','0');
    c.setAttribute('aria-pressed', c.classList.contains('on')?'true':'false'); });
  root.querySelectorAll('.sess,.dropzone').forEach(x=>{ x.setAttribute('role','button'); x.setAttribute('tabindex','0'); });
  root.querySelectorAll('tr.row-link,td.row-link').forEach(x=>x.setAttribute('tabindex','0'));
  root.querySelectorAll('.tabs').forEach(x=>x.setAttribute('role','tablist'));
}
document.addEventListener('keydown',e=>{
  const t=e.target;
  if((e.key==='Enter'||e.key===' ')&&t&&t.classList&&
     ['tab','chip','sess','notif','dropzone','row-link'].some(c=>t.classList.contains(c))){
    e.preventDefault(); t.click();
  }
});

/* ---------- UI UTILS ---------- */
function toast(msg,kind){ const t=el(`<div class="toast ${kind||''}">${kind==='ok'?ic('check',15):kind==='err'?ic('x',16):kind==='warn'?ic('alert',16):ic('info',16)} <span>${esc(msg)}</span></div>`); $('#toasts').appendChild(t); setTimeout(()=>{t.style.opacity='0';t.style.transition='.3s';setTimeout(()=>t.remove(),300)},3200); }
let _lastFocus=null;
function modal(html){
  _lastFocus=document.activeElement;
  $('#modal-host').innerHTML=html; $('#overlay').classList.add('on');
  const box=$('#overlay');
  const f=box.querySelector('input:not([type=hidden]),select,textarea,.btn.primary,button');
  if(f) setTimeout(()=>f.focus(),30);
  box.onkeydown=e=>{ if(e.key!=='Tab') return;
    const els=[...box.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled&&x.offsetParent!==null);
    if(!els.length) return; const first=els[0],last=els[els.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();} };
}
function closeModal(){ $('#overlay').classList.remove('on'); $('#modal-host').innerHTML=''; $('#overlay').onkeydown=null;
  if(_lastFocus&&document.contains(_lastFocus)){ _lastFocus.focus(); _lastFocus=null; } }
function drawer(html){ $('#drawer-body').innerHTML=html; $('#drawer').classList.add('on'); }
function closeDrawer(){ $('#drawer').classList.remove('on'); $('#drawer-body').innerHTML=''; }
function confirmDlg(title,msg,onOk,okLabel,danger){
  modal(`<div class="modal" style="max-width:420px"><div class="modal-h"><h3>${esc(title)}</h3><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b"><p style="margin:0;color:var(--ink-2)">${msg}</p></div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
  <button class="btn ${danger?'danger':'primary'}" id="cf-ok">${esc(okLabel||'Xác nhận')}</button></div></div>`);
  $('#cf-ok').onclick=()=>{ closeModal(); onOk&&onOk(); };
}

/* ---------- GLOBAL SEARCH ---------- */
function doSearch(q){
  const box=$('#search-res'); q=(q||'').trim();
  if(q.length<2){ box.classList.remove('on'); return; }
  const nq=normPhone(q), lq=q.toLowerCase();
  const res=[];
  DB.customers.forEach(c=>{
    if(res.length>=8) return;
    if((nq.length>=4 && normPhone(c.phone).includes(nq)) || c.name.toLowerCase().includes(lq) || c.code.toLowerCase().includes(lq))
      res.push({t:'KH', id:c.id, name:c.name, sub:fmtPhone(c.phone)+' · '+c.code, st:c.status, go:'#/customers/'+c.id});
  });
  DB.courses.forEach(co=>{ if(res.length>=10) return;
    if(co.code.toLowerCase().includes(lq)) res.push({t:'LT', id:co.id, name:co.code+' — '+pkgById(co.package_id).name, sub:custById(co.customer_id).name, st:null, go:'#/treatment/'+co.id}); });
  box.innerHTML = res.length? res.map(r=>`<div class="sr-item" role="option" tabindex="0" onclick="location.hash='${r.go}';$('#search-res').classList.remove('on');$('#gsearch').value=''">
      <span class="badge ${r.t==='KH'?'b-teal':'b-purple'} nodot">${r.t}</span>
      <div style="flex:1"><div style="font-weight:650">${hl(r.name,q)}</div><div class="cd">${hl(r.sub,q)}</div></div>
      ${r.st?`<span class="badge ${stColor(r.st)}">${stLabel(r.st)}</span>`:''}</div>`).join('')
    : `<div style="padding:18px;text-align:center;color:var(--muted);font-size:13px">Không tìm thấy kết quả cho “${esc(q)}”</div>`;
  box.classList.add('on');
}
function hl(text,q){ const t=esc(text); const i=t.toLowerCase().indexOf(q.toLowerCase()); if(i<0||!q) return t; return t.slice(0,i)+'<span class="hl">'+t.slice(i,i+q.length)+'</span>'+t.slice(i+q.length); }
document.addEventListener('click',e=>{ if(!e.target.closest('.search')) $('#search-res')?.classList.remove('on'); });
document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key==='k'){ e.preventDefault(); $('#gsearch')?.focus(); }
  if(e.key==='Escape'){ closeModal(); closeDrawer(); $('#search-res')?.classList.remove('on'); }
});

function openNotifs(){
  const un=DB.notifications.filter(n=>!n.read).length;
  drawer(`<div class="card-h"><h3>Thông báo</h3><span class="badge b-red nodot">${un} chưa đọc</span>
    <div class="r"><button class="btn sm" onclick="markAllNotif()">Đánh dấu đã đọc</button>
    <button class="btn sm ghost" onclick="closeDrawer()">${ic('x',16)}</button></div></div>
    <div style="overflow-y:auto">${DB.notifications.map(n=>`<div class="notif ${n.read?'':'unread'}" role="button" tabindex="0" onclick="markNotif('${n.id}','${n.link}')">
      <div class="ic-box ${n.cls}">${ic(n.icon,16)}</div>
      <div style="flex:1"><div style="font-weight:650;font-size:13.5px">${esc(n.title)}</div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:2px">${esc(n.desc)}</div>
      <div style="font-size:11.5px;color:var(--muted);margin-top:4px">${fmtDT(n.at)}</div></div>
      ${n.read?'':'<div style="width:8px;height:8px;border-radius:50%;background:var(--brand);flex:none;margin-top:6px"></div>'}</div>`).join('')}</div>`);
}
function openUserMenu(){
  modal(`<div class="modal" style="max-width:400px"><div class="modal-h"><h3>Tài khoản</h3><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">
      <div class="avatar" style="width:46px;height:46px;font-size:16px">${initials(S.user.name)}</div>
      <div><div style="font-weight:700;font-size:15px">${esc(S.user.name)}</div>
      <div style="font-size:12.5px;color:var(--muted)">${esc(S.user.email)}</div>
      <div style="margin-top:5px" class="chips">${S.user.roles.map(r=>`<span class="badge ${roleColor(r)} nodot">${roleName(r)}</span>`).join('')}</div></div>
    </div>
    <div class="kv"><div class="k">Cơ sở</div><div class="v">${(DB.branches.find(b=>b.id===S.user.branch)||{}).name}</div>
    <div class="k">Phiên đăng nhập</div><div class="v">Hết hạn sau 30 phút không hoạt động</div></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Đóng</button><button class="btn danger" onclick="logout()">Đăng xuất</button></div></div>`);
}

/* ---------- SHARED SELECTORS ---------- */
function myLeads(){ const all=DB.customers.filter(c=>['lead','customer'].includes(c.lifecycle)||['NEW_LEAD','ASSIGNED','CONTACTING','CALLBACK','NO_ANSWER','INTERESTED','APPOINTMENT_BOOKED','NO_SHOW','NOT_INTERESTED'].includes(c.status));
  if(S.user && S.user.roles.includes('telesales') && !S.user.roles.includes('admin')) return all.filter(c=>c.assigned_to===S.user.id);
  return all; }
function needCallToday(c){ return (c.next_call && c.next_call<=d(0,23,59)) || ['ASSIGNED','NEW_LEAD'].includes(c.status); }
function todayAppts(){ return DB.appointments.filter(a=>sameDay(a.at,TODAY)); }
function custCourses(cid){ return DB.courses.filter(c=>c.customer_id===cid); }
function courseSessions(id){ return DB.sessions.filter(s=>s.course_id===id).sort((a,b)=>a.no-b.no); }
function coursePayments(id){ return DB.payments.filter(p=>p.course_id===id); }
function custTimeline(cid){ return DB.timeline.filter(t=>t.customer_id===cid); }

/* ---------- SVG LINE CHART ---------- */
function lineChart(series, opts){
  opts=opts||{}; const mob=isMobile();
  const W=opts.w||760, H=mob?Math.min(opts.h||280,230):(opts.h||280), PL=mob?46:44, PR=16, PT=16, PB=34;
  const iw=W-PL-PR, ih=H-PT-PB;
  const active=series.filter(s=>s.on!==false&&s.points.length);
  if(!active.length) return `<div class="empty"><div class="ic-box">${ic('lineChart',16)}</div><div class="t">Chưa có dữ liệu</div><div>Bật ít nhất một chỉ số hoặc nhập lượng giá cho buổi điều trị.</div></div>`;
  const xs=[...new Set(active.flatMap(s=>s.points.map(p=>p.x)))].sort((a,b)=>a-b);
  const xmin=Math.min(...xs), xmax=Math.max(...xs)||1;
  const X = v => PL + (xmax===xmin?iw/2:(v-xmin)/(xmax-xmin)*iw);
  let g='';
  /* normalize each series to 0..1 by its own min/max scale */
  const gl=5;
  for(let i=0;i<=gl;i++){ const y=PT+ih*i/gl; g+=`<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`; }
  const lstep=Math.ceil(xs.length/(mob?6:14))||1;
  xs.forEach((x,i)=>{ if(i%lstep&&i!==xs.length-1) return;
    g+=`<text x="${X(x)}" y="${H-12}" font-size="${mob?13:11}" fill="var(--muted)" text-anchor="middle">B${x}</text>`; });
  const single = active.length===1;
  if(single){
    const m=active[0].metric; const lo=Math.min(m.min, ...active[0].points.map(p=>p.y)), hi=Math.max(...active[0].points.map(p=>p.y));
    const pad=(hi-lo)*0.15||1; const y0=Math.max(m.min,lo-pad), y1=Math.min(m.max,hi+pad);
    for(let i=0;i<=gl;i++){ const val=y1-(y1-y0)*i/gl; g+=`<text x="${PL-8}" y="${PT+ih*i/gl+4}" font-size="11" fill="var(--muted)" text-anchor="end">${Math.round(val*10)/10}</text>`; }
  } else {
    for(let i=0;i<=gl;i++){ g+=`<text x="${PL-8}" y="${PT+ih*i/gl+4}" font-size="11" fill="var(--muted)" text-anchor="end">${100-i*20}%</text>`; }
  }
  active.forEach(s=>{
    const m=s.metric;
    let y0,y1;
    if(single){ const lo=Math.min(m.min,...s.points.map(p=>p.y)), hi=Math.max(...s.points.map(p=>p.y)); const pad=(hi-lo)*0.15||1; y0=Math.max(m.min,lo-pad); y1=Math.min(m.max,hi+pad); }
    else { y0=m.min; y1=m.max; }
    const Y = v => PT + ih - (v-y0)/((y1-y0)||1)*ih;
    const pts=s.points.map(p=>[X(p.x),Y(p.y)]);
    const dstr=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const area=dstr+` L ${pts[pts.length-1][0].toFixed(1)} ${PT+ih} L ${pts[0][0].toFixed(1)} ${PT+ih} Z`;
    if(single) g+=`<path d="${area}" fill="${m.color}" opacity=".08"/>`;
    g+=`<path d="${dstr}" fill="none" stroke="${m.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach((p,i)=>{ g+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" fill="var(--surface)" stroke="${m.color}" stroke-width="2.5"><title>Buổi ${s.points[i].x} — ${m.name}: ${s.points[i].y} ${m.unit}</title></circle>`;
      if(single&&(!mob||i%lstep===0||i===pts.length-1))
        g+=`<text x="${p[0].toFixed(1)}" y="${(p[1]-12).toFixed(1)}" font-size="${mob?13:11}" font-weight="700" fill="${m.color}" text-anchor="middle">${s.points[i].y}</text>`; });
  });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
}
function barChart(data,opts){
  opts=opts||{}; const mob=isMobile();
  if(mob&&data.length>14) data=data.slice(-14);
  const W=opts.w||760,H=mob?Math.min(opts.h||240,210):(opts.h||240),PL=mob?40:44,PR=10,PT=12,PB=42;
  const iw=W-PL-PR, ih=H-PT-PB; const max=Math.max(...data.map(d=>d.v),1);
  const bw=iw/data.length; let g='';
  for(let i=0;i<=4;i++){ const y=PT+ih*i/4; g+=`<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--line)"/><text x="${PL-8}" y="${y+4}" font-size="10.5" fill="var(--muted)" text-anchor="end">${moneyS(max-(max/4)*i)}</text>`; }
  data.forEach((d,i)=>{ const h=d.v/max*ih; const x=PL+i*bw+bw*0.18, w=bw*0.64;
    g+=`<rect x="${x.toFixed(1)}" y="${(PT+ih-h).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h,1).toFixed(1)}" rx="4" fill="${d.color||'#0E9F8E'}"><title>${d.l}: ${money(d.v)}</title></rect>`;
    const lstep=Math.ceil(data.length/(mob?5:14))||1;
    if(i%lstep===0||i===data.length-1)
      g+=`<text x="${(x+w/2).toFixed(1)}" y="${H-14}" font-size="${mob?12:10.5}" fill="var(--muted)" text-anchor="middle">${d.l}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${g}</svg>`;
}
function donut(data,size){
  size=size||150; const r=size/2-10, c=size/2, C=2*Math.PI*r; const tot=data.reduce((a,b)=>a+b.v,0)||1; let off=0,g='';
  data.forEach(d=>{ const frac=d.v/tot; g+=`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${d.color}" stroke-width="18" stroke-dasharray="${(frac*C).toFixed(2)} ${C}" stroke-dashoffset="${(-off*C).toFixed(2)}" transform="rotate(-90 ${c} ${c})"><title>${d.l}: ${d.v}</title></circle>`; off+=frac; });
  return `<svg viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px">${g}<text x="${c}" y="${c-2}" text-anchor="middle" font-size="22" font-weight="800" fill="var(--ink)">${tot}</text><text x="${c}" y="${c+16}" text-anchor="middle" font-size="10.5" fill="var(--muted)">TỔNG</text></svg>`;
}

/* ================= ROUTER ================= */
const ROUTES = [
  [/^#\/dashboard$/, ()=>viewDashboard()],
  [/^#\/leads$/, ()=>viewLeads()],
  [/^#\/leads\/import$/, ()=>viewImport()],
  [/^#\/telesales$/, ()=>viewTelesales()],
  [/^#\/customers$/, ()=>viewCustomers()],
  [/^#\/customers\/(C\d+)$/, m=>viewCustomer360(m[1])],
  [/^#\/calendar$/, ()=>viewCalendar()],
  [/^#\/reception$/, ()=>viewReception()],
  [/^#\/doctor$/, ()=>viewDoctor()],
  [/^#\/doctor\/encounter\/(EN\d+)$/, m=>viewEncounter(m[1])],
  [/^#\/treatment$/, ()=>viewTreatments()],
  [/^#\/treatment\/(CO\d+)$/, m=>viewCourse(m[1])],
  [/^#\/sessions$/, ()=>viewSessions()],
  [/^#\/op$/, ()=>viewOP()],
  [/^#\/payments$/, ()=>viewPayments()],
  [/^#\/reports$/, ()=>viewReports('overview')],
  [/^#\/reports\/(\w+)$/, m=>viewReports(m[1])],
  [/^#\/admin\/users$/, ()=>viewAdminUsers()],
  [/^#\/admin\/packages$/, ()=>viewAdminPackages()],
  [/^#\/admin\/clinical-metrics$/, ()=>viewAdminMetrics()],
  [/^#\/admin\/audit-log$/, ()=>viewAudit()],
];
function render(){
  if(!S.user) return;
  const h = location.hash||'#/dashboard';
  const r = ROUTES.find(([re])=>re.test(h));
  $('#view').innerHTML = r ? r[1](h.match(r[0])) : `<div class="empty"><div class="ic-box">${ic('alert',22)}</div><div class="t">Không tìm thấy trang</div><div>${esc(h)}</div></div>`;
  markNav(); window.scrollTo(0,0); toggleSidebar(false);
  const v=$('#view'); v.classList.remove('page-enter'); void v.offsetWidth; v.classList.add('page-enter');
  a11yPass(v); tablesToCards(v); toggleSearch(false);
}
window.addEventListener('hashchange',render);

function head(title,desc,actions){ return `<div class="page-head"><div><h1>${title}</h1>${desc?`<div class="desc">${desc}</div>`:''}</div>${actions?`<div class="actions">${actions}</div>`:''}</div>`; }
function stat(lb,vl,df,icon,cls,onclick){
  const trend = cls==='delta-up'?ic('trendUp',13):cls==='delta-dn'?ic('trendDown',13):'';
  return `<div class="stat ${onclick?'clickable':''}" ${onclick?`role="button" tabindex="0" onclick="${onclick}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${onclick}}"`:''}>
    <div class="lb">${lb}</div><div class="vl">${vl}</div>
    ${df?`<div class="df ${cls||''}">${trend}<span>${df}</span></div>`:''}
    ${icon?`<div class="ic-box">${ic(icon,17)}</div>`:''}</div>`; }
function stars(n){ let h='<span style="display:inline-flex;gap:1px;color:var(--warn)">';
  for(let i=1;i<=5;i++) h+=`<svg width="13" height="13" viewBox="0 0 24 24" fill="${i<=n?'currentColor':'none'}" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  return h+`</span><span class="sr-only">${n}/5</span>`; }

/* ================= DASHBOARD ================= */
function viewDashboard(){
  const t=todayAppts();
  const newLeads=DB.customers.filter(c=>sameDay(c.created_at,TODAY)).length || 23;
  const callsToday=DB.calls.filter(c=>sameDay(c.at,TODAY)).length;
  const arrived=t.filter(a=>['arrived','waiting','in_exam','done'].includes(a.status)).length;
  const noshow=t.filter(a=>a.status==='no_show').length;
  const newPkg=DB.courses.filter(c=>c.activated_at&&sameDay(c.activated_at,TODAY)).length||2;
  const revToday=DB.payments.filter(p=>sameDay(p.at,TODAY)).reduce((a,b)=>a+b.amount,0) || 14200000;
  const sessToday=DB.sessions.filter(s=>s.at&&sameDay(s.at,TODAY)).length;

  /* funnel */
  const cs=DB.customers.filter(c=>S.range==='all'||inRange(c.created_at));
  const f={lead:cs.length, contacted:cs.filter(c=>c.call_count>0).length,
    interested:cs.filter(c=>['INTERESTED','APPOINTMENT_BOOKED','ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','PACKAGE_PENDING','NO_SHOW'].includes(c.status)).length,
    booked:cs.filter(c=>['APPOINTMENT_BOOKED','ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','PACKAGE_PENDING','NO_SHOW'].includes(c.status)).length,
    arrived:cs.filter(c=>['ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','PACKAGE_PENDING'].includes(c.status)).length,
    package:DB.courses.filter(c=>c.status!=='pending').length};
  const fr=[['Lead',f.lead,null],['Đã liên hệ',f.contacted,f.lead],['Quan tâm',f.interested,f.contacted],['Đặt lịch',f.booked,f.interested],['Đến khám',f.arrived,f.booked],['Mua liệu trình',f.package,f.arrived]];

  /* revenue 14 days */
  const rev=[]; for(let i=13;i>=0;i--){ const day=d(-i,0,0); rev.push({l:fmtDS(day), v:DB.payments.filter(p=>sameDay(p.at,day)&&p.amount>0).reduce((a,b)=>a+b.amount,0)}); }

  const srcAgg={}; DB.customers.forEach(c=>{srcAgg[c.source]=(srcAgg[c.source]||0)+1});
  const srcColors={facebook:'#2563EB',google:'#DC2626',tiktok:'#7C3AED',zalo:'#0E9F8E',hotline:'#D97706',referral:'#DB2777',website:'#64748B',walkin:'#16A34A',other:'#94A3B8'};
  const srcData=Object.entries(srcAgg).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({l:srcName(k),v,color:srcColors[k]||'#94A3B8'}));

  return head('Tổng quan hoạt động','Hôm nay, '+fmtD(TODAY)+' · Dữ liệu phễu &amp; doanh thu theo <b>'+RANGES[S.range]+'</b> · cập nhật lúc '+fmtT(d(0,10,42)),
    `${rangeSelect()}${can('data.export')?`<button class="btn" onclick="exportCustomers(DB.customers)">${ic('download',16)} Xuất Excel</button>`:''}`)
  + `<div class="grid g4" style="margin-bottom:14px">
      ${stat('Lead mới','+'+newLeads,'18% so với hôm qua','inbox','delta-up',"location.hash='#/leads'")}
      ${stat('Cuộc gọi',callsToday||64,'6 cuộc so với hôm qua','phone','delta-up',"location.hash='#/telesales'")}
      ${stat('Lịch hẹn',t.length,arrived+' đã đến · '+noshow+' không đến','calendar','flat',"location.hash='#/calendar'")}
      ${stat('Doanh thu',moneyS(revToday)+'đ','12% so với hôm qua','banknote','delta-up',"location.hash='#/reports/revenue'")}
    </div>
    <div class="grid g4" style="margin-bottom:14px">
      ${stat('Khách đã đến',arrived,'Tỷ lệ đến '+Math.round(arrived/(t.length||1)*100)+'%','checkCircle','up')}
      ${stat('Khách không đến',noshow,noshow?'Cần OP gọi lại':'Rất tốt','alert',noshow?'dn':'up')}
      ${stat('Gói mới bán',newPkg,'Giá trị '+moneyS(24500000)+'đ','package','up')}
      ${stat('Buổi điều trị',sessToday||9,''+DB.sessions.filter(s=>s.status==='booked').length+' buổi đã đặt lịch','activity','flat',"location.hash='#/sessions'")}
    </div>
    <div class="grid g-3-2" style="margin-bottom:14px">
      <div class="card"><div class="card-h"><h3>Phễu chuyển đổi</h3><span class="sub">${RANGES[S.range]}</span>
        <div class="r"><button class="btn sm" onclick="location.hash='#/reports/marketing'">Chi tiết ${ic('arrowRight',15)}</button></div></div>
        <div class="card-b">${fr.map(([lb,v,prev])=>`
          <div class="funnel-row"><div class="funnel-lb">${lb}</div>
          <div class="funnel-bar"><i style="width:${Math.max(v/f.lead*100,7)}%">${v}</i></div>
          <div class="funnel-cv">${prev?Math.round(v/prev*100)+'%':'—'}</div></div>`).join('')}
          <div class="divider"></div>
          <div class="grid g4" style="gap:10px">
            <div><div class="sec-t">Lead ${ic('arrowRight',15)} Liên hệ</div><div style="font-size:19px;font-weight:750">${Math.round(f.contacted/f.lead*100)}%</div></div>
            <div><div class="sec-t">Liên hệ ${ic('arrowRight',15)} Lịch hẹn</div><div style="font-size:19px;font-weight:750">${Math.round(f.booked/f.contacted*100)}%</div></div>
            <div><div class="sec-t">Lịch hẹn ${ic('arrowRight',15)} Đến khám</div><div style="font-size:19px;font-weight:750">${Math.round(f.arrived/f.booked*100)}%</div></div>
            <div><div class="sec-t">Đến khám ${ic('arrowRight',15)} Chốt gói</div><div style="font-size:19px;font-weight:750;color:var(--brand-700)">${Math.round(f.package/f.arrived*100)}%</div></div>
          </div>
        </div></div>
      <div class="card"><div class="card-h"><h3>Lead theo nguồn</h3></div>
        <div class="card-b" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          ${donut(srcData,150)}
          <div style="flex:1;min-width:150px">${srcData.map(s=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;font-size:13px">
            <span style="width:10px;height:10px;border-radius:3px;background:${s.color};flex:none"></span>
            <span style="flex:1">${s.l}</span><b class="tnum">${s.v}</b></div>`).join('')}</div>
        </div>
        <div class="divider" style="margin:0"></div>
        <div class="card-b">
          <div class="sec-t">Top chiến dịch theo số lead</div>
          ${DB.campaigns.map(cp=>({cp,n:DB.customers.filter(c=>c.campaign===cp.id).length}))
            .sort((a,b)=>b.n-a.n).slice(0,4).map(x=>`
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
              <div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.cp.name)}</div>
                <div class="mini-bar" style="margin-top:4px"><i style="width:${x.n/DB.customers.length*100*2.2}%"></i></div></div>
              <b class="tnum" style="font-size:13px">${x.n}</b></div>`).join('')}
        </div></div>
    </div>
    <div class="grid g-3-2">
      <div class="card"><div class="card-h"><h3>Doanh thu 14 ngày</h3><span class="sub">Theo giao dịch thực thu</span></div>
        <div class="card-b">${barChart(rev)}</div></div>
      <div class="card"><div class="card-h"><h3>Việc cần xử lý</h3></div>
        <div class="card-b tight">
          ${[
            ['lock','b-red', DB.courses.filter(c=>c.status==='pending').length+' liệu trình chờ kích hoạt','Trưởng phòng cần duyệt','#/treatment'],
            ['heart','b-amber', DB.careTasks.length+' khách cần chăm sóc hôm nay','OP/CSKH theo dõi','#/op'],
            ['clock','b-blue', myLeads().filter(c=>c.next_call&&c.next_call<=d(0,23,59)).length+' lead đến hạn gọi lại','Telesales xử lý','#/telesales'],
            ['reception','b-teal', todayAppts().filter(a=>['confirmed','booked'].includes(a.status)).length+' khách sắp đến trong hôm nay','Lễ tân chuẩn bị hồ sơ','#/reception'],
            ['banknote','b-purple', DB.courses.filter(c=>c.status!=='pending'&&c.paid<c.total).length+' liệu trình còn công nợ','Tổng '+moneyS(DB.courses.filter(c=>c.status!=='pending').reduce((a,b)=>a+Math.max(0,b.total-b.paid),0))+'đ','#/payments'],
          ].map(([icn,cls,t,s,link])=>`<div class="notif" role="button" tabindex="0" onclick="location.hash='${link}'" onkeydown="if(event.key==='Enter'){location.hash='${link}'}">
            <div class="ic-box ${cls}">${ic(icn,16)}</div>
            <div style="flex:1"><div style="font-weight:650;font-size:13.5px">${t}</div><div style="font-size:12.5px;color:var(--muted)">${s}</div></div>
            ${ic('chevronRight',16,'muted')}</div>`).join('')}
        </div></div>
    </div>`;
}

/* ================= LEADS (MARKETING) ================= */
function viewLeads(){
  const f=S.filters.leads=S.filters.leads||{src:'',cp:'',assign:'',q:''};
  let list=DB.customers.filter(c=>true);
  if(f.src) list=list.filter(c=>c.source===f.src);
  if(f.cp) list=list.filter(c=>c.campaign===f.cp);
  if(f.assign==='none') list=list.filter(c=>!c.assigned_to);
  else if(f.assign) list=list.filter(c=>c.assigned_to===f.assign);
  if(f.q){ const q=f.q.toLowerCase(), nq=normPhone(f.q); list=list.filter(c=>c.name.toLowerCase().includes(q)||normPhone(c.phone).includes(nq)||c.code.toLowerCase().includes(q)); }
  list=list.slice().sort((a,b)=>b.created_at-a.created_at);
  window._leadList=list;
  const unassigned=DB.customers.filter(c=>!c.assigned_to).length;

  return head('Khách hàng tiềm năng','Lead từ quảng cáo &amp; các nguồn marketing · '+DB.customers.length+' bản ghi',
    `${can('leads.assign')?`<button class="btn" onclick="location.hash='#/admin/assign'">${ic('repeat',16)} Phân bổ lead</button>`:''}
     ${can('data.export')?`<button class="btn" onclick="exportCustomers(window._leadList||[])">${ic('download',16)} Xuất Excel</button>`:''}
     ${can('leads.import')?`<button class="btn primary" onclick="location.hash='#/leads/import'">${ic('plus',16)} Import Excel</button>`:''}`)
  + `<div class="grid g5" style="margin-bottom:14px">
      ${stat('Tổng lead',DB.customers.length,'30 ngày: +'+DB.customers.filter(c=>daysBetween(c.created_at,TODAY)<=30).length,'inbox','up')}
      ${stat('Chưa phân bổ',unassigned,unassigned?(can('leads.assign')?'Bấm để mở màn phân bổ':'Chờ Admin phân bổ'):'Đã phân bổ hết','repeat',unassigned?'dn':'up',can('leads.assign')?"location.hash='#/admin/assign'":"S.filters.leads.assign='none';render()")}
      ${stat('Đã liên hệ',DB.customers.filter(c=>c.call_count>0).length,'Tỷ lệ tiếp cận '+Math.round(DB.customers.filter(c=>c.call_count>0).length/DB.customers.length*100)+'%','phone','flat')}
      ${stat('Đã đặt lịch',DB.customers.filter(c=>['APPOINTMENT_BOOKED','ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','PACKAGE_PENDING'].includes(c.status)).length,'','calendar','flat')}
      ${stat('Chốt liệu trình',DB.courses.filter(c=>c.status!=='pending').length,'Doanh thu '+moneyS(DB.payments.filter(p=>p.amount>0).reduce((a,b)=>a+b.amount,0))+'đ','package','up')}
    </div>
    <div class="card"><div class="toolbar">
      <input class="inp" style="min-width:230px" placeholder="Tìm tên / SĐT / mã KH…" value="${esc(f.q)}" oninput="S.filters.leads.q=this.value;clearTimeout(window._t);window._t=setTimeout(render,320)">
      <select class="inp" onchange="S.filters.leads.src=this.value;render()"><option value="">Tất cả nguồn</option>
        ${SOURCES.map(s=>`<option value="${s.code}" ${f.src===s.code?'selected':''}>${s.name}</option>`).join('')}</select>
      <select class="inp" onchange="S.filters.leads.cp=this.value;render()"><option value="">Tất cả chiến dịch</option>
        ${DB.campaigns.map(c=>`<option value="${c.id}" ${f.cp===c.id?'selected':''}>${c.name}</option>`).join('')}</select>
      <select class="inp" onchange="S.filters.leads.assign=this.value;render()"><option value="">Mọi người phụ trách</option>
        <option value="none" ${f.assign==='none'?'selected':''}>— Chưa phân bổ —</option>
        ${TELESALES.map(u=>`<option value="${u.id}" ${f.assign===u.id?'selected':''}>${u.name}</option>`).join('')}</select>
      <div style="margin-left:auto;font-size:12.5px;color:var(--muted)">Hiển thị <b>${Math.min(list.length,30)}</b> / ${list.length} bản ghi</div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th style="width:34px"><input type="checkbox" aria-label="Chọn tất cả" onchange="document.querySelectorAll('.lead-cb').forEach(c=>c.checked=this.checked)"></th>
      <th>Khách hàng</th><th>Điện thoại</th><th>Nguồn</th><th>Chiến dịch</th><th>Bệnh lý quan tâm</th><th>Trạng thái</th><th>Ngày có lead</th><th>Phụ trách</th><th></th></tr></thead>
      <tbody>${list.slice(0,30).map(c=>`<tr class="row-link">
        <td onclick="event.stopPropagation()"><input type="checkbox" class="lead-cb" value="${c.id}"></td>
        <td onclick="location.hash='#/customers/${c.id}'"><div class="t-name">${esc(c.name)}</div><div class="t-sub">${c.code} · ${c.gender==='M'?'Nam':'Nữ'} · ${age(c.dob)}t</div></td>
        <td><span class="t-phone" onclick="event.stopPropagation();callModal('${c.id}')">${fmtPhone(c.phone)}</span></td>
        <td><span class="badge ${srcColor(c.source)}">${srcName(c.source)}</span></td>
        <td style="max-width:170px"><div class="t-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((DB.campaigns.find(x=>x.id===c.campaign)||{name:'—'}).name)}</div></td>
        <td onclick="location.hash='#/customers/${c.id}'">${esc(c.concern)}</td>
        <td><span class="badge ${stColor(c.status)}">${stLabel(c.status)}</span></td>
        <td class="t-sub">${fmtD(c.created_at)}</td>
        <td>${c.assigned_to?`<div style="display:flex;align-items:center;gap:6px"><div class="avatar" style="width:22px;height:22px;font-size:9.5px">${initials(userName(c.assigned_to))}</div><span class="t-sub">${esc(userName(c.assigned_to).split(' ').slice(-2).join(' '))}</span></div>`:'<span class="badge b-red nodot">Chưa phân bổ</span>'}</td>
        <td><div class="row-actions">${can('leads.assign')?`<button class="btn sm" onclick="event.stopPropagation();openAssignOne('${c.id}')">Giao</button>`:''}
          <button class="btn sm" onclick="event.stopPropagation();location.hash='#/customers/${c.id}'">Xem</button></div></td>
      </tr>`).join('')}</tbody></table></div></div>`;
}
function openAssignOne(cid){
  const c=custById(cid);
  modal(`<div class="modal" style="max-width:440px"><div class="modal-h"><h3>Phân bổ lead cho Telesales</h3><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b"><div class="alert al-info">${ic('user',16)} <div><b>${esc(c.name)}</b> · ${fmtPhone(c.phone)}<br>${esc(c.concern)} · ${srcName(c.source)}</div></div>
  <label class="fld"><span class="lb">Chọn nhân viên Telesales <span class="req">*</span></span>
    <select class="inp" id="as-u">${TELESALES.map(u=>`<option value="${u.id}" ${c.assigned_to===u.id?'selected':''}>${u.name} — đang giữ ${DB.customers.filter(x=>x.assigned_to===u.id).length} lead</option>`).join('')}</select></label>
  <label class="fld"><span class="lb">Ghi chú bàn giao</span><textarea class="inp" placeholder="VD: Khách đã inbox hỏi giá, ưu tiên gọi trong 2h"></textarea></label></div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="doAssign('${cid}')">Phân bổ</button></div></div>`);
}
function doAssign(cid){ if(!can('leads.assign')) return toast('Chỉ Admin mới có quyền phân bổ lead','err');
  const c=custById(cid); const uid=$('#as-u').value; c.assigned_to=uid; if(c.status==='NEW_LEAD') c.status='ASSIGNED';
  tl(c.id,new Date(),'user','gray','Phân bổ cho Telesales',userName(uid),'Bởi '+S.user.name); DB.timeline.sort((a,b)=>b.at-a.at);
  closeModal(); toast('Đã phân bổ '+c.name+' cho '+userName(uid),'ok'); buildNav(); render(); }
function openAssignBulk(){
  const sel=[...document.querySelectorAll('.lead-cb:checked')].map(c=>c.value);
  const n=sel.length|| DB.customers.filter(c=>!c.assigned_to).length;
  modal(`<div class="modal" style="max-width:520px"><div class="modal-h"><h3>Phân bổ hàng loạt</h3><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
  <div class="alert al-info">${ic('info',16)} <div>Đang phân bổ <b>${n} lead</b> ${sel.length?'(đã chọn thủ công)':'(tất cả lead chưa có người phụ trách)'}.</div></div>
  <label class="fld"><span class="lb">Cách chia</span><select class="inp"><option>Chia đều cho các nhân viên được chọn</option><option>Chia theo tỷ lệ tải hiện tại (ít lead nhận nhiều hơn)</option><option>Dồn hết cho 1 nhân viên</option></select></label>
  <div class="sec-t">Chọn nhân viên nhận lead</div>
  ${TELESALES.map((u,i)=>`<label style="display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;margin-bottom:6px;cursor:pointer">
    <input type="checkbox" class="bulk-u" value="${u.id}" ${i<4?'checked':''}>
    <div class="avatar" style="width:26px;height:26px;font-size:10px">${initials(u.name)}</div>
    <div style="flex:1"><div style="font-weight:650">${u.name}</div><div class="t-sub">Đang giữ ${DB.customers.filter(x=>x.assigned_to===u.id).length} lead · ${DB.calls.filter(c=>c.user_id===u.id&&sameDay(c.at,TODAY)).length} cuộc gọi hôm nay</div></div>
    <span class="badge b-teal nodot" id="pv-${u.id}">—</span></label>`).join('')}
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="doBulkAssign(${n})">Phân bổ ${n} lead</button></div></div>`);
}
function doBulkAssign(n){
  if(!can('leads.assign')) return toast('Chỉ Admin mới có quyền phân bổ lead','err');
  const us=[...document.querySelectorAll('.bulk-u:checked')].map(c=>c.value);
  if(!us.length) return toast('Chọn ít nhất một nhân viên','err');
  const sel=[...document.querySelectorAll('.lead-cb:checked')].map(c=>c.value);
  const targets = sel.length? sel.map(custById) : DB.customers.filter(c=>!c.assigned_to);
  targets.forEach((c,i)=>{ c.assigned_to=us[i%us.length]; if(c.status==='NEW_LEAD') c.status='ASSIGNED'; });
  closeModal(); toast('Đã phân bổ '+targets.length+' lead cho '+us.length+' nhân viên','ok'); buildNav(); render();
}

/* ================= IMPORT WIZARD ================= */
S.imp={step:1, map:null, dupMode:'ask'};
function viewImport(){
  const I=DB.importSample; const st=S.imp.step;
  if(!S.imp.map) S.imp.map=I.autoMap.slice();
  const steps=['Tải file','Chọn sheet','Ghép cột','Xem trước','Kiểm tra lỗi','Import'];
  let body='';
  if(st===1) body=`
    <div class="dropzone" id="dz" onclick="S.imp.step=2;render()" ondragover="event.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')" ondrop="event.preventDefault();S.imp.step=2;render()">
      <div class="ic-box">${ic('file',16)}</div>
      <div style="font-weight:700;font-size:15px;margin-bottom:4px">Kéo thả file vào đây hoặc bấm để chọn</div>
      <div style="color:var(--muted);font-size:13px">Hỗ trợ .xlsx, .xls, .csv · Tối đa 10.000 dòng / lần import</div>
      <button class="btn primary" style="margin-top:14px">Chọn file từ máy tính</button>
    </div>
    <div class="alert al-info" style="margin-top:14px">${ic('info',16)} <div>Không bắt buộc file Excel phải đúng tên cột. Hệ thống tự nhận diện các biến thể như <b>“SĐT”, “Số ĐT”, “Điện thoại”, “Phone”</b> và ghép vào trường <b>phone</b>. Bạn vẫn có thể chỉnh lại ở bước Ghép cột.</div></div>
    <div style="margin-top:14px"><button class="btn sm" onclick="downloadLeadTemplate()">${ic('download',16)} Tải file Excel mẫu</button></div>`;
  if(st===2) body=`
    <div class="alert al-ok">${ic('check',15)} <div>Đã đọc file <b>${I.filename}</b> (2,4 MB) · 3 sheet</div></div>
    <div class="sec-t">Chọn sheet chứa dữ liệu</div>
    ${I.sheets.map((s,i)=>`<label style="display:flex;align-items:center;gap:11px;padding:12px 14px;border:1px solid ${i===0?'var(--brand)':'var(--line)'};background:${i===0?'var(--brand-50)':'#fff'};border-radius:11px;margin-bottom:7px;cursor:pointer">
      <input type="radio" name="sheet" ${i===0?'checked':''}><div style="flex:1"><div style="font-weight:650">${s}</div>
      <div class="t-sub">${i===0?'15 cột · dòng 1 là tiêu đề':i===1?'22 cột · dữ liệu thô chưa làm sạch':'3 cột · ghi chú nội bộ'}</div></div>
      ${i===0?'<span class="badge b-green nodot">Đề xuất</span>':''}</label>`).join('')}
    <label class="fld" style="margin-top:12px"><span class="lb">Dòng tiêu đề</span><input class="inp" value="1" style="max-width:120px"></label>`;
  if(st===3) body=`
    <div class="alert al-ok">${ic('check',15)} <div>Hệ thống đã tự ghép <b>14/15 cột</b>. Vui lòng kiểm tra lại các trường bắt buộc (<b>Họ tên</b>, <b>Số điện thoại</b>).</div></div>
    <div class="tbl-wrap"><table><thead><tr><th style="width:30%">Cột trong file Excel</th><th style="width:26%">Dữ liệu mẫu</th><th style="width:30%">Ghép vào trường hệ thống</th><th>Trạng thái</th></tr></thead>
    <tbody>${I.headers.map((h,i)=>`<tr>
      <td><b>${h}</b><div class="t-sub">Cột ${String.fromCharCode(65+i)}</div></td>
      <td class="t-sub">${esc(I.rows[0][i]||'—')}</td>
      <td><select class="inp sm" style="width:100%" onchange="S.imp.map[${i}]=this.value">
        ${I.fields.map(f=>`<option value="${f.key}" ${S.imp.map[i]===f.key?'selected':''}>${f.label}</option>`).join('')}</select></td>
      <td>${S.imp.map[i]?'<span class="badge b-green">Đã ghép</span>':'<span class="badge b-gray">Bỏ qua</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  if(st===4){
    const cols=S.imp.map.map((k,i)=>({k,i,label:(I.fields.find(f=>f.key===k)||{}).label})).filter(c=>c.k);
    body=`<div class="alert al-info">${ic('info',16)} <div>Xem trước <b>8 dòng đầu</b> trong tổng số <b>903 dòng</b>. Dữ liệu đã được chuẩn hóa: số điện thoại bỏ dấu chấm/khoảng trắng, +84 ${ic('arrowRight',15)} 0.</div></div>
    <div class="tbl-wrap"><table><thead><tr><th>#</th>${cols.map(c=>`<th>${c.label.replace(' *','')}</th>`).join('')}</tr></thead>
    <tbody>${I.rows.map((r,ri)=>{
      const phoneIdx=cols.find(c=>c.k==='phone');
      const bad = phoneIdx && !normPhone(r[phoneIdx.i]);
      return `<tr style="${bad?'background:var(--danger-bg)':''}"><td class="t-sub">${ri+1}</td>${cols.map(c=>{
        let v=r[c.i]||'';
        if(c.k==='phone'){ const n=normPhone(v); v=n?`<span class="mono">${fmtPhone(n)}</span>${n!==String(r[c.i]).replace(/[^\d]/g,'')?' <span class="t-sub">(đã chuẩn hóa)</span>':''}`:'<span class="badge b-red nodot">Thiếu SĐT</span>'; return `<td>${v}</td>`; }
        return `<td>${esc(v)||'<span class="t-sub">—</span>'}</td>`;}).join('')}</tr>`}).join('')}</tbody></table></div>`;
  }
  if(st===5){ const R=I.result;
    body=`<div class="grid g4" style="margin-bottom:16px">
      ${stat('Tổng số dòng',R.total,'','file')}${stat('Hợp lệ',R.valid,'Sẵn sàng import','check')}
      ${stat('Thiếu SĐT',R.missing_phone,'Sẽ bị bỏ qua','alert',R.missing_phone?'dn':'up')}
      ${stat('SĐT đã tồn tại',R.dup_existing,'Cần chọn cách xử lý','repeat','dn')}</div>
    <div class="alert al-warn">${ic('alert',16)} <div><b>${R.dup_existing} số điện thoại đã có trong hệ thống.</b> Hệ thống không tự tạo lead trùng — hãy chọn cách xử lý bên dưới.</div></div>
    <div class="sec-t">Xử lý bản ghi trùng số điện thoại</div>
    ${[['ask','Hỏi từng bản ghi','Xem chi tiết từng trường hợp rồi quyết định (an toàn nhất)'],
       ['skip','Bỏ qua','Giữ nguyên dữ liệu cũ, không tạo mới'],
       ['update','Cập nhật bản ghi cũ','Ghi đè thông tin mới lên hồ sơ hiện có, giữ nguyên lịch sử &amp; timeline'],
       ['new','Tạo bản ghi mới','Chấp nhận trùng số (dùng khi 2 người dùng chung một SĐT)']].map(([k,t,d2])=>`
      <label style="display:flex;gap:11px;padding:11px 13px;border:1px solid ${S.imp.dupMode===k?'var(--brand)':'var(--line)'};background:${S.imp.dupMode===k?'var(--brand-50)':'#fff'};border-radius:11px;margin-bottom:6px;cursor:pointer">
      <input type="radio" name="dup" ${S.imp.dupMode===k?'checked':''} onchange="S.imp.dupMode='${k}';render()">
      <div><div style="font-weight:650">${t}</div><div class="t-sub">${d2}</div></div></label>`).join('')}
    <div class="divider"></div>
    <div class="sec-t">Gán thông tin chung cho lô import</div>
    <div class="grid g3">
      <label class="fld"><span class="lb">Nguồn mặc định</span><select class="inp">${SOURCES.map(s=>`<option ${s.code==='facebook'?'selected':''}>${s.name}</option>`).join('')}</select></label>
      <label class="fld"><span class="lb">Chiến dịch</span><select class="inp">${DB.campaigns.map(c=>`<option>${c.name}</option>`).join('')}</select></label>
      <label class="fld"><span class="lb">Phân bổ ngay cho</span><select class="inp"><option>— Không phân bổ —</option><option selected>Chia đều 5 Telesales</option>${TELESALES.map(u=>`<option>${u.name}</option>`).join('')}</select></label>
    </div>
    <button class="btn sm" onclick="downloadLeadErrors()">${ic('download',16)} Tải báo cáo ${R.missing_phone+R.dup_existing} dòng cần xem lại</button>`;
  }
  if(st===6){ const R=I.result;
    body=`<div style="text-align:center;padding:26px 10px">
      <div style="font-size:50px">${ic('checkCircle',16)}</div>
      <h2 style="margin:10px 0 4px;font-size:22px">Import hoàn tất</h2>
      <p style="color:var(--muted);margin:0 0 20px">Lô import <b>BATCH-0829</b> · thực hiện bởi ${esc(S.user.name)} lúc ${fmtT(new Date())}</p>
      <div class="grid g4" style="text-align:left;max-width:720px;margin:0 auto">
        ${stat('Tạo mới',R.valid-R.dup_existing,'Lead mới vào hệ thống','check')}
        ${stat('Cập nhật',S.imp.dupMode==='update'?R.dup_existing:0,'Hồ sơ trùng SĐT','repeat')}
        ${stat('Bỏ qua',R.missing_phone+(S.imp.dupMode==='skip'?R.dup_existing:0),'Thiếu SĐT / trùng','⊘')}
        ${stat('Đã phân bổ',R.valid-R.dup_existing,'Chia đều 5 Telesales','user')}
      </div>
      <div style="margin-top:22px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn" onclick="downloadImportReport()">${ic('download',16)} Tải báo cáo import</button>
        <button class="btn" onclick="S.imp={step:1,map:null,dupMode:'ask'};render()">Import file khác</button>
        <button class="btn primary" onclick="location.hash='#/leads'">Xem danh sách lead ${ic('arrowRight',15)}</button>
      </div></div>`;
  }
  return head('Import khách hàng từ Excel','Marketing › Khách hàng tiềm năng › Import',
    `<button class="btn" onclick="location.hash='#/leads'">${ic('arrowLeft',15)} Quay lại danh sách</button>`)
  + `<div class="card"><div class="card-b">
      <div class="steps">${steps.map((s,i)=>`${i?'<div class="step-line"></div>':''}
        <div class="step ${st===i+1?'on':''} ${st>i+1?'done':''}"><span class="n">${st>i+1?ic('check',15):i+1}</span>${s}</div>`).join('')}</div>
      ${body}
      ${st<6?`<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--line)">
        ${st>1?`<button class="btn" onclick="S.imp.step--;render()">${ic('arrowLeft',15)} Quay lại</button>`:''}
        <button class="btn primary" onclick="S.imp.step++;render()">${st===5?'Bắt đầu import 850 dòng':'Tiếp tục '+ic('arrowRight',15)}</button></div>`:''}
    </div></div>`;
}

/* ================= TELESALES ================= */
function viewTelesales(){
  const f=S.filters.ts=S.filters.ts||{tab:'today',q:''};
  const all=myLeads();
  const groups={
    today:{lb:'Cần gọi hôm nay', fn:c=>needCallToday(c)&&!['NOT_INTERESTED','TREATMENT_COMPLETED'].includes(c.status)},
    new:{lb:'Lead mới được giao', fn:c=>['ASSIGNED','NEW_LEAD'].includes(c.status)},
    contacting:{lb:'Đang theo dõi', fn:c=>c.status==='CONTACTING'},
    callback:{lb:'Hẹn gọi lại', fn:c=>c.status==='CALLBACK'},
    interested:{lb:'Khách quan tâm', fn:c=>c.status==='INTERESTED'},
    booked:{lb:'Đã đặt lịch', fn:c=>c.status==='APPOINTMENT_BOOKED'},
    noanswer:{lb:'Không nghe máy', fn:c=>c.status==='NO_ANSWER'},
    overdue:{lb:'Quá hạn', fn:c=>c.next_call&&c.next_call<d(0,0,0)},
    lost:{lb:'Không quan tâm', fn:c=>c.status==='NOT_INTERESTED'},
    all:{lb:'Tất cả', fn:()=>true},
  };
  let list=all.filter(groups[f.tab].fn);
  if(f.q){const q=f.q.toLowerCase(),nq=normPhone(f.q); list=list.filter(c=>c.name.toLowerCase().includes(q)||normPhone(c.phone).includes(nq));}
  list.sort((a,b)=>(a.next_call?a.next_call:a.created_at)-(b.next_call?b.next_call:b.created_at));
  window._tsList=list;
  const myCalls=DB.calls.filter(c=>c.user_id===S.user.id&&sameDay(c.at,TODAY)).length;

  return head('Danh sách khách hàng cần gọi', S.user.roles.includes('telesales')&&!S.user.roles.includes('admin')?'Bạn đang xem <b>lead được giao cho '+esc(S.user.name)+'</b> — hệ thống chặn truy cập lead của người khác ở tầng máy chủ (RLS).':'Xem toàn bộ lead (quyền Admin)',
    `${can('data.export')?`<button class="btn" onclick="exportCallList(window._tsList||[])">${ic('download',16)} Xuất danh sách</button>`:''}
     <button class="btn primary" onclick="openBooking()">${ic('calendarPlus',16)} Đặt lịch khám</button>`)
  + `<div class="grid g6" style="margin-bottom:14px">
      ${stat('Cần gọi hôm nay',all.filter(groups.today.fn).length,'','clock','dn',"S.filters.ts.tab='today';render()")}
      ${stat('Lead mới',all.filter(groups.new.fn).length,'','inbox','flat',"S.filters.ts.tab='new';render()")}
      ${stat('Hẹn gọi lại',all.filter(groups.callback.fn).length,'','undo','flat',"S.filters.ts.tab='callback';render()")}
      ${stat('Quan tâm',all.filter(groups.interested.fn).length,'','star','up',"S.filters.ts.tab='interested';render()")}
      ${stat('Đã đặt lịch',all.filter(groups.booked.fn).length,'','calendar','up',"S.filters.ts.tab='booked';render()")}
      ${stat('Cuộc gọi hôm nay',myCalls,'Mục tiêu 60 cuộc/ngày','phone','flat')}
    </div>
    <div class="card">
      <div class="tabs">${Object.entries(groups).map(([k,g])=>`<div class="tab ${f.tab===k?'on':''}" onclick="S.filters.ts.tab='${k}';render()">${g.lb}<span class="cnt">${all.filter(g.fn).length}</span></div>`).join('')}</div>
      <div class="toolbar"><input class="inp" style="min-width:250px" placeholder="Tìm nhanh tên hoặc số điện thoại…" value="${esc(f.q)}" oninput="S.filters.ts.q=this.value;clearTimeout(window._t);window._t=setTimeout(render,300)">
        <div style="margin-left:auto;font-size:12.5px;color:var(--muted)">${ic('info',16)} Bấm vào <b>số điện thoại</b> để gọi · bấm vào <b>tên</b> để mở hồ sơ 360°</div></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Họ tên</th><th>Điện thoại</th><th>Nguồn</th><th>Chiến dịch</th><th>Nhu cầu / Bệnh lý</th><th>Tình trạng</th><th>Lần gọi cuối</th><th>Lịch gọi lại</th><th>Phụ trách</th><th style="width:150px">Thao tác</th></tr></thead>
        <tbody>${list.length?list.slice(0,40).map(c=>{
          const over=c.next_call&&c.next_call<d(0,0,0);
          return `<tr>
          <td class="row-link" onclick="location.hash='#/customers/${c.id}'"><div class="t-name">${esc(c.name)}</div><div class="t-sub">${c.code} · ${c.gender==='M'?'Nam':'Nữ'} ${age(c.dob)}t · ${c.call_count} cuộc gọi</div></td>
          <td><span class="t-phone" onclick="callModal('${c.id}')">${fmtPhone(c.phone)}</span></td>
          <td><span class="badge ${srcColor(c.source)}">${srcName(c.source)}</span></td>
          <td class="t-sub" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((DB.campaigns.find(x=>x.id===c.campaign)||{name:'—'}).name)}</td>
          <td><div style="font-size:13px">${esc(c.need)}</div><div class="t-sub">${esc(c.concern)}</div></td>
          <td><span class="badge ${stColor(c.status)}">${stLabel(c.status)}</span></td>
          <td class="t-sub">${c.last_call?fmtDT(c.last_call):'—'}</td>
          <td>${c.next_call?`<span class="badge ${over?'b-red':'b-amber'}">${fmtDT(c.next_call)}</span>`:'<span class="t-sub">—</span>'}</td>
          <td class="t-sub">${c.assigned_to?esc(userName(c.assigned_to).split(' ').slice(-2).join(' ')):'—'}</td>
          <td><div style="display:flex;gap:5px"><button class="btn sm primary" onclick="callModal('${c.id}')">${ic('phone',15)} Gọi</button>
            <button class="btn sm" onclick="openBooking('${c.id}')">${ic('calendar',16)}</button>
            <button class="btn sm" onclick="openNote('${c.id}')">${ic('edit',16)}</button></div></td></tr>`}).join('')
          :`<tr><td colspan="10"><div class="empty"><div class="ic-box">${ic('checkCircle',16)}</div><div class="t">Không có khách nào trong nhóm này</div><div>Chuyển sang nhóm khác hoặc chờ lead mới được phân bổ.</div></div></td></tr>`}</tbody></table></div>
    </div>`;
}

/* ---------- CALL FLOW ---------- */
function callModal(cid){
  const c=custById(cid);
  const hist=DB.calls.filter(x=>x.customer_id===cid).sort((a,b)=>b.at-a.at);
  modal(`<div class="modal wide"><div class="modal-h"><h3>Gọi khách hàng</h3><span class="badge ${stColor(c.status)}">${stLabel(c.status)}</span><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="grid g-1-2">
      <div>
        <div style="text-align:center;padding:18px 12px;background:linear-gradient(135deg,#0B4F4A,#0E9F8E);border-radius:14px;color:#fff">
          <div class="avatar" style="width:56px;height:56px;font-size:19px;margin:0 auto 10px;background:rgba(255,255,255,.2);color:#fff">${initials(c.name)}</div>
          <div style="font-size:18px;font-weight:750">${esc(c.name)}</div>
          <div style="opacity:.9;font-size:13px;margin-top:2px">${c.code} · ${c.gender==='M'?'Nam':'Nữ'} · ${age(c.dob)} tuổi</div>
          <div class="mono" style="font-size:20px;font-weight:750;margin:12px 0 4px;letter-spacing:1px">${fmtPhone(c.phone)}</div>
          ${can('customer.view_phone')
            ? `<a href="tel:${c.phone}" class="btn lg w" style="background:#fff;color:var(--brand-700);border-color:#fff;margin-top:8px;display:inline-flex" onclick="toast('Đang khởi tạo cuộc gọi qua tel: — sẵn sàng thay bằng CallProvider (VoIP)','ok')">${ic('phone',15)} GỌI NGAY</a>`
            : `<div style="margin-top:8px;font-size:12.5px;opacity:.9">${ic('lock',14)} Bạn không có quyền xem/gọi số điện thoại đầy đủ</div>`}
          ${c.phone2?`<div style="font-size:12px;margin-top:9px;opacity:.85">SĐT phụ: ${fmtPhone(c.phone2)}</div>`:''}
        </div>
        <div class="kv" style="margin-top:14px">
          <div class="k">Nguồn</div><div class="v">${srcName(c.source)}</div>
          <div class="k">Chiến dịch</div><div class="v" style="font-size:12.5px">${esc((DB.campaigns.find(x=>x.id===c.campaign)||{name:'—'}).name)}</div>
          <div class="k">Nhu cầu</div><div class="v">${esc(c.need)}</div>
          <div class="k">Bệnh lý</div><div class="v">${esc(c.concern)}</div>
          <div class="k">Địa chỉ</div><div class="v" style="font-size:12.5px;font-weight:500">${esc(c.address)}</div>
        </div>
        <div class="divider"></div>
        <div class="sec-t">Lịch sử gọi (${hist.length})</div>
        <div style="max-height:180px;overflow-y:auto">${hist.length?hist.map(h=>`<div style="padding:8px 0;border-bottom:1px solid #F1F5F7">
          <div style="display:flex;gap:6px;align-items:center"><span class="badge ${crColor(h.result)}">${crLabel(h.result)}</span><span class="t-sub">${fmtDT(h.at)}</span></div>
          <div style="font-size:12.5px;color:var(--ink-2);margin-top:3px">${esc(h.note)}</div></div>`).join(''):'<div class="t-sub">Chưa có cuộc gọi nào.</div>'}</div>
      </div>
      <div>
        <div class="sec-t">Kết quả cuộc gọi <span style="color:var(--danger)">*</span></div>
        <div class="chips" style="margin-bottom:14px">${CALL_RESULTS.map((r,i)=>`<div class="chip ${i===5?'on':''}" data-res="${r.code}" onclick="pickResult(this,'${r.code}')">${r.label}</div>`).join('')}</div>
        <div class="grid g2">
          <label class="fld"><span class="lb">Nhu cầu khách hàng</span><select class="inp" id="cl-need">${NHU_CAU.map(n=>`<option ${n===c.need?'selected':''}>${n}</option>`).join('')}</select></label>
          <label class="fld"><span class="lb">Bệnh lý khách mô tả</span><select class="inp" id="cl-concern">${BENH_LY.map(n=>`<option ${n===c.concern?'selected':''}>${n}</option>`).join('')}</select></label>
        </div>
        <label class="fld"><span class="lb">Mức độ quan tâm</span>
          <div class="chips" id="cl-interest">${[1,2,3,4,5].map(i=>`<div class="chip ${i===4?'on':''}" onclick="[...this.parentNode.children].forEach(x=>x.classList.remove('on'));this.classList.add('on')">${ic('star',14).repeat(i)}</div>`).join('')}</div></label>
        <label class="fld"><span class="lb">Ghi chú cuộc gọi</span><textarea class="inp" id="cl-note" placeholder="VD: Khách quan tâm gói PHCN cột sống, muốn đến khám thứ 7 sáng…"></textarea></label>
        <div id="cl-callback" style="display:none">
          <div class="grid g2"><label class="fld"><span class="lb">Ngày gọi lại</span><input class="inp" type="date" id="cl-date" value="${new Date(TODAY.getTime()+86400000).toISOString().slice(0,10)}"></label>
          <label class="fld"><span class="lb">Giờ gọi lại</span><input class="inp" type="time" id="cl-time" value="09:30"></label></div>
        </div>
        <div id="cl-booked" class="alert al-info" style="display:none">${ic('calendar',16)} <div>Sau khi lưu, hệ thống sẽ mở ngay form <b>Đặt lịch khám</b> cho khách này.</div></div>
      </div>
    </div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveCall('${cid}')">Lưu kết quả cuộc gọi</button></div></div>`);
  window._callRes='interested';
}
function pickResult(node,code){
  [...node.parentNode.children].forEach(x=>x.classList.remove('on')); node.classList.add('on');
  window._callRes=code;
  $('#cl-callback').style.display = code==='callback'?'block':'none';
  $('#cl-booked').style.display = code==='booked'?'flex':'none';
}
function saveCall(cid){
  const c=custById(cid), res=window._callRes||'other', note=$('#cl-note').value.trim();
  const now=new Date();
  const rec={id:'CL'+(DB.calls.length+1), customer_id:cid, user_id:S.user.id, at:now, result:res, duration:ri(40,300),
    note:note||'(không ghi chú)', need:$('#cl-need').value, concern:$('#cl-concern').value,
    interest:[...$('#cl-interest').children].findIndex(x=>x.classList.contains('on'))+1, next_call:null};
  if(res==='callback'){ const dt=new Date($('#cl-date').value+'T'+$('#cl-time').value); rec.next_call=dt; c.next_call=dt; }
  DB.calls.push(rec); c.last_call=now; c.call_count++; c.need=rec.need; c.concern=rec.concern; c.interest=rec.interest;
  const next=(CALL_RESULTS.find(r=>r.code===res)||{}).next;
  if(next && (DB.transitions[c.status]||[]).includes(next)) c.status=next;
  else if(next && next!==c.status) toast('Trạng thái "'+stLabel(next)+'" không hợp lệ từ "'+stLabel(c.status)+'" — đã giữ nguyên (state machine)','warn');
  tl(cid,now,'phone','amber',S.user.name+' gọi điện','→ '+crLabel(res)+(note?' · '+note:''),'Thời lượng '+Math.floor(rec.duration/60)+'p'+(rec.duration%60)+'s');
  DB.timeline.sort((a,b)=>b.at-a.at);
  closeModal(); toast('Đã lưu kết quả cuộc gọi: '+crLabel(res),'ok');
  if(res==='booked') setTimeout(()=>openBooking(cid),260); else { buildNav(); render(); }
}
function openNote(cid){
  const c=custById(cid);
  modal(`<div class="modal" style="max-width:460px"><div class="modal-h"><h3>Ghi chú nhanh — ${esc(c.name)}</h3><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b"><label class="fld"><span class="lb">Nội dung ghi chú</span><textarea class="inp" id="nt-x" style="min-height:110px" placeholder="Ghi chú sẽ được lưu vào timeline khách hàng và không thể xóa."></textarea></label>
  <label class="fld"><span class="lb">Loại ghi chú</span><select class="inp"><option>Ghi chú chăm sóc</option><option>Ghi chú hành chính</option><option>Phản hồi khách hàng</option><option>Khiếu nại</option></select></label></div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveNote('${cid}')">Lưu ghi chú</button></div></div>`);
}
function saveNote(cid){ const v=$('#nt-x').value.trim(); if(!v) return toast('Nhập nội dung ghi chú','err');
  tl(cid,new Date(),'edit','gray','Ghi chú của '+S.user.name,v,''); DB.timeline.sort((a,b)=>b.at-a.at); closeModal(); toast('Đã lưu ghi chú vào timeline','ok'); render(); }

/* ---------- BOOKING ---------- */
function openBooking(cid){
  const c=cid?custById(cid):null;
  const dstr=new Date(TODAY.getTime()+86400000).toISOString().slice(0,10);
  modal(`<div class="modal wide"><div class="modal-h"><h3>Đặt lịch khám</h3><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b"><div class="grid g-1-2">
    <div>
      ${c?`<div class="alert al-ok">${ic('user',16)} <div><b>${esc(c.name)}</b> · ${fmtPhone(c.phone)}<br><span class="t-sub">${c.code} · ${esc(c.concern)}</span><br><span class="t-sub">Dùng lại hồ sơ khách hàng sẵn có — không tạo bản ghi trùng.</span></div></div>`
        :`<label class="fld"><span class="lb">Khách hàng <span class="req">*</span></span>
          <input class="inp" id="bk-search" placeholder="Nhập SĐT hoặc tên để tìm…" oninput="bkSearch(this.value)">
          <div class="hint">Không tìm thấy? <a style="color:var(--brand);font-weight:600;cursor:pointer" onclick="closeModal();openCustomerForm(null,$('#bk-search')?$('#bk-search').value:'')">Tạo khách hàng mới</a></div>
          <div id="bk-res"></div></label>`}
      <div class="grid g2">
        <label class="fld"><span class="lb">Ngày khám <span class="req">*</span></span><input class="inp" type="date" id="bk-date" value="${dstr}" onchange="bkSlots()"></label>
        <label class="fld"><span class="lb">Giờ <span class="req">*</span></span><input class="inp" type="time" id="bk-time" value="09:00"></label>
      </div>
      <label class="fld"><span class="lb">Cơ sở</span><select class="inp">${DB.branches.map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}</select></label>
      <div class="grid g2">
        <label class="fld"><span class="lb">Bác sĩ</span><select class="inp" id="bk-doc" onchange="bkSlots()"><option value="">— Chưa chỉ định —</option>${DOCTORS.map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}</select></label>
        <label class="fld"><span class="lb">Phòng</span><select class="inp" id="bk-room" onchange="bkSlots()">${DB.rooms.filter(r=>r.branch==='B1').map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select></label>
      </div>
      <label class="fld"><span class="lb">Loại lịch</span><select class="inp"><option>Khám lần đầu</option><option>Tái khám</option><option>Buổi điều trị</option><option>Tư vấn liệu trình</option><option>Lượng giá định kỳ</option></select></label>
      <label class="fld"><span class="lb">Ghi chú</span><textarea class="inp" placeholder="VD: Khách đi cùng người nhà, cần hỗ trợ xe lăn"></textarea></label>
    </div>
    <div>
      <div class="sec-t">Lịch đang có trong ngày — tránh đặt trùng</div>
      <div id="bk-slots" class="card" style="box-shadow:none"></div>
      <div class="alert al-warn" style="margin-top:12px">${ic('alert',16)} <div>Hệ thống chặn hai lịch dùng cùng <b>phòng</b> hoặc cùng <b>bác sĩ</b> tại cùng thời điểm (trừ khi resource được cấu hình cho phép overlap).</div></div>
    </div>
  </div></div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveBooking('${cid||''}')">Xác nhận đặt lịch</button></div></div>`);
  bkSlots();
}
function bkSearch(q){
  const box=$('#bk-res'); if(!q||q.length<2){box.innerHTML='';return;}
  const nq=normPhone(q),lq=q.toLowerCase();
  const r=DB.customers.filter(c=>normPhone(c.phone).includes(nq)||c.name.toLowerCase().includes(lq)).slice(0,5);
  box.innerHTML=r.map(c=>`<div class="sr-item" style="border:1px solid var(--line);border-radius:9px;margin-top:5px" onclick="window._bkCust='${c.id}';$('#bk-search').value='${esc(c.name)} — ${fmtPhone(c.phone)}';$('#bk-res').innerHTML=''">
    <div style="flex:1"><div style="font-weight:650">${esc(c.name)}</div><div class="cd">${fmtPhone(c.phone)} · ${c.code}</div></div>
    <span class="badge ${stColor(c.status)}">${stLabel(c.status)}</span></div>`).join('');
}
function bkSlots(){
  const box=$('#bk-slots'); if(!box) return;
  const date=new Date($('#bk-date').value+'T00:00:00');
  const doc=$('#bk-doc')?$('#bk-doc').value:''; const room=$('#bk-room')?$('#bk-room').value:'';
  const day=DB.appointments.filter(a=>sameDay(a.at,date)&&a.status!=='cancelled');
  const rows=[];
  for(let h=8;h<=17;h++) for(const m of [0,30]){
    if(h===12) continue;
    const t=new Date(date); t.setHours(h,m,0,0);
    const conflicts=day.filter(a=>Math.abs(a.at-t)<30*60000 && (a.doctor===doc||a.room===room));
    const others=day.filter(a=>Math.abs(a.at-t)<30*60000);
    rows.push({t,conflicts,others});
  }
  box.innerHTML=`<div style="max-height:340px;overflow-y:auto">${rows.map(r=>`
    <div style="display:flex;gap:9px;align-items:center;padding:7px 11px;border-bottom:1px solid #F1F5F7;${r.conflicts.length?'background:var(--danger-bg)':''}">
      <span class="mono" style="font-weight:700;width:44px">${fmtT(r.t)}</span>
      <div style="flex:1;font-size:12.5px">${r.others.length?r.others.map(a=>esc(custById(a.customer_id).name.split(' ').slice(-2).join(' '))+' <span class="t-sub">('+(DB.rooms.find(x=>x.id===a.room)||{name:''}).name+')</span>').join(', '):'<span class="t-sub">Trống</span>'}</div>
      ${r.conflicts.length?'<span class="badge b-red">Trùng resource</span>':'<button class="btn sm" onclick="$(\'#bk-time\').value=\''+fmtT(r.t)+'\'">Chọn</button>'}
    </div>`).join('')}</div>`;
}
function saveBooking(cid){
  const id=cid||window._bkCust;
  if(!id) return toast('Vui lòng chọn khách hàng','err');
  const c=custById(id);
  const at=new Date($('#bk-date').value+'T'+$('#bk-time').value);
  const doc=$('#bk-doc').value||pick(DOCTORS).id, room=$('#bk-room').value;
  const clash=DB.appointments.find(a=>a.status!=='cancelled'&&Math.abs(a.at-at)<30*60000&&(a.room===room||a.doctor===doc));
  if(clash) return toast('Trùng lịch: '+(DB.rooms.find(r=>r.id===room)||{name:''}).name+' / '+userName(doc)+' đã có khách lúc '+fmtT(clash.at),'err');
  const a=addAppt({customer_id:id, at, status:'booked', doctor:doc, room, type:'Khám lần đầu', booked_by:S.user.id});
  DB.appointments.sort((x,y)=>x.at-y.at);
  if((DB.transitions[c.status]||[]).includes('APPOINTMENT_BOOKED')) c.status='APPOINTMENT_BOOKED';
  if(c.lifecycle==='lead') c.lifecycle='customer';
  tl(id,new Date(),'calendar','purple','Đặt lịch khám',fmtDT(at)+' · '+userName(doc),'Người đặt: '+S.user.name);
  DB.timeline.sort((x,y)=>y.at-x.at);
  closeModal(); toast('Đã đặt lịch cho '+c.name+' lúc '+fmtDT(at),'ok'); buildNav(); render();
}

/* ================= CUSTOMERS ================= */
function viewCustomers(){
  const f=S.filters.cus=S.filters.cus||{q:'',lc:'',st:''};
  let list=DB.customers.slice();
  if(f.lc) list=list.filter(c=>c.lifecycle===f.lc);
  if(f.st) list=list.filter(c=>c.status===f.st);
  if(f.q){const q=f.q.toLowerCase(),nq=normPhone(f.q); list=list.filter(c=>c.name.toLowerCase().includes(q)||normPhone(c.phone).includes(nq)||c.code.toLowerCase().includes(q));}
  list.sort((a,b)=>b.created_at-a.created_at);
  window._cusList=list;
  const lc={lead:'Lead',customer:'Khách hàng',patient:'Bệnh nhân'};
  return head('Hồ sơ khách hàng','Một người – một hồ sơ duy nhất. Trạng thái vòng đời thay đổi theo hành trình (Lead '+ic('arrowRight',15)+' Khách hàng '+ic('arrowRight',15)+' Bệnh nhân).',
    `${can('data.export')?`<button class="btn" onclick="exportCustomers(window._cusList||[])">${ic('download',16)} Xuất Excel</button>`:''}
     <button class="btn primary" onclick="openCustomerForm()">${ic('userPlus',16)} Thêm khách hàng</button>`)
  + `<div class="grid g4" style="margin-bottom:14px">
    ${stat('Tổng hồ sơ',DB.customers.length,'','users')}
    ${stat('Lead',DB.customers.filter(c=>c.lifecycle==='lead').length,'Chưa đặt lịch','inbox',"","S.filters.cus.lc='lead';render()")}
    ${stat('Khách hàng',DB.customers.filter(c=>c.lifecycle==='customer').length,'Đã đặt lịch / đã đến','userCheck')}
    ${stat('Bệnh nhân',DB.customers.filter(c=>c.lifecycle==='patient').length,'Có hồ sơ khám / liệu trình','stethoscope')}
  </div>
  <div class="card"><div class="toolbar">
    <input class="inp" style="min-width:260px" placeholder="Tìm theo tên, SĐT, mã KH…" value="${esc(f.q)}" oninput="S.filters.cus.q=this.value;clearTimeout(window._t);window._t=setTimeout(render,300)">
    <select class="inp" onchange="S.filters.cus.lc=this.value;render()"><option value="">Mọi vòng đời</option>${Object.entries(lc).map(([k,v])=>`<option value="${k}" ${f.lc===k?'selected':''}>${v}</option>`).join('')}</select>
    <select class="inp" onchange="S.filters.cus.st=this.value;render()"><option value="">Mọi trạng thái</option>${Object.entries(DB.statuses).map(([k,v])=>`<option value="${k}" ${f.st===k?'selected':''}>${v.label}</option>`).join('')}</select>
    <div style="margin-left:auto;font-size:12.5px;color:var(--muted)">${list.length} hồ sơ</div></div>
  <div class="tbl-wrap"><table><thead><tr><th>Mã KH</th><th>Họ tên</th><th>Điện thoại</th><th>Tuổi / GT</th><th>Nguồn</th><th>Vòng đời</th><th>Trạng thái</th><th>Liệu trình</th><th>Công nợ</th><th>Ngày tạo</th></tr></thead>
  <tbody>${list.slice(0,40).map(c=>{
    const cos=custCourses(c.id); const co=cos[0];
    const debt=cos.reduce((a,b)=>a+Math.max(0,b.total-b.paid),0);
    return `<tr class="row-link" onclick="location.hash='#/customers/${c.id}'">
      <td class="t-code">${c.code}</td>
      <td><div class="t-name">${esc(c.name)}</div><div class="t-sub">${esc(c.concern)}</div></td>
      <td><span class="t-phone" onclick="event.stopPropagation();callModal('${c.id}')">${fmtPhone(c.phone)}</span></td>
      <td class="t-sub">${age(c.dob)} · ${c.gender==='M'?'Nam':'Nữ'}</td>
      <td><span class="badge ${srcColor(c.source)}">${srcName(c.source)}</span></td>
      <td><span class="badge ${c.lifecycle==='patient'?'b-teal':c.lifecycle==='customer'?'b-blue':'b-gray'} nodot">${lc[c.lifecycle]}</span></td>
      <td><span class="badge ${stColor(c.status)}">${stLabel(c.status)}</span></td>
      <td>${co?`<div style="font-size:12.5px">${co.done_sessions}/${co.total_sessions} buổi</div><div class="mini-bar"><i style="width:${co.done_sessions/co.total_sessions*100}%"></i></div>`:'<span class="t-sub">—</span>'}</td>
      <td class="t-right">${debt?`<span style="color:var(--danger);font-weight:650">${money(debt)}</span>`:'<span class="t-sub">—</span>'}</td>
      <td class="t-sub">${fmtD(c.created_at)}</td></tr>`}).join('')}</tbody></table></div></div>`;
}

/* ================= CUSTOMER 360 ================= */
function viewCustomer360(cid){
  const c=custById(cid); if(!c) return '<div class="empty">Không tìm thấy khách hàng</div>';
  const tab=S.filters.c360tab=S.filters.c360tab||'overview';
  const cos=custCourses(cid); const co=cos.find(x=>x.status==='active')||cos[0];
  const appts=DB.appointments.filter(a=>a.customer_id===cid).sort((a,b)=>b.at-a.at);
  const calls=DB.calls.filter(x=>x.customer_id===cid).sort((a,b)=>b.at-a.at);
  const encs=DB.encounters.filter(e=>e.customer_id===cid).sort((a,b)=>b.at-a.at);
  const pays=DB.payments.filter(p=>p.customer_id===cid);
  const files=DB.files.filter(f=>f.customer_id===cid);
  const TABS=[['overview','Tổng quan'],['contact','Lịch sử liên hệ',calls.length],['appt','Lịch hẹn',appts.length],['medical','Hồ sơ khám',encs.length],
    ['course','Liệu trình',cos.length],['progress','Tiến triển'],['pay','Thanh toán',pays.length],['files','Tệp đính kèm',files.length],['log','Nhật ký hệ thống']];

  let body='';
  if(tab==='overview'){
    body=`<div class="grid g-3-2">
      <div><div class="card"><div class="card-h"><h3>Thông tin cơ bản</h3><div class="r">${can('customers.edit_admin')||can('admin')?`<button class="btn sm" onclick="openCustomerForm('${cid}')">${ic('edit',16)} Sửa</button>`:''}</div></div>
        <div class="card-b"><div class="grid g2" style="gap:0 24px">
          <div class="kv">
            <div class="k">Mã khách hàng</div><div class="v mono">${c.code}</div>
            <div class="k">Họ tên</div><div class="v">${esc(c.name)}</div>
            <div class="k">Ngày sinh</div><div class="v">${fmtD(c.dob)} (${age(c.dob)} tuổi)</div>
            <div class="k">Giới tính</div><div class="v">${c.gender==='M'?'Nam':'Nữ'}</div>
            <div class="k">Điện thoại</div><div class="v mono">${fmtPhone(c.phone)}</div>
            <div class="k">Điện thoại phụ</div><div class="v mono">${c.phone2?fmtPhone(c.phone2):'—'}</div>
          </div>
          <div class="kv">
            <div class="k">Email</div><div class="v">${esc(c.email||'—')}</div>
            <div class="k">Địa chỉ</div><div class="v" style="font-weight:500">${esc(c.address)}</div>
            <div class="k">Nghề nghiệp</div><div class="v">${esc(c.job)}</div>
            <div class="k">Người liên hệ</div><div class="v">${esc(c.contact_person||'—')}</div>
            <div class="k">Nguồn khách</div><div class="v"><span class="badge ${srcColor(c.source)}">${srcName(c.source)}</span></div>
            <div class="k">Chiến dịch</div><div class="v" style="font-weight:500;font-size:12.5px">${esc((DB.campaigns.find(x=>x.id===c.campaign)||{name:'—'}).name)}</div>
          </div></div>
          <div class="divider"></div>
          <div class="grid g2"><div><div class="sec-t">Nhu cầu</div><div>${esc(c.need)}</div></div>
          <div><div class="sec-t">Bệnh lý quan tâm</div><div>${esc(c.concern)}</div></div></div>
        </div></div>
        <div class="card" style="margin-top:14px"><div class="card-h"><h3>Timeline khách hàng</h3><span class="sub">Toàn bộ hành trình – không thể sửa/xóa</span></div>
          <div class="card-b"><div class="tl">${custTimeline(cid).slice(0,14).map(t=>`<div class="tl-i ${t.cls}">
            <div class="dot">${ic(t.icon,14)}</div>
            <div class="tl-t">${fmtDT(t.at)}</div><div class="tl-b">${esc(t.title)}</div>
            ${t.desc?`<div class="tl-d">${esc(t.desc)}</div>`:''}${t.meta?`<div class="tl-m">${esc(t.meta)}</div>`:''}</div>`).join('')}</div>
            ${custTimeline(cid).length>14?`<button class="btn sm block" style="margin-top:8px" onclick="S.filters.c360tab='log';render()">Xem toàn bộ ${custTimeline(cid).length} sự kiện ${ic('arrowRight',15)}</button>`:''}</div></div>
      </div>
      <div>
        ${co?`<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>Liệu trình hiện tại</h3>
          ${cos.length>1?`<span class="badge b-purple nodot">+${cos.length-1} gói khác</span>`:''}
          <div class="r"><button class="btn sm" onclick="S.filters.c360tab='course';render()">Tất cả gói</button></div></div><div class="card-b">
          ${co.area?`<div class="chips" style="margin-bottom:8px"><span class="badge b-purple nodot">Vùng: ${esc(co.area)}</span></div>`:''}
          <div style="font-weight:700">${esc(pkgById(co.package_id).name)}</div>
          <div class="t-sub mono" style="margin-bottom:10px">${co.code} · ${esc(co.diagnosis)}</div>
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><b>${co.done_sessions}/${co.total_sessions} buổi</b><span>${Math.round(co.done_sessions/co.total_sessions*100)}%</span></div>
          <div class="progress thick"><i style="width:${co.done_sessions/co.total_sessions*100}%"></i></div>
          <div class="kv" style="margin-top:12px">
            <div class="k">Bác sĩ</div><div class="v">${userName(co.doctor_id)}</div>
            <div class="k">Bắt đầu</div><div class="v">${fmtD(co.start_date)}</div>
            <div class="k">Giá trị</div><div class="v">${money(co.total)}đ</div>
            <div class="k">Đã thanh toán</div><div class="v" style="color:var(--ok)">${money(co.paid)}đ</div>
            <div class="k">Còn lại</div><div class="v" style="color:${co.total-co.paid>0?'var(--danger)':'var(--muted)'}">${money(Math.max(0,co.total-co.paid))}đ</div>
          </div>
          <button class="btn primary block" style="margin-top:12px" onclick="location.hash='#/treatment/${co.id}'">Mở trang liệu trình ${ic('arrowRight',15)}</button>
        </div></div>`:''}
        <div class="card"><div class="card-h"><h3>Lịch hẹn sắp tới</h3></div><div class="card-b tight">
          ${appts.filter(a=>a.at>=d(0,0,0)&&['booked','confirmed'].includes(a.status)).slice(0,4).map(a=>`
            <div class="queue-item"><span class="q-time">${fmtT(a.at)}</span>
            <div style="flex:1"><div style="font-weight:650;font-size:13px">${fmtD(a.at)} · ${esc(a.type)}</div>
            <div class="t-sub">${userName(a.doctor)} · ${(DB.rooms.find(r=>r.id===a.room)||{name:''}).name}</div></div>
            <span class="badge ${apColor(a.status)}">${apLabel(a.status)}</span></div>`).join('')
            || '<div class="empty" style="padding:24px"><div class="t">Chưa có lịch hẹn sắp tới</div><button class="btn sm primary" style="margin-top:8px" onclick="openBooking(\''+cid+'\')">＋ Đặt lịch</button></div>'}
        </div></div>
      </div></div>`;
  }
  if(tab==='contact'){
    body=`<div class="card"><div class="card-h"><h3>Lịch sử liên hệ</h3><span class="sub">${calls.length} cuộc gọi</span>
      <div class="r"><button class="btn sm primary" onclick="callModal('${cid}')">${ic('phone',15)} Gọi ngay</button></div></div>
      <div class="tbl-wrap"><table><thead><tr><th>Thời gian</th><th>Người gọi</th><th>Kết quả</th><th>Thời lượng</th><th>Mức quan tâm</th><th>Ghi chú</th><th>Hẹn gọi lại</th></tr></thead>
      <tbody>${calls.map(h=>`<tr><td class="t-sub">${fmtDT(h.at)}</td><td>${esc(userName(h.user_id))}</td>
        <td><span class="badge ${crColor(h.result)}">${crLabel(h.result)}</span></td>
        <td class="mono">${Math.floor(h.duration/60)}p${String(h.duration%60).padStart(2,'0')}s</td>
        <td>${stars(h.interest||0)}</td>
        <td style="max-width:340px">${esc(h.note)}</td>
        <td class="t-sub">${h.next_call?fmtDT(h.next_call):'—'}</td></tr>`).join('')||'<tr><td colspan="7"><div class="empty"><div class="t">Chưa có cuộc gọi nào</div></div></td></tr>'}</tbody></table></div></div>`;
  }
  if(tab==='appt'){
    body=`<div class="card"><div class="card-h"><h3>Lịch hẹn</h3><div class="r"><button class="btn sm primary" onclick="openBooking('${cid}')">＋ Đặt lịch mới</button></div></div>
      <div class="tbl-wrap"><table><thead><tr><th>Thời gian</th><th>Loại</th><th>Bác sĩ</th><th>Phòng</th><th>Người đặt</th><th>Trạng thái</th><th>Check-in</th><th>Kết thúc</th></tr></thead>
      <tbody>${appts.map(a=>`<tr><td><b>${fmtDT(a.at)}</b></td><td>${esc(a.type)}</td><td>${esc(userName(a.doctor))}</td>
        <td>${(DB.rooms.find(r=>r.id===a.room)||{name:'—'}).name}</td><td class="t-sub">${esc(userName(a.booked_by))}</td>
        <td><span class="badge ${apColor(a.status)}">${apLabel(a.status)}</span></td>
        <td class="t-sub">${a.checkin_at?fmtT(a.checkin_at):'—'}</td><td class="t-sub">${a.exam_end?fmtT(a.exam_end):'—'}</td></tr>`).join('')||'<tr><td colspan="8"><div class="empty"><div class="t">Chưa có lịch hẹn</div></div></td></tr>'}</tbody></table></div></div>`;
  }
  if(tab==='medical'){
    if(!can('medical')&&!can('admin')) body=`<div class="card"><div class="empty"><div class="ic-box">${ic('lock',16)}</div><div class="t">Bạn không có quyền xem hồ sơ y khoa chi tiết</div><div>Vai trò <b>${S.user.roles.map(roleName).join(', ')}</b> chỉ được xem thông tin hành chính. Liên hệ Quản trị viên nếu cần cấp quyền.</div></div></div>`;
    else body=encs.length? encs.map(e=>`<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>Phiếu khám ${e.id}</h3>
      <span class="badge b-green">Đã chốt (v${e.version})</span><span class="sub">${fmtDT(e.at)} · ${esc(userName(e.doctor_id))}</span>
      <div class="r"><button class="btn sm" onclick="location.hash='#/doctor/encounter/${e.id}'">Mở chi tiết ${ic('arrowRight',15)}</button></div></div>
      <div class="card-b"><div class="grid g2" style="gap:14px 24px">
        <div><div class="sec-t">Lý do khám</div><div>${esc(e.reason)}</div>
        <div class="sec-t" style="margin-top:12px">Triệu chứng</div><div>${esc(e.symptoms)}</div>
        <div class="sec-t" style="margin-top:12px">Khám lâm sàng</div><div>${esc(e.clinical)}</div></div>
        <div><div class="sec-t">Chẩn đoán</div><div style="font-weight:700;color:var(--brand-700)">${esc(e.diagnosis)}</div>
        <div class="sec-t" style="margin-top:12px">Lượng giá</div><div>${esc(e.assessment_scale)}</div>
        <div class="sec-t" style="margin-top:12px">Hướng điều trị</div><div>${esc(e.plan)}</div></div>
      </div></div></div>`).join('') : `<div class="card"><div class="empty"><div class="ic-box">${ic('clipboard',16)}</div><div class="t">Chưa có hồ sơ khám</div><div>Hồ sơ sẽ được tạo khi bác sĩ bắt đầu khám bệnh nhân.</div></div></div>`;
  }
  if(tab==='course'){
    body=courseTabBlock(cid, cos);
  }
  if(tab==='progress'){
    body = co && co.status!=='pending' ? progressBlock(co) : `<div class="card"><div class="empty"><div class="ic-box">${ic('lineChart',16)}</div><div class="t">Chưa có dữ liệu tiến triển</div><div>Cần có liệu trình đang hoạt động và ít nhất 1 buổi điều trị đã nhập chỉ số lượng giá.</div></div></div>`;
  }
  if(tab==='pay'){
    const tot=cos.reduce((a,b)=>a+(b.status!=='pending'?b.total:0),0), paid=cos.reduce((a,b)=>a+b.paid,0);
    body=`<div class="grid g4" style="margin-bottom:14px">${stat('Tổng giá trị',money(tot)+'đ','','package')}${stat('Đã thanh toán',money(paid)+'đ','','check','up')}${stat('Còn lại',money(Math.max(0,tot-paid))+'đ','',(tot-paid)>0?ic('alert',16):ic('check',15),(tot-paid)>0?'dn':'up')}${stat('Số giao dịch',pays.length,'','clipboard')}</div>
    <div class="card"><div class="card-h"><h3>Giao dịch</h3>${can('payments')?`<div class="r"><button class="btn sm primary" onclick="openPayment('${co?co.id:''}')">＋ Thu tiền</button></div>`:''}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Ngày</th><th>Mã GD</th><th>Liệu trình</th><th class="t-right">Số tiền</th><th>Hình thức</th><th>Người thu</th><th>Ghi chú</th></tr></thead>
    <tbody>${pays.map(p=>`<tr><td>${fmtDT(p.at)}</td><td class="t-code">${p.ref}</td><td class="t-sub">${(courseById(p.course_id)||{code:'—'}).code}</td>
      <td class="t-right" style="font-weight:700;color:${p.amount<0?'var(--danger)':'var(--ok)'}">${p.amount<0?'':'+'}${money(p.amount)}đ</td>
      <td>${(PAY_METHODS.find(m=>m.code===p.method)||{label:''}).label}</td><td class="t-sub">${esc(userName(p.by))}</td>
      <td class="t-sub">${esc(p.note)}${p.type==='reversal'?' <span class="badge b-red nodot">Điều chỉnh</span>':''}</td></tr>`).join('')||'<tr><td colspan="7"><div class="empty"><div class="t">Chưa có giao dịch</div></div></td></tr>'}</tbody></table></div></div>`;
  }
  if(tab==='files'){
    body=`<div class="card"><div class="card-h"><h3>Tệp y khoa</h3><span class="sub">Lưu trữ riêng tư · truy cập qua signed URL có hạn 5 phút</span>
      <div class="r"><button class="btn sm primary" onclick="openFileUpload('${cid}')">${ic('upload',16)} Tải tệp lên</button></div></div>
      <div class="card-b">${files.length?`<div class="grid g4">${files.map(f=>`<div class="card" style="box-shadow:none">
        <div class="card-b" style="text-align:center">
          <div style="font-size:34px">${f.name.endsWith('.pdf')?ic('file',16):ic('image',16)}</div>
          <div style="font-weight:650;font-size:12.5px;margin-top:6px;word-break:break-all">${esc(f.name)}</div>
          <div class="t-sub">${f.size} · ${fmtD(f.at)}</div>
          <span class="badge b-teal nodot" style="margin-top:7px">${f.kind}</span>
          <button class="btn sm block" style="margin-top:9px" onclick="openFileView('${f.id}')">Xem tệp</button>
        </div></div>`).join('')}</div>`:'<div class="empty"><div class="ic-box">'+ic('paperclip',16)+'</div><div class="t">Chưa có tệp đính kèm</div><div>Hỗ trợ PDF, JPG, PNG. Loại tệp: '+FILE_KINDS.join(', ')+'.</div></div>'}</div></div>`;
  }
  if(tab==='log'){
    body=`<div class="card"><div class="card-h"><h3>Nhật ký &amp; timeline đầy đủ</h3><span class="sub">${custTimeline(cid).length} sự kiện · chỉ đọc</span></div>
      <div class="card-b"><div class="tl">${custTimeline(cid).map(t=>`<div class="tl-i ${t.cls}">
        <div class="dot">${ic(t.icon,14)}</div>
            <div class="tl-t">${fmtDT(t.at)}</div><div class="tl-b">${esc(t.title)}</div>
        ${t.desc?`<div class="tl-d">${esc(t.desc)}</div>`:''}${t.meta?`<div class="tl-m">${esc(t.meta)}</div>`:''}</div>`).join('')}</div></div></div>`;
  }

  return `<div class="card" style="margin-bottom:14px;overflow:hidden">
    <div class="c360-head">
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
        <div class="avatar" style="width:54px;height:54px;font-size:19px;background:rgba(255,255,255,.2);color:#fff">${initials(c.name)}</div>
        <div style="flex:1;min-width:240px">
          <h2>${esc(c.name)}</h2>
          <div class="meta"><span class="mono">${c.code}</span><span>${ic('phone',15)} ${fmtPhone(c.phone)}</span><span>${c.gender==='M'?'Nam':'Nữ'} · ${age(c.dob)} tuổi</span><span>${srcName(c.source)}</span></div>
          <div class="acts">
            <button class="btn w" onclick="callModal('${cid}')">${ic('phone',15)} GỌI</button>
            <button class="btn" onclick="openBooking('${cid}')">${ic('calendar',16)} ĐẶT LỊCH</button>
            <button class="btn" onclick="openNote('${cid}')">${ic('edit',16)} TẠO GHI CHÚ</button>
            ${co&&co.status!=='pending'?`<button class="btn" onclick="location.hash='#/treatment/${co.id}'">${ic('pill',16)} LIỆU TRÌNH</button>`:''}
            ${can('treatment.purchase')?`<button class="btn" onclick="openAddPackage('${cid}')">${ic('package',16)} MUA THÊM GÓI</button>`:''}
          </div>
        </div>
        <div class="kpi">
          <div><div class="k">Trạng thái</div><div class="v">${stLabel(c.status).toUpperCase()}</div></div>
          ${co&&co.status!=='pending'?`<div><div class="k">Liệu trình</div>
            <div class="v">${co.done_sessions} / ${co.total_sessions} buổi</div>
            <div style="width:150px;margin-top:6px" class="progress"><i style="width:${co.done_sessions/co.total_sessions*100}%"></i></div></div>`:''}
        </div>
      </div>
    </div>
    <div class="tabs">${TABS.map(([k,lb,n])=>`<div class="tab ${tab===k?'on':''}" onclick="S.filters.c360tab='${k}';render()">${lb}${n!==undefined?`<span class="cnt">${n}</span>`:''}</div>`).join('')}</div>
  </div>${body}`;
}
function courseCard(co){
  const pkg=pkgById(co.package_id); const pct=Math.round(co.done_sessions/co.total_sessions*100);
  return `<div class="card"><div class="card-h"><h3>${esc(pkg.name)}</h3><span class="badge ${courseStatusColor(co.status)}">${courseStatusLb(co.status)}</span></div>
  <div class="card-b"><div class="t-code" style="margin-bottom:8px">${co.code} · ${esc(co.diagnosis)}</div>
  ${co.area?`<div class="chips" style="margin-bottom:8px"><span class="badge b-purple nodot">${ic('target',13)} Vùng: ${esc(co.area)}</span></div>`:''}
  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><b>${co.done_sessions}/${co.total_sessions} buổi</b><span>${pct}%</span></div>
  <div class="progress"><i style="width:${pct}%"></i></div>
  <div class="kv" style="margin-top:12px"><div class="k">Bác sĩ</div><div class="v">${co.doctor_id?esc(userName(co.doctor_id)):'—'}</div>
  <div class="k">Thời gian</div><div class="v">${co.start_date?fmtD(co.start_date)+' '+ic('arrowRight',15)+' '+fmtD(co.end_date_est):'Chưa bắt đầu'}</div>
  <div class="k">Đã dùng / còn lại</div><div class="v">${co.done_sessions} buổi · <b>còn ${courseRemaining(co)} buổi</b></div>
  <div class="k">Giá trị</div><div class="v">${money(co.total)}đ${co.discount?` <span class="t-sub">(giảm ${money(co.discount)})</span>`:''}</div>
  <div class="k">Công nợ</div><div class="v" style="color:${co.total-co.paid>0?'var(--danger)':'var(--ok)'}">${co.total-co.paid>0?money(co.total-co.paid)+'đ':'Đã thanh toán đủ'}</div></div>
  <button class="btn block" style="margin-top:11px" onclick="location.hash='#/treatment/${co.id}'">Xem chi tiết ${ic('arrowRight',15)}</button></div></div>`;
}
/* Tab "Liệu trình" của hồ sơ 360: chuyển qua lại giữa các gói + mua thêm gói.
   Mọi gói của khách đều hiển thị, gói cũ không bị thay thế. */
function courseTabBlock(cid, cos){
  const buyBtn = can('treatment.purchase')
    ? `<button class="btn sm primary" onclick="openAddPackage('${cid}')">${ic('package',16)} ＋ Mua thêm gói</button>` : '';
  if(!cos.length) return `<div class="card"><div class="card-h"><h3>Liệu trình</h3><div class="r">${buyBtn}</div></div>
    <div class="empty"><div class="ic-box">${ic('pill',16)}</div><div class="t">Chưa có liệu trình</div>
    <div>Liệu trình được tạo khi bác sĩ đề xuất hoặc khi khách mua gói tại quầy.</div></div></div>`;
  const sel = cos.find(x=>x.id===S.filters.coSel) || cos.find(x=>x.status==='active') || cos[0];
  S.filters.coSel = sel.id;
  const ss=courseSessions(sel.id);
  return `<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>Các gói trị liệu</h3>
      <span class="badge b-gray nodot">${cos.length} gói</span>
      <span class="sub">${cos.filter(x=>x.status==='active').length} đang điều trị · ${cos.filter(x=>x.status==='pending').length} chờ kích hoạt</span>
      <div class="r">${buyBtn}</div></div>
    <div class="card-b">
      <div class="chips" role="tablist" aria-label="Chọn gói trị liệu">
        ${cos.map(x=>`<div class="chip ${x.id===sel.id?'on':''}" role="tab" tabindex="0" aria-selected="${x.id===sel.id}"
          onclick="S.filters.coSel='${x.id}';render()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();S.filters.coSel='${x.id}';render()}">
          ${esc(pkgById(x.package_id).name.split(' - ')[0])}${x.area?' · '+esc(x.area):''}
          <span class="cnt">${x.done_sessions}/${x.total_sessions}</span></div>`).join('')}
      </div>
    </div></div>
    <div class="grid g-2-1">
      <div class="card"><div class="card-h"><h3>Lịch sử sử dụng từng buổi</h3>
        <span class="badge ${courseStatusColor(sel.status)}">${courseStatusLb(sel.status)}</span>
        <span class="sub">${sel.code}${sel.area?' · '+esc(sel.area):''}</span>
        <div class="r"><button class="btn sm" onclick="location.hash='#/treatment/${sel.id}'">Mở trang liệu trình ${ic('arrowRight',15)}</button></div></div>
        <div class="card-b">${ss.length?ss.map(x=>{const st=SESS_ST[x.status];
          return `<div class="sess ${x.status==='done'?'done':x.status==='booked'?'booked':''}" onclick="sessionDetail('${x.id}')">
            <div class="n">${x.status==='done'?ic('check',15):x.no}</div>
            <div style="flex:1;min-width:0"><div style="font-weight:650">Buổi ${x.no}${x.at?' — '+fmtD(x.at)+' '+fmtT(x.at):''}</div>
              <div class="t-sub">${esc(x.status==='done'?(x.intervention||x.services.join(', ')):x.services.join(', '))}${x.tech_id?' · KTV '+esc(userName(x.tech_id).replace('KTV. ','')):''}</div></div>
            <span class="badge ${st.color}">${st.label}</span></div>`}).join('')
          :'<div class="empty" style="padding:22px"><div class="t">Chưa sinh buổi điều trị</div></div>'}</div></div>
      <div>${courseCard(sel)}</div>
    </div>`;
}

/* ================= CALENDAR ================= */
function viewCalendar(){
  const f=S.filters.cal=S.filters.cal||{view:'day',off:0,doctor:'',room:'',status:'',src:''};
  if(isMobile()&&f.view==='week') f.view='list';
  let list=DB.appointments.slice();
  if(f.doctor) list=list.filter(a=>a.doctor===f.doctor);
  if(f.room) list=list.filter(a=>a.room===f.room);
  if(f.status) list=list.filter(a=>a.status===f.status);
  if(f.src) list=list.filter(a=>custById(a.customer_id).source===f.src);

  const base=d(f.off,0,0);
  let days=[];
  if(f.view==='day') days=[base];
  else if(f.view==='week'){ const st=new Date(base); st.setDate(st.getDate()-((st.getDay()+6)%7)); for(let i=0;i<7;i++){const x=new Date(st);x.setDate(st.getDate()+i);days.push(x);} }
  const DOW=['CN','T2','T3','T4','T5','T6','T7'];
  let grid='';
  if(f.view!=='list'){
    grid=`<div class="cal-grid" style="--cols:${days.length}"><div class="cal-hd"></div>
      ${days.map(x=>`<div class="cal-hd ${sameDay(x,TODAY)?'today':''}">${DOW[x.getDay()]}<div class="d">${fmtD(x)}</div>
        <div class="d">${list.filter(a=>sameDay(a.at,x)).length} lịch</div></div>`).join('')}`;
    for(let h=7;h<=19;h++){
      grid+=`<div class="cal-time">${String(h).padStart(2,'0')}:00</div>`;
      days.forEach(x=>{
        const items=list.filter(a=>sameDay(a.at,x)&&a.at.getHours()===h);
        grid+=`<div class="cal-cell" onclick="openBooking()">${items.map(a=>{const c=custById(a.customer_id);
          return `<div class="appt ${apCls(a.status)}" onclick="event.stopPropagation();apptDetail('${a.id}')">
            <div class="nm">${fmtT(a.at)} ${esc(c.name.split(' ').slice(-2).join(' '))}</div>
            <div class="mt">${(DB.rooms.find(r=>r.id===a.room)||{name:''}).name} · ${esc(userName(a.doctor).replace('BS. ',''))}</div></div>`}).join('')}</div>`;
      });
    }
    grid+='</div>';
  } else {
    const l=list.filter(a=>a.at>=d(f.off,0,0)&&a.at<d(f.off+7,0,0)).sort((a,b)=>a.at-b.at);
    grid=`<div class="tbl-wrap"><table><thead><tr><th>Giờ</th><th>Khách hàng</th><th>Điện thoại</th><th>Loại</th><th>Bác sĩ</th><th>Phòng</th><th>Nguồn</th><th>Người đặt</th><th>Trạng thái</th></tr></thead>
      <tbody>${l.map(a=>{const c=custById(a.customer_id);return `<tr class="row-link" onclick="apptDetail('${a.id}')">
        <td><b>${fmtDS(a.at)} ${fmtT(a.at)}</b></td><td class="t-name">${esc(c.name)}</td>
        <td><span class="t-phone" onclick="event.stopPropagation();callModal('${c.id}')">${fmtPhone(c.phone)}</span></td>
        <td>${esc(a.type)}</td><td>${esc(userName(a.doctor))}</td><td>${(DB.rooms.find(r=>r.id===a.room)||{name:''}).name}</td>
        <td><span class="badge ${srcColor(c.source)}">${srcName(c.source)}</span></td><td class="t-sub">${esc(userName(a.booked_by))}</td>
        <td><span class="badge ${apColor(a.status)}">${apLabel(a.status)}</span></td></tr>`}).join('')}</tbody></table></div>`;
  }
  return head('Lịch phòng khám', f.view==='day'?fmtD(base):(f.view==='week'?'Tuần '+fmtD(days[0])+' – '+fmtD(days[6]):'7 ngày từ '+fmtD(base)),
    `<button class="btn primary" onclick="openBooking()">＋ Đặt lịch</button>`)
  + `<div class="card"><div class="toolbar">
      <div class="chips">${[['day','Ngày'],['week','Tuần'],['list','Danh sách']].map(([k,l])=>`<div class="chip ${f.view===k?'on':''}" onclick="S.filters.cal.view='${k}';render()">${l}</div>`).join('')}</div>
      <div style="display:flex;gap:4px;margin-left:6px">
        <button class="btn sm" onclick="S.filters.cal.off--;render()">‹</button>
        <button class="btn sm" onclick="S.filters.cal.off=0;render()">Hôm nay</button>
        <button class="btn sm" onclick="S.filters.cal.off++;render()">›</button></div>
      <select class="inp sm" onchange="S.filters.cal.doctor=this.value;render()"><option value="">Tất cả bác sĩ</option>${DOCTORS.map(u=>`<option value="${u.id}" ${f.doctor===u.id?'selected':''}>${u.name}</option>`).join('')}</select>
      <select class="inp sm" onchange="S.filters.cal.room=this.value;render()"><option value="">Tất cả phòng</option>${DB.rooms.map(r=>`<option value="${r.id}" ${f.room===r.id?'selected':''}>${r.name}</option>`).join('')}</select>
      <select class="inp sm" onchange="S.filters.cal.status=this.value;render()"><option value="">Mọi trạng thái</option>${Object.entries(APPT_ST).map(([k,v])=>`<option value="${k}" ${f.status===k?'selected':''}>${v.label}</option>`).join('')}</select>
      <select class="inp sm" onchange="S.filters.cal.src=this.value;render()"><option value="">Mọi nguồn</option>${SOURCES.map(s=>`<option value="${s.code}" ${f.src===s.code?'selected':''}>${s.name}</option>`).join('')}</select>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">${Object.entries(APPT_ST).map(([k,v])=>`<span style="display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--muted)"><span style="width:9px;height:9px;border-radius:3px;display:inline-block" class="${v.cls}"></span>${v.label}</span>`).join('')}</div>
    </div><div style="overflow:auto;max-height:calc(100vh - 250px)">${grid}</div></div>`;
}
function apptDetail(id){
  const a=DB.appointments.find(x=>x.id===id), c=custById(a.customer_id);
  modal(`<div class="modal"><div class="modal-h"><h3>Chi tiết lịch hẹn</h3><span class="badge ${apColor(a.status)}">${apLabel(a.status)}</span><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="kv">
      <div class="k">Khách hàng</div><div class="v"><a style="color:var(--brand-700);cursor:pointer" onclick="closeModal();location.hash='#/customers/${c.id}'">${esc(c.name)} (${c.code})</a></div>
      <div class="k">Điện thoại</div><div class="v mono">${fmtPhone(c.phone)}</div>
      <div class="k">Thời gian</div><div class="v">${fmtDT(a.at)}</div>
      <div class="k">Loại lịch</div><div class="v">${esc(a.type)}</div>
      <div class="k">Bác sĩ</div><div class="v">${a.doctor?esc(userName(a.doctor)):'— chưa chỉ định —'}</div>
      <div class="k">Kỹ thuật viên</div><div class="v">${a.technician_id?esc(userName(a.technician_id)):'— chưa chỉ định —'}</div>
      <div class="k">Tư vấn viên</div><div class="v">${a.consultant_id?esc(userName(a.consultant_id)):'— chưa chỉ định —'}</div>
      <div class="k">Phòng</div><div class="v">${(DB.rooms.find(r=>r.id===a.room)||{name:''}).name}</div>
      ${a.flow?`<div class="k">Luồng tiếp đón</div><div class="v">${VISIT_FLOW[visitFlow(a)].label}</div>`:''}
      ${a.reason?`<div class="k">Lý do đến khám</div><div class="v" style="font-weight:500">${esc(a.reason)}</div>`:''}
      <div class="k">Nguồn khách</div><div class="v">${srcName(c.source)}</div>
      <div class="k">Người đặt</div><div class="v">${esc(userName(a.booked_by))}</div>
      ${a.checkin_at?`<div class="k">Giờ check-in</div><div class="v">${fmtT(a.checkin_at)}</div>`:''}
      ${a.exam_start?`<div class="k">Bắt đầu khám</div><div class="v">${fmtT(a.exam_start)}</div>`:''}
      ${a.exam_end?`<div class="k">Kết thúc khám</div><div class="v">${fmtT(a.exam_end)}</div>`:''}
      ${a.checkout_at?`<div class="k">Giờ check-out</div><div class="v">${fmtT(a.checkout_at)}</div>`:''}
    </div>
    <div class="divider"></div>
    <div class="sec-t">Chuyển trạng thái hợp lệ</div>
    <div class="chips">${['confirmed','arrived','no_show','cancelled'].filter(s=>s!==a.status).map(s=>`<div class="chip" onclick="setApptStatus('${id}','${s}')">${apLabel(s)}</div>`).join('')}</div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Đóng</button>
    <button class="btn" onclick="closeModal();callModal('${c.id}')">${ic('phone',15)} Gọi khách</button>
    ${['booked','confirmed','no_show'].includes(a.status)?`<button class="btn" onclick="openReschedule('${id}')">${ic('repeat',15)} Đổi lịch</button>
      <button class="btn danger" onclick="openCancelAppt('${id}')">${ic('ban',15)} Hủy lịch</button>`:''}
    ${isPresent(a)?`<button class="btn" onclick="closeModal();openVisitStaff('${id}')">${ic('users',16)} Đổi KTV / TVV</button>`:''}
    ${isPresent(a)&&a.status!=='in_treatment'?`<button class="btn" onclick="closeModal();startTreatment('${id}')">${ic('activity',16)} Chuyển trị liệu</button>`:''}
    ${isPresent(a)&&can('reception')?`<button class="btn primary" onclick="closeModal();checkOut('${id}')">${ic('checkCircle',16)} Check-out</button>`:''}
    ${['booked','confirmed','arrived'].includes(a.status)&&can('reception')?`<button class="btn primary" onclick="checkIn('${id}')">${ic('checkCircle',16)} Check-in</button>`:''}</div></div>`);
}
function setApptStatus(id,st){ const a=DB.appointments.find(x=>x.id===id); a.status=st; closeModal(); toast('Đã cập nhật trạng thái lịch hẹn: '+apLabel(st),'ok'); buildNav(); render(); }

/* ================= RECEPTION ================= */
/* Luồng tiếp đón hỗ trợ 2 kịch bản trên CÙNG MỘT bản ghi visit:
     A. Check-in -> Bác sĩ khám -> Điều trị -> Check-out
     B. Check-in -> Điều trị trực tiếp -> Check-out
   Sau check-in, visit ở trạng thái 'waiting' nên đồng thời xuất hiện ở
   hàng chờ bác sĩ VÀ danh sách chờ check-out. Không nhân bản record. */
const PRESENT_ST=['waiting','in_exam','in_treatment'];   // khách đang có mặt tại phòng khám
const VISIT_FLOW={
  doctor:{label:'Khám bác sĩ',color:'b-teal',icon:'stethoscope'},
  treatment:{label:'Trị liệu trực tiếp',color:'b-pink',icon:'activity'},
};
function visitFlow(a){ return VISIT_FLOW[a.flow] ? a.flow : 'doctor'; }
function flowBadge(a){ const f=VISIT_FLOW[visitFlow(a)];
  return `<span class="badge ${f.color} nodot">${ic(f.icon,13)} ${f.label}</span>`; }
function isPresent(a){ return PRESENT_ST.includes(a.status); }
function visitStaffLine(a){
  const bits=[];
  if(a.doctor) bits.push('BS ' + userName(a.doctor));
  if(a.technician_id) bits.push('KTV ' + userName(a.technician_id).replace('KTV. ',''));
  if(a.consultant_id) bits.push('TVV ' + userName(a.consultant_id));
  return bits.join(' · ');
}
function viewReception(){
  const t=todayAppts();
  const groups={upcoming:t.filter(a=>['booked','confirmed'].includes(a.status)), arrived:t.filter(a=>a.status==='arrived'),
    waiting:t.filter(a=>a.status==='waiting'), exam:t.filter(a=>a.status==='in_exam'),
    treat:t.filter(a=>a.status==='in_treatment'),
    present:t.filter(isPresent), done:t.filter(a=>a.status==='done'), noshow:t.filter(a=>a.status==='no_show')};
  const now=d(0,10,42);
  const card=(title,items,color,extra,sub)=>`<div class="card"><div class="card-h"><h3>${title}</h3><span class="badge ${color} nodot">${items.length}</span>${sub?`<span class="sub">${sub}</span>`:''}</div>
    <div class="card-b tight" style="max-height:400px;overflow-y:auto">${items.length?items.map(a=>{const c=custById(a.customer_id);
      const wait=a.checkin_at?Math.round((now-a.checkin_at)/60000):0;
      const staff=visitStaffLine(a);
      return `<div class="queue-item"><span class="q-time">${fmtT(a.at)}</span>
        <div style="flex:1;min-width:0;cursor:pointer" onclick="location.hash='#/customers/${c.id}'">
          <div style="font-weight:650">${esc(c.name)}</div>
          <div class="t-sub">${fmtPhone(c.phone)} · ${esc(a.type)}</div>
          ${staff?`<div class="t-sub">${esc(staff)}</div>`:''}
          ${extra==='present'?`<div style="margin-top:4px">${flowBadge(a)} <span class="badge ${apColor(a.status)}">${apLabel(a.status)}</span></div>`:''}</div>
        ${extra==='wait'&&wait?`<span class="wait-pill ${wait>15?'long':''}">chờ ${wait} phút</span>`:''}
        <div class="q-acts">
        ${extra==='checkin'?`<button class="btn sm primary" onclick="event.stopPropagation();checkIn('${a.id}')">CHECK-IN</button>`:''}
        ${extra==='wait'?`<button class="btn sm" onclick="event.stopPropagation();startTreatment('${a.id}')">${ic('activity',15)} Trị liệu</button>`:''}
        ${extra==='present'?`<button class="btn sm" onclick="event.stopPropagation();openVisitStaff('${a.id}')">${ic('users',15)} Nhân sự</button>
          <button class="btn sm primary" onclick="event.stopPropagation();checkOut('${a.id}')">CHECK-OUT</button>`:''}
        ${extra==='checkout'?`<button class="btn sm primary" onclick="event.stopPropagation();checkOut('${a.id}')">CHECK-OUT</button>`:''}
        </div>
      </div>`}).join(''):`<div class="empty" style="padding:26px"><div class="t">Không có khách</div></div>`}</div></div>`;
  return head('Tiếp đón — Hôm nay '+fmtD(TODAY),'Một lần khách đến = một bản ghi visit duy nhất · dùng chung cho bác sĩ, KTV và quầy check-out',
    `<button class="btn" onclick="location.hash='#/calendar'">${ic('calendar',16)} Xem lịch</button>
     <button class="btn primary" onclick="openWalkIn()">${ic('userPlus',16)} Khách vãng lai (walk-in)</button>`)
  + `<div class="grid g6" style="margin-bottom:14px">
      ${stat('Tổng lịch hôm nay',t.length,'','calendar')}
      ${stat('Sắp đến',groups.upcoming.length,'','clock')}
      ${stat('Đang có mặt',groups.present.length,'Chờ check-out','userCheck',groups.present.length?'dn':'up')}
      ${stat('Đang chờ BS',groups.waiting.length,groups.waiting.length?'Cần ưu tiên':'','clock',groups.waiting.length?'dn':'up')}
      ${stat('Đang trị liệu',groups.treat.length,'','activity')}
      ${stat('Hoàn thành',groups.done.length,'','checkCircle','up')}
    </div>
    <div class="alert al-info">${ic('info',16)} <div>Khách <b>đã check-in</b> hiển thị đồng thời ở <b>hàng chờ bác sĩ</b> và <b>danh sách chờ check-out</b>.
      Khách không cần khám có thể chuyển thẳng sang <b>Trị liệu</b> rồi check-out.</div></div>
    <div class="grid g3" style="margin-bottom:14px">
      ${card('Sắp đến',groups.upcoming,'b-blue','checkin')}
      ${card('Đang chờ bác sĩ',groups.waiting,'b-amber','wait')}
      ${card('Đang khám',groups.exam,'b-teal','checkout')}
    </div>
    <div class="grid g3" style="margin-bottom:14px">
      ${card('Đang trị liệu',groups.treat,'b-pink','checkout')}
      ${card('Chờ check-out',groups.present,'b-purple','present','tất cả khách đang có mặt')}
      ${card('Không đến / cần xử lý',groups.noshow,'b-red','')}
    </div>
    <div class="grid g2">
      ${card('Đã hoàn thành hôm nay',groups.done,'b-green','')}
      ${card('Đã đến, chưa check-in',groups.arrived,'b-gray','checkin')}
    </div>`;
}
/* ---- Form check-in: có thêm Kỹ thuật viên + Tư vấn viên, lưu vào visit ---- */
function checkIn(apid){
  const a=DB.appointments.find(x=>x.id===apid), c=custById(a.customer_id);
  const seePhone=can('customer.view_phone');
  const defFlow = a.flow || (/điều trị|trị liệu/i.test(a.type||'') ? 'treatment' : 'doctor');
  closeModal();
  modal(`<div class="modal wide"><div class="modal-h"><h3>Check-in khách hàng</h3><button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="alert al-ok">${ic('check',15)} <div>Đã tìm thấy hồ sơ sẵn có <b>${c.code}</b> — hệ thống <b>không tạo bệnh nhân mới</b>, chỉ cập nhật thông tin còn thiếu.</div></div>
    <div class="grid g2">
      <label class="fld" for="ci-name"><span class="lb">Họ tên <span class="req">*</span></span><input class="inp" id="ci-name" value="${esc(c.name)}"></label>
      <label class="fld" for="ci-dob"><span class="lb">Ngày sinh <span class="req">*</span></span><input class="inp" id="ci-dob" type="date" value="${new Date(new Date(c.dob).getTime()-new Date(c.dob).getTimezoneOffset()*60000).toISOString().slice(0,10)}"></label>
      <label class="fld" for="ci-gender"><span class="lb">Giới tính</span><select class="inp" id="ci-gender">
        <option value="M" ${c.gender==='M'?'selected':''}>Nam</option><option value="F" ${c.gender==='F'?'selected':''}>Nữ</option></select></label>
      <label class="fld" for="ci-phone"><span class="lb">Điện thoại <span class="req">*</span></span>
        <input class="inp mono" id="ci-phone" value="${fmtPhone(c.phone)}" ${seePhone?'':'readonly aria-readonly="true" title="Bạn không có quyền xem đầy đủ số điện thoại"'}></label>
    </div>
    <label class="fld" for="ci-addr"><span class="lb">Địa chỉ</span><input class="inp" id="ci-addr" value="${esc(c.address)}"></label>
    <div class="grid g2">
      <label class="fld" for="ci-job"><span class="lb">Nghề nghiệp</span><input class="inp" id="ci-job" value="${esc(c.job)}"></label>
      <label class="fld" for="ci-contact"><span class="lb">Người liên hệ khi cần</span><input class="inp" id="ci-contact" value="${esc(c.contact_person)}" placeholder="Họ tên – quan hệ – SĐT"></label>
    </div>
    <div class="divider"></div>
    <div class="sec-t">Phân công tiếp nhận</div>
    <div class="grid g2">
      <label class="fld" for="ci-doc"><span class="lb">Bác sĩ khám</span><select class="inp" id="ci-doc">
        <option value="">— Chưa chỉ định —</option>
        ${doctorList().map(u=>`<option value="${u.id}" ${u.id===a.doctor?'selected':''}>${esc(u.name)}${u.spec?' · '+esc(u.spec):''}</option>`).join('')}</select></label>
      <label class="fld" for="ci-room"><span class="lb">Phòng</span><select class="inp" id="ci-room">
        ${DB.rooms.map(r=>`<option value="${r.id}" ${r.id===a.room?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label>
      <label class="fld" for="ci-tech"><span class="lb">Kỹ thuật viên</span><select class="inp" id="ci-tech">
        <option value="">— Chưa chỉ định —</option>
        ${techList().map(u=>`<option value="${u.id}" ${u.id===a.technician_id?'selected':''}>${esc(u.name)}</option>`).join('')}</select>
        <div class="hint">Lấy từ danh sách nhân sự có vai trò Kỹ thuật viên.</div></label>
      <label class="fld" for="ci-consultant"><span class="lb">Tư vấn viên</span><select class="inp" id="ci-consultant">
        <option value="">— Chưa chỉ định —</option>
        ${consultantList().map(u=>`<option value="${u.id}" ${u.id===(a.consultant_id||c.assigned_to)?'selected':''}>${esc(u.name)} · ${esc(u.roles.map(roleName).join(', '))}</option>`).join('')}</select>
        <div class="hint">Nhân sự Telesales / CSKH. Có thể để trống và bổ sung sau.</div></label>
    </div>
    <div class="fld"><span class="lb">Khách đi theo luồng nào?</span>
      <div class="chips" id="ci-flow" role="radiogroup" aria-label="Luồng tiếp đón">
        ${Object.entries(VISIT_FLOW).map(([k,v])=>`<div class="chip ${defFlow===k?'on':''}" role="radio" tabindex="0" aria-checked="${defFlow===k}" data-flow="${k}"
          onclick="[...this.parentNode.children].forEach(x=>{x.classList.remove('on');x.setAttribute('aria-checked','false')});this.classList.add('on');this.setAttribute('aria-checked','true')">${ic(v.icon,14)} ${v.label}</div>`).join('')}
      </div>
      <div class="hint">Dù chọn luồng nào, khách vẫn hiển thị ở hàng chờ bác sĩ và danh sách chờ check-out.</div></div>
    <label class="fld" for="ci-reason"><span class="lb">Lý do đến khám hôm nay</span><textarea class="inp" id="ci-reason" rows="2">${esc(a.reason||c.concern)}</textarea></label>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="doCheckIn('${apid}')">${ic('checkCircle',16)} Xác nhận check-in</button></div></div>`);
}
/* Lõi nghiệp vụ check-in — tách khỏi DOM để kiểm thử được.
   Trả về bản ghi visit đã cập nhật, hoặc null nếu bị từ chối. */
function checkInVisit(apid, v){
  if(!guard('reception','Chỉ Lễ tân / Quản trị được check-in khách')) return null;
  const a=DB.appointments.find(x=>x.id===apid); if(!a) return null;
  const c=custById(a.customer_id); if(!c) return null;
  v=v||{};
  const name=(v.name!==undefined?String(v.name).trim():c.name);
  if(!name){ toast('Vui lòng nhập họ tên khách hàng','err'); return null; }
  /* Người không có quyền xem SĐT thấy bản che -> giữ nguyên số gốc, không ghi đè bằng dấu * */
  const rawPhone = v.phone!==undefined ? String(v.phone) : '';
  const phone = (!rawPhone || rawPhone.includes('*')) ? c.phone : (normPhone(rawPhone)||c.phone);
  const dup=DB.customers.find(x=>x.id!==c.id&&normPhone(x.phone)===phone);
  if(dup){ toast('Số điện thoại đã thuộc hồ sơ '+dup.name+' — không tạo hồ sơ trùng','err'); return null; }
  const flow=VISIT_FLOW[v.flow]?v.flow:'doctor';
  const before={doctor:a.doctor, tech:a.technician_id, consultant:a.consultant_id, status:a.status};

  /* 1. cập nhật thông tin hành chính lên ĐÚNG hồ sơ sẵn có (không tạo bệnh nhân mới) */
  c.name=name; c.phone=phone;
  if(v.dob) c.dob=new Date(v.dob+'T00:00:00');
  if(v.gender) c.gender=v.gender;
  if(v.address!==undefined) c.address=v.address;
  if(v.job!==undefined) c.job=v.job;
  if(v.contact_person!==undefined) c.contact_person=v.contact_person;

  /* 2. ghi vào bản ghi visit — dùng lại chính lịch hẹn này, không nhân bản */
  a.status='waiting'; a.checkin_at=new Date(); a.checkin_by=S.user.id;
  a.doctor=v.doctor||a.doctor; a.room=v.room||a.room;
  a.technician_id=v.technician_id||null; a.consultant_id=v.consultant_id||null;
  a.reason=v.reason!==undefined?v.reason:(a.reason||c.concern); a.flow=flow;

  /* 3. trạng thái khách đủ linh hoạt cho cả hai luồng */
  c.lifecycle='patient';
  if(flow==='doctor') c.status='WAITING_DOCTOR';
  else if(!['IN_TREATMENT','PACKAGE_ACTIVE','TREATMENT_COMPLETED'].includes(c.status)) c.status='CHECKED_IN';

  const staff=visitStaffLine(a);
  tl(c.id,a.checkin_at,'checkCircle','green','Lễ tân check-in ('+VISIT_FLOW[flow].label+')',
     (DB.rooms.find(r=>r.id===a.room)||{name:''}).name+(staff?' · '+staff:''),'Bởi '+S.user.name);
  DB.timeline.sort((x,y)=>y.at-x.at);
  au(new Date(),S.user.id,'checkin','appointments',a.id, JSON.stringify(before),
     JSON.stringify({status:a.status, flow:a.flow, doctor:a.doctor, technician_id:a.technician_id, consultant_id:a.consultant_id}));
  DB.audit.sort((x,y)=>y.at-x.at);
  return a;
}
function doCheckIn(apid){
  const g=id=>{ const n=$('#'+id); return n?n.value.trim():''; };
  const flowEl=document.querySelector('#ci-flow .chip.on');
  const a=checkInVisit(apid,{
    name:g('ci-name'), dob:g('ci-dob'), gender:g('ci-gender'), phone:g('ci-phone'),
    address:g('ci-addr'), job:g('ci-job'), contact_person:g('ci-contact'),
    doctor:g('ci-doc'), room:g('ci-room'),
    technician_id:g('ci-tech'), consultant_id:g('ci-consultant'),
    reason:g('ci-reason'), flow:flowEl?flowEl.dataset.flow:'doctor',
  });
  if(!a) return;
  closeModal();
  toast(custById(a.customer_id).name+' đã check-in — có mặt trong hàng chờ bác sĩ và danh sách chờ check-out','ok');
  buildNav(); render();
}
/* Chuyển khách sang trị liệu (dùng cho cả khách không qua bác sĩ) */
function startTreatment(apid){
  if(!can('reception')&&!can('treatment.sessions')&&!can('admin'))
    return guard('treatment.sessions','Bạn không có quyền chuyển khách sang trị liệu');
  const a=DB.appointments.find(x=>x.id===apid), c=custById(a.customer_id);
  if(!a||!isPresent(a)) return toast('Khách chưa check-in','warn');
  const before=a.status;
  a.status='in_treatment'; a.treat_start=new Date();
  if(!['IN_TREATMENT','TREATMENT_COMPLETED'].includes(c.status)) c.status='IN_TREATMENT';
  tl(c.id,new Date(),'activity','teal','Bắt đầu trị liệu',
     (DB.rooms.find(r=>r.id===a.room)||{name:''}).name+(a.technician_id?' · KTV '+userName(a.technician_id):''),S.user.name);
  DB.timeline.sort((x,y)=>y.at-x.at);
  au(new Date(),S.user.id,'treatment_start','appointments',a.id,before,'in_treatment'); DB.audit.sort((x,y)=>y.at-x.at);
  toast(c.name+' đã chuyển sang trị liệu — vẫn nằm trong danh sách chờ check-out','ok');
  buildNav(); render();
}
/* Đổi KTV / Tư vấn viên sau khi đã check-in */
function openVisitStaff(apid){
  const a=DB.appointments.find(x=>x.id===apid), c=custById(a.customer_id);
  modal(`<div class="modal"><div class="modal-h"><h3>Nhân sự phụ trách lượt khám</h3>
    <button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="alert al-info">${ic('user',16)}<div><b>${esc(c.name)}</b> · ${c.code}<br><span class="t-sub">Visit ${a.id} · ${fmtDT(a.at)}</span></div></div>
    <label class="fld" for="vs-doc"><span class="lb">Bác sĩ khám</span><select class="inp" id="vs-doc"><option value="">— Chưa chỉ định —</option>
      ${doctorList().map(u=>`<option value="${u.id}" ${u.id===a.doctor?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>
    <label class="fld" for="vs-tech"><span class="lb">Kỹ thuật viên</span><select class="inp" id="vs-tech"><option value="">— Chưa chỉ định —</option>
      ${techList().map(u=>`<option value="${u.id}" ${u.id===a.technician_id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>
    <label class="fld" for="vs-consultant"><span class="lb">Tư vấn viên</span><select class="inp" id="vs-consultant"><option value="">— Chưa chỉ định —</option>
      ${consultantList().map(u=>`<option value="${u.id}" ${u.id===a.consultant_id?'selected':''}>${esc(u.name)} · ${esc(u.roles.map(roleName).join(', '))}</option>`).join('')}</select></label>
    <label class="fld" for="vs-room"><span class="lb">Phòng</span><select class="inp" id="vs-room">
      ${DB.rooms.map(r=>`<option value="${r.id}" ${r.id===a.room?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" onclick="saveVisitStaff('${apid}')">${ic('check',16)} Lưu phân công</button></div></div>`);
}
function saveVisitStaff(apid){
  if(!can('reception')&&!can('treatment.sessions')&&!can('admin'))
    return guard('reception','Bạn không có quyền đổi nhân sự phụ trách');
  const a=DB.appointments.find(x=>x.id===apid), c=custById(a.customer_id);
  const before={doctor:a.doctor, technician_id:a.technician_id, consultant_id:a.consultant_id, room:a.room};
  a.doctor=$('#vs-doc').value||null; a.technician_id=$('#vs-tech').value||null;
  a.consultant_id=$('#vs-consultant').value||null; a.room=$('#vs-room').value||a.room;
  const chg=[];
  if(before.technician_id!==a.technician_id){ chg.push('KTV: '+(before.technician_id?userName(before.technician_id):'—')+' → '+(a.technician_id?userName(a.technician_id):'—'));
    au(new Date(),S.user.id,'change_technician','appointments',a.id,before.technician_id||'—',a.technician_id||'—'); }
  if(before.consultant_id!==a.consultant_id){ chg.push('Tư vấn viên: '+(before.consultant_id?userName(before.consultant_id):'—')+' → '+(a.consultant_id?userName(a.consultant_id):'—'));
    au(new Date(),S.user.id,'change_consultant','appointments',a.id,before.consultant_id||'—',a.consultant_id||'—'); }
  if(before.doctor!==a.doctor) au(new Date(),S.user.id,'change_doctor','appointments',a.id,before.doctor||'—',a.doctor||'—');
  DB.audit.sort((x,y)=>y.at-x.at);
  if(chg.length){ tl(c.id,new Date(),'users','blue','Cập nhật nhân sự phụ trách',chg.join(' · '),S.user.name); DB.timeline.sort((x,y)=>y.at-x.at); }
  closeModal(); toast('Đã lưu phân công cho lượt khám '+a.id,'ok'); render();
}
function checkOut(apid){
  if(!guard('reception','Chỉ Lễ tân / Quản trị được check-out khách')) return;
  const a=DB.appointments.find(x=>x.id===apid), c=custById(a.customer_id);
  if(!isPresent(a)) return toast('Khách không ở trạng thái đang có mặt','warn');
  confirmDlg('Check-out khách hàng','Xác nhận kết thúc dịch vụ cho <b>'+esc(c.name)+'</b>?<br><br>Luồng: <b>'+VISIT_FLOW[visitFlow(a)].label+'</b><br>Hệ thống lưu: giờ check-in '+(a.checkin_at?fmtT(a.checkin_at):'—')+', bắt đầu khám '+(a.exam_start?fmtT(a.exam_start):'—')+', kết thúc '+fmtT(new Date())+'.',
    ()=>{ const before=a.status;
      a.status='done'; a.exam_end=a.exam_end||new Date(); a.checkout_at=new Date(); a.checkout_by=S.user.id;
      tl(c.id,a.checkout_at,'checkCircle','green','Check-out',VISIT_FLOW[visitFlow(a)].label,S.user.name);
      DB.timeline.sort((x,y)=>y.at-x.at);
      au(new Date(),S.user.id,'checkout','appointments',a.id,before,'done'); DB.audit.sort((x,y)=>y.at-x.at);
      toast('Đã check-out '+c.name,'ok'); buildNav(); render(); },'Check-out');
}

/* ================= DOCTOR ================= */
function viewDoctor(){
  const t=todayAppts();
  /* Mọi khách đã check-in đều hiện ở đây; cột "Luồng" cho biết ai cần khám,
     ai đi thẳng trị liệu — bác sĩ chủ động bỏ qua chứ hệ thống không ép luồng. */
  const waiting=t.filter(a=>a.status==='waiting')
    .sort((x,y)=>(visitFlow(x)==='doctor'?0:1)-(visitFlow(y)==='doctor'?0:1) || (x.checkin_at||x.at)-(y.checkin_at||y.at));
  const needDoc=waiting.filter(a=>visitFlow(a)==='doctor');
  const inexam=t.filter(a=>a.status==='in_exam');
  const intreat=t.filter(a=>a.status==='in_treatment');
  const done=t.filter(a=>a.status==='done');
  const now=d(0,10,42);
  return head('Bàn làm việc bác sĩ','Hôm nay '+fmtD(TODAY)+' · '+esc(S.user.name),
    `<button class="btn" onclick="location.hash='#/calendar'">${ic('calendar',16)} Lịch của tôi</button>`)
  + `<div class="grid g4" style="margin-bottom:14px">
      ${stat('Đang chờ khám',needDoc.length,needDoc.length?'Chờ lâu nhất '+Math.max(...needDoc.map(a=>a.checkin_at?Math.round((now-a.checkin_at)/60000):0),0)+' phút':'','clock',needDoc.length?'dn':'up')}
      ${stat('Đang khám',inexam.length,'','stethoscope')}
      ${stat('Đi thẳng trị liệu',waiting.length-needDoc.length+intreat.length,'Không cần bác sĩ khám','activity','flat')}
      ${stat('Đã khám hôm nay',done.length,'','checkCircle','up')}
    </div>
    <div class="card" style="margin-bottom:14px"><div class="card-h"><h3>Bệnh nhân đã check-in, đang chờ</h3><span class="badge b-amber nodot">${waiting.length}</span>
      <span class="sub">Khách chọn luồng trị liệu trực tiếp xếp cuối danh sách</span></div>
      <div class="tbl-wrap"><table><thead><tr><th>Tên</th><th>Tuổi / GT</th><th>Giờ hẹn</th><th>Lý do khám</th><th>Luồng</th><th>KTV / Tư vấn viên</th><th>Thời gian chờ</th><th style="width:170px"></th></tr></thead>
      <tbody>${waiting.length?waiting.map(a=>{const c=custById(a.customer_id); const wait=a.checkin_at?Math.round((now-a.checkin_at)/60000):0;
        const visits=DB.appointments.filter(x=>x.customer_id===c.id&&x.status==='done').length;
        return `<tr><td class="row-link" onclick="location.hash='#/customers/${c.id}'"><div class="t-name">${esc(c.name)}</div><div class="t-sub">${c.code} · ${visits?'tái khám lần '+(visits+1):'lần đầu'}</div></td>
          <td>${age(c.dob)} · ${c.gender==='M'?'Nam':'Nữ'}</td><td><b>${fmtT(a.at)}</b></td>
          <td>${esc(a.reason||c.concern)}</td>
          <td>${flowBadge(a)}</td>
          <td class="t-sub">${a.technician_id?esc(userName(a.technician_id)):'—'}<br>${a.consultant_id?esc(userName(a.consultant_id)):'—'}</td>
          <td><span class="wait-pill ${wait>15?'long':''}">${wait} phút</span></td>
          <td><button class="btn sm primary" onclick="startExam('${a.id}')">${ic('stethoscope',16)} BẮT ĐẦU KHÁM</button></td></tr>`}).join('')
        :'<tr><td colspan="8"><div class="empty"><div class="ic-box">'+ic('checkCircle',22)+'</div><div class="t">Không có bệnh nhân đang chờ</div><div>Hàng chờ sẽ tự cập nhật khi lễ tân check-in khách.</div></div></td></tr>'}</tbody></table></div></div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Đang khám</h3></div><div class="card-b tight">
        ${inexam.map(a=>{const c=custById(a.customer_id); const e=DB.encounters.find(x=>x.customer_id===c.id);
        return `<div class="queue-item"><span class="q-time">${fmtT(a.at)}</span><div style="flex:1"><div style="font-weight:650">${esc(c.name)}</div><div class="t-sub">Bắt đầu ${a.exam_start?fmtT(a.exam_start):'—'} · ${esc(c.concern)}</div></div>
        <button class="btn sm primary" onclick="${e?`location.hash='#/doctor/encounter/${e.id}'`:`startExam('${a.id}')`}">Tiếp tục ${ic('arrowRight',15)}</button></div>`}).join('')||'<div class="empty" style="padding:26px"><div class="t">Chưa có ca đang khám</div></div>'}
      </div></div>
      <div class="card"><div class="card-h"><h3>Đã khám hôm nay</h3></div><div class="card-b tight" style="max-height:320px;overflow-y:auto">
        ${done.map(a=>{const c=custById(a.customer_id);
        return `<div class="queue-item"><span class="q-time">${fmtT(a.at)}</span><div style="flex:1"><div style="font-weight:650">${esc(c.name)}</div><div class="t-sub">${esc(c.concern)} · kết thúc ${a.exam_end?fmtT(a.exam_end):'—'}</div></div>
        <span class="badge b-green">Hoàn thành</span></div>`}).join('')||'<div class="empty" style="padding:26px"><div class="t">Chưa có ca nào hoàn thành</div></div>'}
      </div></div>
    </div>`;
}
function startExam(apid){
  if(!guard('medical','Bạn không có quyền khám bệnh')) return;
  const a=DB.appointments.find(x=>x.id===apid), c=custById(a.customer_id);
  a.status='in_exam'; a.exam_start=a.exam_start||new Date(); a.flow='doctor'; c.status='IN_EXAMINATION';
  au(new Date(),S.user.id,'exam_start','appointments',a.id,'waiting','in_exam'); DB.audit.sort((x,y)=>y.at-x.at);
  let e=DB.encounters.find(x=>x.customer_id===c.id&&sameDay(x.at,TODAY));
  if(!e){ e=mkEncounter(c,new Date(),S.user.id); e.status='draft'; e.saved_at=null; e.finalized_at=null; e._dirty=false;
    e.reason=''; e.symptoms=''; e.history=''; e.clinical=''; e.paraclinical=''; e.diagnosis=''; e.doctor_note=''; e.plan=''; e.advice=''; e.assessment_scale=''; e.body_map=[];
    DB.encounters.push(e); }
  tl(c.id,new Date(),'stethoscope','teal',S.user.name+' bắt đầu khám','','');
  DB.timeline.sort((x,y)=>y.at-x.at);
  location.hash='#/doctor/encounter/'+e.id;
}

/* ================= ENCOUNTER (HỒ SƠ KHÁM) ================= */
const ENC_FIELDS=[
  ['reason','A. Lý do khám','VD: Đau thắt lưng lan xuống chân trái 3 tháng nay',2],
  ['symptoms','B. Triệu chứng','Mô tả triệu chứng cơ năng: vị trí, tính chất, mức độ, yếu tố tăng/giảm…',3],
  ['history','C. Bệnh sử','Khởi phát, diễn biến, điều trị đã dùng và đáp ứng…',3],
  ['past','D. Tiền sử','Tiền sử bản thân, gia đình, dị ứng, phẫu thuật, bệnh mạn tính…',2],
  ['clinical','E. Khám lâm sàng','Nhìn – sờ – vận động; nghiệm pháp đặc hiệu (Lasègue, Phalen, Neer…)',3],
  ['assessment_scale','F. Lượng giá','VAS, tầm vận động (ROM), sức cơ (MMT), thang chức năng…',2],
  ['paraclinical','G. Kết quả cận lâm sàng','X-quang, MRI, CT, siêu âm, xét nghiệm…',2],
  ['diagnosis','H. Chẩn đoán','Chẩn đoán xác định / phân biệt',2],
  ['doctor_note','I. Đánh giá của bác sĩ','Nhận định chuyên môn, tiên lượng',2],
  ['plan','J. Hướng điều trị','Bảo tồn / can thiệp; mục tiêu điều trị',2],
  ['advice','L. Dặn dò','Hướng dẫn tại nhà, sinh hoạt, tư thế, bài tập',2],
];
/* Trạng thái hiển thị của hồ sơ khám — 3 mức theo yêu cầu nghiệp vụ:
   'unsaved' Chưa lưu · 'saved' Đã lưu · 'final' Đã chốt bệnh án.
   e._dirty được bật khi bác sĩ gõ và tắt khi bấm Lưu. */
const ENC_STATE={
  unsaved:{label:'Chưa lưu', color:'b-amber', icon:'edit'},
  saved:{label:'Đã lưu', color:'b-blue', icon:'check'},
  final:{label:'Đã chốt bệnh án', color:'b-green', icon:'lock'},
};
function encState(e){
  if(e.status==='final') return 'final';
  return (e.saved_at && !e._dirty) ? 'saved' : 'unsaved';
}
/* Một chỉ báo trạng thái duy nhất trên đầu màn hình — tránh hiển thị trùng lặp
   giữa badge trạng thái và dòng "đã lưu lúc". */
function encStateBadge(e){ const st=ENC_STATE[encState(e)];
  const at = e.status==='final' ? e.finalized_at : e.saved_at;
  return `<span class="badge ${st.color}" id="enc-state">${ic(st.icon,14)} ${st.label}${at?' · '+fmtT(at):''}</span>`; }
/* Hồ sơ đã lưu (hoặc đã chốt) mới được in / xuất file. */
function encPrintable(e){ return !!(e.saved_at || e.status==='final'); }

function viewEncounter(eid){
  const e=encById(eid); if(!e) return '<div class="empty">Không tìm thấy hồ sơ khám</div>';
  const c=custById(e.customer_id);
  const prevEnc=DB.encounters.filter(x=>x.customer_id===c.id&&x.at<e.at).sort((a,b)=>b.at-a.at);
  const printable=encPrintable(e);
  return head('Hồ sơ khám bệnh','<span class="mono">'+e.id+'</span> · '+esc(c.name)+' · '+c.code+' · '+age(c.dob)+' tuổi '+(c.gender==='M'?'Nam':'Nữ'),
    `${encStateBadge(e)}
     ${e.status!=='final'?`<button class="btn primary" onclick="saveEnc('${eid}')">${ic('check',15)} Lưu</button>`:''}
     <button class="btn" ${printable?'':'disabled aria-disabled="true" title="Lưu hồ sơ trước khi in"'} onclick="printEncounter('${eid}')">${ic('file',16)} In hồ sơ</button>
     ${can('data.export')?`<button class="btn" ${printable?'':'disabled aria-disabled="true" title="Lưu hồ sơ trước khi xuất"'} onclick="exportEncounterPDF('${eid}')">${ic('download',16)} Xuất PDF</button>`:''}
     ${e.status==='draft'?`<button class="btn primary" onclick="finalizeEnc('${eid}')">${ic('lock',16)} Chốt bệnh án</button>`:`<button class="btn" onclick="amendEnc('${eid}')">${ic('edit',16)} Sửa (tạo phiên bản mới)</button>`}
     <button class="btn" onclick="location.hash='#/customers/${c.id}'">Hồ sơ 360°</button>
     <button class="btn" onclick="location.hash='#/doctor'">${ic('arrowLeft',15)} Hàng chờ</button>`)
  + `${e.status==='final'?`<div class="alert al-ok">${ic('lock',16)} <div>Bệnh án đã <b>chốt (final, v${e.version})</b> lúc ${fmtDT(e.finalized_at||e.at)}. Mọi chỉnh sửa sau đó sẽ tạo <b>phiên bản mới</b> và ghi vào nhật ký kiểm toán — không sửa âm thầm.</div></div>`
      : (e.saved_at?`<div class="alert al-info" id="enc-hint">${ic('check',16)} <div>Hồ sơ đã <b>lưu</b> lúc ${fmtDT(e.saved_at)} — có thể đóng màn hình rồi mở lại để sửa tiếp, <b>in</b> hoặc <b>xuất PDF</b>. Chốt bệnh án khi đã hoàn tất.</div></div>`
        :`<div class="alert al-warn" id="enc-hint">${ic('edit',16)} <div>Hồ sơ <b>chưa được lưu lần nào</b>. Bấm <b>Lưu</b> để giữ nội dung mà chưa cần chốt bệnh án — sau khi lưu mới in / xuất PDF được.</div></div>`)}
    <div class="grid g-3-2">
      <div class="card"><div class="card-h"><h3>Nội dung khám</h3><span class="sub">${fmtDT(e.at)} · ${esc(userName(e.doctor_id))}</span></div>
        <div class="card-b">
          ${ENC_FIELDS.map(([k,lb,ph,rows])=>`<label class="fld"><span class="lb">${lb}</span>
            <textarea class="inp" rows="${rows}" data-enc="${k}" placeholder="${ph}" oninput="encAutosave('${eid}','${k}',this.value)" ${e.status==='final'?'readonly style="background:#FAFCFD"':''}>${esc(e[k]||'')}</textarea></label>`).join('')}
          <div class="divider"></div>
          <div class="sec-t">K. Phác đồ / liệu trình đề xuất</div>
          <div id="enc-pkg">${encPkgBlock(e,c)}</div>
          <div class="divider"></div>
          <label class="fld"><span class="lb">M. Hẹn tái khám</span><input class="inp" type="date" id="enc-followup" value="${encFollowupISO(e)}" style="max-width:220px"
            onchange="encEdit('${eid}','followup', this.value?fmtD(new Date(this.value+'T00:00:00')):'')" ${e.status==='final'?'readonly':''}></label>
        </div></div>
      <div>
        <div class="card" style="margin-bottom:14px"><div class="card-h"><h3>Sơ đồ cơ thể</h3><span class="sub">Bấm vào vùng để đánh dấu</span></div>
          <div class="card-b bodymap">${bodyMapSVG(e)}
            <div class="chips" style="margin-top:10px">${BM_TYPES.map((t,i)=>`<div class="chip ${i===0?'on':''}" onclick="[...this.parentNode.children].forEach(x=>x.classList.remove('on'));this.classList.add('on');window._bmType='${t.code}'">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.color};margin-right:4px"></span>${t.label}</div>`).join('')}</div>
            <div id="bm-list" style="margin-top:10px">${bmList(e)}</div>
          </div></div>
        <div class="card" style="margin-bottom:14px"><div class="card-h"><h3>Tệp cận lâm sàng</h3>
          <div class="r"><button class="btn sm" onclick="openFileUpload('${c.id}','${eid}')">${ic('upload',16)} Tải lên</button></div></div>
          <div class="card-b tight">${DB.files.filter(f=>f.customer_id===c.id).map(f=>`<div class="queue-item">
            <span style="font-size:20px">${f.name.endsWith('.pdf')?ic('file',16):ic('image',16)}</span>
            <div style="flex:1"><div style="font-weight:650;font-size:13px">${esc(f.name)}</div><div class="t-sub">${f.kind} · ${f.size} · ${fmtD(f.at)}</div></div>
            <button class="btn sm" onclick="openFileView('${f.id}')">Xem</button></div>`).join('')
            ||'<div class="empty" style="padding:22px"><div class="t">Chưa có tệp</div><div style="font-size:12.5px">PDF, JPG, PNG · lưu trữ riêng tư</div></div>'}</div></div>
        <div class="card"><div class="card-h"><h3>Lịch sử khám trước</h3></div>
          <div class="card-b tight">${prevEnc.length?prevEnc.map(p=>`<div class="queue-item" style="cursor:pointer" onclick="location.hash='#/doctor/encounter/${p.id}'">
            <div style="flex:1"><div style="font-weight:650;font-size:13px">${fmtD(p.at)} — ${esc(p.diagnosis)}</div><div class="t-sub">${esc(userName(p.doctor_id))}</div></div><span style="color:var(--muted)">›</span></div>`).join('')
            :'<div class="empty" style="padding:22px"><div class="t">Bệnh nhân khám lần đầu</div></div>'}</div></div>
      </div>
    </div>`;
}
function encPkgBlock(e,c){
  const co=DB.courses.find(x=>x.encounter_id===e.id);
  if(co) return `<div class="alert al-ok">${ic('pill',16)} <div>Đã đề xuất: <b>${esc(pkgById(co.package_id).name)}</b> · ${co.total_sessions} buổi · ${money(co.list_price)}đ<br>
    Trạng thái: <span class="badge ${co.status==='pending'?'b-amber':'b-green'}">${co.status==='pending'?'Chờ trưởng phòng kích hoạt':'Đã kích hoạt'}</span></div></div>`;
  return `<div class="grid g2">
      <label class="fld"><span class="lb">Gói điều trị đề xuất</span><select class="inp" id="pp-pkg" onchange="ppPreview()">
        <option value="">— Chọn gói —</option>${DB.packages.filter(p=>p.active).map(p=>`<option value="${p.id}">${p.name} — ${money(p.price)}đ</option>`).join('')}</select></label>
      <label class="fld"><span class="lb">Số buổi điều chỉnh</span><input class="inp" id="pp-n" type="number" placeholder="Theo gói"></label>
    </div>
    <div id="pp-preview"></div>
    <label class="fld"><span class="lb">Ghi chú cho Trưởng phòng</span><textarea class="inp" id="pp-note" rows="2" placeholder="VD: BN có tiền sử tăng huyết áp, tránh nhiệt trị liệu cường độ cao"></textarea></label>
    <button class="btn primary" onclick="proposePkg('${e.id}')">${ic('pill',16)} Đề xuất liệu trình cho Trưởng phòng</button>`;
}
function ppPreview(){
  const p=pkgById($('#pp-pkg').value); const box=$('#pp-preview');
  if(!p){box.innerHTML='';return;}
  box.innerHTML=`<div class="alert al-info" style="display:block">
    <div style="font-weight:700;margin-bottom:6px">${esc(p.name)} · ${p.sessions} buổi · ${p.duration} phút/buổi</div>
    <div style="font-size:12.5px">Dịch vụ mỗi buổi: ${p.services.map(s=>`<span class="badge b-teal nodot" style="margin:2px">${esc(s)}</span>`).join('')}</div>
    <div style="margin-top:7px;font-size:15px;font-weight:750">Giá niêm yết: ${money(p.price)}đ</div></div>`;
}
function proposePkg(eid){
  if(!guard('treatment.propose','Bạn không có quyền đề xuất liệu trình')) return;
  const e=encById(eid), c=custById(e.customer_id);
  const pid=$('#pp-pkg').value; if(!pid) return toast('Vui lòng chọn gói điều trị','err');
  const p=pkgById(pid); const n=parseInt($('#pp-n').value)||p.sessions;
  const co={id:nextCourseId(), code:'LT-'+String(2026100+DB.courses.length),
    customer_id:c.id, package_id:pid, encounter_id:eid, doctor_id:S.user.id, diagnosis:e.diagnosis||c.concern,
    area: areaForDx(e.diagnosis||c.concern),
    start_date:null, end_date_est:null, total_sessions:n, done_sessions:0,
    list_price:p.price, discount:0, total:p.price, paid:0, status:'pending',
    proposed_at:new Date(), proposed_by:S.user.id, activated_at:null, activated_by:null, op_id:pick(OPS).id,
    metrics:['M1','M2','M3'], note:$('#pp-note').value};
  DB.courses.push(co);
  for(let i=1;i<=n;i++) DB.sessions.push({id:nextSessionId(), course_id:co.id, no:i, at:null, doctor_id:co.doctor_id, tech_id:null, services:p.services.slice(0,3), status:'pending', before:'',intervention:'',after:'',reaction:'',note:'',recommend:''});
  c.status='TREATMENT_PROPOSED';
  tl(c.id,new Date(),'pill','purple','Đề xuất liệu trình',p.name+' · '+n+' buổi · '+money(p.price)+'đ',S.user.name);
  DB.timeline.sort((x,y)=>y.at-x.at);
  toast('Đã gửi đề xuất liệu trình tới Trưởng phòng','ok'); buildNav(); render();
}
function encFollowupISO(e){
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(e.followup||'');
  if(m) return m[3]+'-'+m[2]+'-'+m[1];
  return new Date(TODAY.getTime()+21*86400000).toISOString().slice(0,10);
}
/* Ghi giá trị vào bản ghi trong bộ nhớ và đánh dấu "có thay đổi chưa lưu".
   Nội dung không mất khi rời màn hình, nhưng trạng thái chỉ chuyển sang
   "Đã lưu" khi bác sĩ bấm nút Lưu — đúng yêu cầu 3 trạng thái rõ ràng. */
function encEdit(eid,k,v){
  const e=encById(eid); if(!e || e.status==='final') return;
  if(e[k]===v) return;
  e[k]=v; e._dirty=true;
  const bd=$('#enc-state');
  if(bd){ const st=ENC_STATE.unsaved; bd.className='badge '+st.color; bd.innerHTML=ic(st.icon,14)+' Có thay đổi chưa lưu'; }
  const hint=$('#enc-hint'); if(hint&&!hint.dataset.dirty){ hint.dataset.dirty='1';
    hint.className='alert al-warn'; hint.innerHTML=ic('edit',16)+' <div>Nội dung vừa sửa <b>chưa được lưu</b>. Bấm <b>Lưu</b> để giữ lại mà chưa cần chốt bệnh án.</div>'; }
}
/* giữ tên cũ để không phá vỡ chỗ gọi sẵn có */
function encAutosave(eid,k,v){ encEdit(eid,k,v); }

function saveEnc(eid,silent){
  if(!guard('medical','Chỉ bác sĩ mới được ghi hồ sơ khám')) return false;
  const e=encById(eid); if(!e) return false;
  if(e.status==='final'){ toast('Bệnh án đã chốt — dùng "Sửa (tạo phiên bản mới)" để chỉnh sửa','warn'); return false; }
  const first=!e.saved_at;
  e.saved_at=new Date(); e._dirty=false;
  const c=custById(e.customer_id);
  au(new Date(),S.user.id,'save','medical_encounters',e.id, first?'—':'draft', 'draft đã lưu (v'+e.version+')');
  DB.audit.sort((a,b)=>b.at-a.at);
  if(first){ tl(c.id,e.saved_at,'note','blue','Bác sĩ lưu hồ sơ khám (nháp)','Chưa chốt bệnh án — có thể sửa tiếp',S.user.name);
    DB.timeline.sort((x,y)=>y.at-x.at); }
  if(!silent){ toast('Đã lưu hồ sơ khám '+e.id+' — có thể mở lại để sửa, in hoặc xuất PDF','ok'); render(); }
  return true;
}
function finalizeEnc(eid){
  if(!guard('medical.finalize','Bạn không có quyền chốt bệnh án')) return;
  const e=encById(eid);
  if(!e.diagnosis) return toast('Vui lòng nhập Chẩn đoán (mục H) trước khi chốt bệnh án','err');
  confirmDlg('Chốt bệnh án','Sau khi chốt, bệnh án chuyển sang trạng thái <b>final</b>. Mọi chỉnh sửa sau đó sẽ tạo phiên bản mới và được ghi vào nhật ký kiểm toán. Tiếp tục?',
    ()=>{ e.status='final'; e.saved_at=e.saved_at||new Date(); e.finalized_at=new Date(); e._dirty=false;
      const c=custById(e.customer_id);
      tl(c.id,new Date(),'note','teal','Bác sĩ chốt hồ sơ khám','Chẩn đoán: '+e.diagnosis,S.user.name+' · v'+e.version);
      DB.timeline.sort((x,y)=>y.at-x.at);
      au(new Date(),S.user.id,'finalize','medical_encounters',e.id,'draft','final (v'+e.version+')'); DB.audit.sort((a,b)=>b.at-a.at);
      toast('Đã chốt bệnh án '+e.id,'ok'); render(); },'Chốt bệnh án');
}
function amendEnc(eid){
  const e=encById(eid);
  confirmDlg('Tạo phiên bản mới','Bệnh án đang ở trạng thái final v'+e.version+'. Hệ thống sẽ lưu bản gốc và mở phiên bản <b>v'+(e.version+1)+'</b> để chỉnh sửa. Lý do chỉnh sửa sẽ được ghi nhận.',
    ()=>{ e.version++; e.status='draft'; e.finalized_at=null; e._dirty=false; e.saved_at=new Date();
      au(new Date(),S.user.id,'amend','medical_encounters',e.id,'final (v'+(e.version-1)+')','draft (v'+e.version+')'); DB.audit.sort((a,b)=>b.at-a.at);
      toast('Đã tạo phiên bản v'+e.version,'ok'); render(); },'Tạo phiên bản mới');
}
/* body map */
window._bmType='pain';
function bodyMapSVG(e){
  const marks={}; (e.body_map||[]).forEach(m=>marks[m.part]=m.type);
  const col=t=>(BM_TYPES.find(x=>x.code===t)||{color:'#DCE7EC'}).color;
  const P=(id,shape)=>`<g onclick="bmToggle('${e.id}','${id}')" style="cursor:pointer"><title>${(DB.bodyParts.find(b=>b.id===id)||{}).name}</title>
    ${shape.replace('FILL', marks[id]?col(marks[id]):'#DCE7EC')}</g>`;
  return `<svg viewBox="0 0 220 400" style="max-height:340px;display:block;margin:0 auto">
    <ellipse cx="110" cy="30" rx="21" ry="25" fill="#DCE7EC" stroke="#fff" stroke-width="1.5"/>
    ${P('neck','<rect x="99" y="52" width="22" height="16" rx="6" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('shoulder_l','<circle cx="80" cy="78" r="14" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('shoulder_r','<circle cx="140" cy="78" r="14" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('back','<rect x="88" y="70" width="44" height="46" rx="10" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('lumbar','<rect x="90" y="118" width="40" height="34" rx="9" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('elbow_l','<circle cx="66" cy="130" r="10" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('elbow_r','<circle cx="154" cy="130" r="10" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    <rect x="70" y="88" width="14" height="36" rx="7" fill="#DCE7EC" stroke="#fff" stroke-width="1.5"/>
    <rect x="136" y="88" width="14" height="36" rx="7" fill="#DCE7EC" stroke="#fff" stroke-width="1.5"/>
    <rect x="61" y="138" width="13" height="32" rx="6.5" fill="#DCE7EC" stroke="#fff" stroke-width="1.5"/>
    <rect x="146" y="138" width="13" height="32" rx="6.5" fill="#DCE7EC" stroke="#fff" stroke-width="1.5"/>
    ${P('wrist_l','<circle cx="67" cy="176" r="8" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('wrist_r','<circle cx="152" cy="176" r="8" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('hand_l','<ellipse cx="66" cy="192" rx="10" ry="13" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('hand_r','<ellipse cx="153" cy="192" rx="10" ry="13" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('hip_l','<circle cx="98" cy="164" r="13" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('hip_r','<circle cx="122" cy="164" r="13" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    <rect x="88" y="176" width="20" height="52" rx="9" fill="#DCE7EC" stroke="#fff" stroke-width="1.5"/>
    <rect x="112" y="176" width="20" height="52" rx="9" fill="#DCE7EC" stroke="#fff" stroke-width="1.5"/>
    ${P('knee_l','<circle cx="98" cy="240" r="13" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('knee_r','<circle cx="122" cy="240" r="13" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    <rect x="90" y="252" width="17" height="54" rx="8" fill="#DCE7EC" stroke="#fff" stroke-width="1.5"/>
    <rect x="113" y="252" width="17" height="54" rx="8" fill="#DCE7EC" stroke="#fff" stroke-width="1.5"/>
    ${P('ankle_l','<circle cx="98" cy="314" r="9" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('ankle_r','<circle cx="122" cy="314" r="9" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('foot_l','<ellipse cx="95" cy="332" rx="13" ry="9" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    ${P('foot_r','<ellipse cx="125" cy="332" rx="13" ry="9" fill="FILL" stroke="#fff" stroke-width="1.5"/>')}
    <text x="110" y="360" text-anchor="middle" font-size="10" fill="var(--muted)">Mặt trước · bấm vùng để đánh dấu</text>
  </svg>`;
}
function bmToggle(eid,part){
  const e=encById(eid); e.body_map=e.body_map||[];
  const i=e.body_map.findIndex(m=>m.part===part);
  if(i>=0 && e.body_map[i].type===window._bmType) e.body_map.splice(i,1);
  else if(i>=0) e.body_map[i].type=window._bmType;
  else e.body_map.push({part, type:window._bmType, level:5});
  const host=document.querySelector('.bodymap'); if(host){ host.querySelector('svg').outerHTML=bodyMapSVG(e); $('#bm-list').innerHTML=bmList(e); }
}
function bmList(e){
  if(!e.body_map||!e.body_map.length) return '<div class="t-sub" style="text-align:center">Chưa đánh dấu vùng nào. Dữ liệu lưu dạng JSON có cấu trúc.</div>';
  return e.body_map.map(m=>{const t=BM_TYPES.find(x=>x.code===m.type)||{};
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 9px;border:1px solid var(--line);border-radius:8px;margin-bottom:5px">
      <span style="width:9px;height:9px;border-radius:50%;background:${t.color}"></span>
      <span style="flex:1;font-size:13px;font-weight:600">${(DB.bodyParts.find(b=>b.id===m.part)||{}).name}</span>
      <span class="badge b-gray nodot">${t.label}</span></div>`}).join('');
}

/* ================= TREATMENT LIST ================= */
function viewTreatments(){
  const f=S.filters.tr=S.filters.tr||{tab:'pending'};
  const tabs={pending:'Chờ kích hoạt',active:'Đang điều trị',completed:'Hoàn thành',all:'Tất cả'};
  let list=DB.courses.filter(c=>f.tab==='all'?true:c.status===f.tab);
  return head('Liệu trình điều trị','Bác sĩ đề xuất '+ic('arrowRight',15)+' Trưởng phòng xác nhận &amp; kích hoạt '+ic('arrowRight',15)+' sinh các buổi điều trị',
    can('treatment.approve')?`<span class="badge b-amber nodot" style="padding:8px 12px">Bạn có quyền kích hoạt liệu trình</span>`:'')
  + `<div class="grid g4" style="margin-bottom:14px">
      ${stat('Chờ kích hoạt',DB.courses.filter(c=>c.status==='pending').length,'Cần Trưởng phòng duyệt','lock','dn',"S.filters.tr.tab='pending';render()")}
      ${stat('Đang điều trị',DB.courses.filter(c=>c.status==='active').length,'','pill','flat',"S.filters.tr.tab='active';render()")}
      ${stat('Hoàn thành',DB.courses.filter(c=>c.status==='completed').length,'','flag','up',"S.filters.tr.tab='completed';render()")}
      ${stat('Tổng giá trị',moneyS(DB.courses.filter(c=>c.status!=='pending').reduce((a,b)=>a+b.total,0))+'đ','Đã thu '+moneyS(DB.courses.reduce((a,b)=>a+b.paid,0))+'đ','banknote','up')}
    </div>
    ${f.tab==='pending'&&list.length?`<div class="alert al-warn">${ic('lock',16)} <div><b>${list.length} liệu trình đang chờ kích hoạt.</b> Liệu trình chưa kích hoạt sẽ không sinh buổi điều trị và không tính vào doanh thu.</div></div>`:''}
    <div class="card"><div class="tabs">${Object.entries(tabs).map(([k,l])=>`<div class="tab ${f.tab===k?'on':''}" onclick="S.filters.tr.tab='${k}';render()">${l}<span class="cnt">${k==='all'?DB.courses.length:DB.courses.filter(c=>c.status===k).length}</span></div>`).join('')}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Mã LT</th><th>Khách hàng</th><th>Chẩn đoán</th><th>Bác sĩ đề xuất</th><th>Gói đề xuất</th><th>Số buổi</th><th class="t-right">Giá trị</th><th>Tiến độ</th><th>Ngày đề xuất</th><th>Trạng thái</th><th style="width:230px"></th></tr></thead>
    <tbody>${list.map(co=>{const c=custById(co.customer_id);
      return `<tr><td class="t-code">${co.code}</td>
        <td class="row-link" onclick="location.hash='#/customers/${c.id}'"><div class="t-name">${esc(c.name)}</div><div class="t-sub">${fmtPhone(c.phone)}</div></td>
        <td>${esc(co.diagnosis)}</td><td class="t-sub">${esc(userName(co.doctor_id))}</td>
        <td><div style="font-size:13px">${esc(pkgById(co.package_id).name)}</div><div class="t-sub">${pkgById(co.package_id).group}</div></td>
        <td class="t-center">${co.total_sessions}</td>
        <td class="t-right"><b>${money(co.total)}đ</b>${co.discount?`<div class="t-sub">giảm ${money(co.discount)}</div>`:''}</td>
        <td>${co.status==='pending'?'<span class="t-sub">—</span>':`<div style="font-size:12px">${co.done_sessions}/${co.total_sessions}</div><div class="mini-bar"><i style="width:${co.done_sessions/co.total_sessions*100}%"></i></div>`}</td>
        <td class="t-sub">${fmtD(co.proposed_at)}</td>
        <td><span class="badge ${co.status==='pending'?'b-amber':co.status==='active'?'b-teal':'b-green'}">${co.status==='pending'?'Chờ kích hoạt':co.status==='active'?'Đang điều trị':'Hoàn thành'}</span></td>
        <td>${co.status==='pending'&&can('treatment.approve')?`<div style="display:flex;gap:4px">
            <button class="btn sm primary" onclick="activateCourse('${co.id}')">${ic('check',15)} Xác nhận</button>
            <button class="btn sm" onclick="editCourse('${co.id}')">Chỉnh gói</button>
            <button class="btn sm danger" onclick="rejectCourse('${co.id}')">Từ chối</button></div>`
          :`<button class="btn sm" onclick="location.hash='#/treatment/${co.id}'">Xem chi tiết ${ic('arrowRight',15)}</button>`}</td></tr>`}).join('')
      ||'<tr><td colspan="11"><div class="empty"><div class="ic-box">'+ic('package',16)+'</div><div class="t">Không có liệu trình</div></div></td></tr>'}</tbody></table></div></div>`;
}
function activateCourse(id){
  if(!guard('treatment.approve','Chỉ Trưởng phòng / Quản trị được kích hoạt liệu trình')) return;
  const co=courseById(id), c=custById(co.customer_id), p=pkgById(co.package_id);
  modal(`<div class="modal"><div class="modal-h"><h3>Xác nhận &amp; kích hoạt liệu trình</h3><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="alert al-info">${ic('package',16)} <div><b>${esc(c.name)}</b> · ${c.code}<br>Chẩn đoán: ${esc(co.diagnosis)}<br>Bác sĩ đề xuất: ${esc(userName(co.doctor_id))}</div></div>
    <div class="kv"><div class="k">Gói</div><div class="v">${esc(p.name)}</div>
      <div class="k">Số buổi</div><div class="v">${co.total_sessions} buổi × ${p.duration} phút</div>
      <div class="k">Giá niêm yết</div><div class="v">${money(co.list_price)}đ</div></div>
    <div class="divider"></div>
    <div class="grid g2">
      <label class="fld"><span class="lb">Giảm giá</span><input class="inp" type="number" id="ac-disc" value="0" step="100000" oninput="$('#ac-total').textContent=money(${co.list_price}-(+this.value||0))+'đ'"></label>
      <label class="fld"><span class="lb">Ngày bắt đầu <span class="req">*</span></span><input class="inp" type="date" id="ac-start" value="${new Date(TODAY.getTime()+86400000).toISOString().slice(0,10)}"></label>
    </div>
    <label class="fld"><span class="lb">Bác sĩ phụ trách liệu trình</span><select class="inp" id="ac-doc">${doctorList().map(u=>`<option value="${u.id}" ${u.id===co.doctor_id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>
    <label class="fld"><span class="lb">OP phụ trách chăm sóc</span><select class="inp" id="ac-op">${opList().map(u=>`<option value="${u.id}" ${u.id===co.op_id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>
    <label class="fld"><span class="lb">Vùng điều trị</span><select class="inp" id="ac-area">${TREAT_AREAS.map(a=>`<option ${a===(co.area||areaForDx(co.diagnosis))?'selected':''}>${a}</option>`).join('')}</select></label>
    <div class="sec-t">Chỉ số lượng giá theo dõi</div>
    <div class="chips">${DB.metrics.filter(m=>m.active).map(m=>`<div class="chip ${co.metrics.includes(m.id)?'on':''}" onclick="this.classList.toggle('on')" data-m="${m.id}">${m.name}</div>`).join('')}</div>
    <div style="margin-top:14px;padding:12px;background:var(--brand-50);border-radius:10px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:650">Thành tiền</span><span style="font-size:20px;font-weight:800;color:var(--brand-700)" id="ac-total">${money(co.total)}đ</span></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="doActivate('${id}')">${ic('unlock',16)} Kích hoạt liệu trình</button></div></div>`);
}
function doActivate(id){
  if(!guard('treatment.approve','Chỉ Trưởng phòng / Quản trị được kích hoạt liệu trình')) return;
  const co=courseById(id), c=custById(co.customer_id), p=pkgById(co.package_id);
  const disc=+$('#ac-disc').value||0;
  co.discount=disc; co.total=co.list_price-disc;
  co.start_date=new Date($('#ac-start').value+'T09:00:00');
  co.end_date_est=new Date(co.start_date.getTime()+co.total_sessions*3*86400000);
  co.doctor_id=$('#ac-doc').value; co.op_id=$('#ac-op').value;
  if($('#ac-area')) co.area=$('#ac-area').value;
  co.metrics=[...document.querySelectorAll('.chip.on[data-m]')].map(x=>x.dataset.m);
  co.status='active'; co.activated_at=new Date(); co.activated_by=S.user.id;
  const ss=courseSessions(id);
  ss.forEach((s,i)=>{ s.doctor_id=co.doctor_id; if(i===0){ s.status='booked'; s.at=new Date(co.start_date); } });
  c.status='PACKAGE_ACTIVE';
  tl(c.id,new Date(),'unlock','green','Trưởng phòng kích hoạt liệu trình',co.code+' · '+co.total_sessions+' buổi · '+money(co.total)+'đ',S.user.name);
  DB.timeline.sort((x,y)=>y.at-x.at);
  au(new Date(),S.user.id,'activate','treatment_courses',co.id,'pending','active'); DB.audit.sort((a,b)=>b.at-a.at);
  closeModal(); toast('Đã kích hoạt '+co.code+' — đã tạo '+co.total_sessions+' buổi điều trị','ok'); buildNav(); render();
}
function editCourse(id){ activateCourse(id); toast('Bạn có thể chỉnh số buổi, giảm giá và chỉ số theo dõi trước khi kích hoạt','info'); }
function rejectCourse(id){
  const co=courseById(id);
  confirmDlg('Từ chối đề xuất liệu trình','Liệu trình <b>'+co.code+'</b> sẽ bị từ chối và ghi vào nhật ký. Bác sĩ sẽ nhận được thông báo.',
    ()=>{ co.status='cancelled'; toast('Đã từ chối liệu trình '+co.code,'warn'); buildNav(); render(); },'Từ chối',true);
}

/* ================= COURSE DETAIL + PROGRESS ================= */
function viewCourse(id){
  const co=courseById(id); if(!co) return '<div class="empty">Không tìm thấy liệu trình</div>';
  const c=custById(co.customer_id), p=pkgById(co.package_id);
  const ss=courseSessions(id);
  const doneS=ss.filter(s=>s.status==='done');
  const nextS=ss.find(s=>s.status==='booked')||ss.find(s=>s.status==='pending');
  const pct=Math.round(co.done_sessions/co.total_sessions*100);
  if(co.status==='pending') return head('Liệu trình '+co.code, esc(c.name)+(co.area?' · vùng '+esc(co.area):'')+' · '+esc(p.name),
      `<button class="btn" onclick="location.hash='#/customers/${c.id}'">Hồ sơ 360°</button>`)
    +`<div class="card"><div class="empty"><div class="ic-box">${ic('lock',16)}</div><div class="t">Liệu trình chưa được kích hoạt</div><div>Đang chờ Trưởng phòng xác nhận. Chưa thể tạo buổi điều trị hay ghi nhận chỉ số.</div>${can('treatment.approve')?`<button class="btn primary" style="margin-top:12px" onclick="activateCourse('${id}')">${ic('unlock',16)} Kích hoạt ngay</button>`:''}</div></div>`;
  const allCos=custCourses(co.customer_id);
  return head(esc(c.name)+' — '+esc(p.name),'<span class="mono">'+co.code+'</span> · '+esc(co.diagnosis)+(co.area?' · vùng '+esc(co.area):'')+' · BS. phụ trách: '+esc(co.doctor_id?userName(co.doctor_id):'—'),
    `<button class="btn" onclick="location.hash='#/customers/${c.id}'">Hồ sơ 360°</button>
     <button class="btn" onclick="callModal('${c.id}')">${ic('phone',15)} Gọi khách</button>
     ${can('treatment.purchase')?`<button class="btn" onclick="openAddPackage('${c.id}','${esc(co.area||'')}')">${ic('package',16)} Mua thêm gói</button>`:''}
     <button class="btn primary" onclick="openBooking('${c.id}')">${ic('calendar',16)} Đặt buổi tiếp theo</button>`)
  + `${allCos.length>1?`<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>Các gói trị liệu của khách</h3>
      <span class="badge b-gray nodot">${allCos.length} gói</span><span class="sub">bấm để chuyển gói · dữ liệu từng gói tách biệt</span></div>
      <div class="card-b"><div class="chips">${allCos.map(x=>`<div class="chip ${x.id===co.id?'on':''}" role="button" tabindex="0"
        onclick="location.hash='#/treatment/${x.id}'" onkeydown="if(event.key==='Enter'){location.hash='#/treatment/${x.id}'}">
        ${esc(pkgById(x.package_id).name.split(' - ')[0])}${x.area?' · '+esc(x.area):''}
        <span class="cnt">${x.done_sessions}/${x.total_sessions}</span></div>`).join('')}</div></div></div>`:''}
    <div class="grid g4" style="margin-bottom:14px">
      <div class="stat"><div class="lb">Tiến độ liệu trình</div><div class="vl">${co.done_sessions} / ${co.total_sessions}</div>
        <div class="progress" style="margin-top:9px"><i style="width:${pct}%"></i></div>
        <div class="df flat" style="margin-top:6px">${pct}% hoàn thành</div></div>
      ${stat('Bắt đầu',fmtD(co.start_date),'Dự kiến xong '+fmtD(co.end_date_est),'calendar')}
      ${stat('Buổi gần nhất',doneS.length?fmtD(doneS[doneS.length-1].at):'—',doneS.length?'Cách đây '+daysBetween(doneS[doneS.length-1].at,TODAY)+' ngày':'','activity')}
      ${stat('Buổi tiếp theo',nextS&&nextS.at?fmtD(nextS.at):'Chưa đặt',nextS&&nextS.at?fmtT(nextS.at)+' · '+userName(nextS.tech_id||co.doctor_id):'Cần OP liên hệ đặt lịch','calendar',nextS&&nextS.at?'up':'dn')}
    </div>
    ${progressBlock(co)}
    <div class="grid g-2-1" style="margin-top:14px">
      <div class="card"><div class="card-h"><h3>Lịch sử buổi điều trị</h3><span class="sub">${co.total_sessions} buổi</span>
        <div class="r">${can('data.export')?`<button class="btn sm" onclick="exportCourse(courseById('${id}'))">${ic('download',16)} Xuất</button>`:''}</div></div>
        <div class="card-b">${ss.map(s=>{
          const st=SESS_ST[s.status];
          const mv=DB.metricValues.filter(v=>v.session_id===s.id);
          return `<div class="sess ${s.status==='done'?'done':s.status==='booked'?'booked':s.status==='skipped'||s.status==='cancelled'?'skip':''}" onclick="sessionDetail('${s.id}')">
            <div class="n">${s.status==='done'?ic('check',15):s.no}</div>
            <div style="flex:1">
              <div style="font-weight:650">Buổi ${s.no} ${s.at?'— '+fmtD(s.at)+' '+fmtT(s.at):''}</div>
              <div class="t-sub">${s.status==='done'?esc(s.intervention):esc(s.services.join(', '))}${s.tech_id?' · KTV '+esc(userName(s.tech_id).replace('KTV. ','')):''}</div>
            </div>
            ${mv.length?`<div style="display:flex;gap:5px">${mv.map(v=>{const m=metricById(v.metric_id);
              return `<span class="badge nodot" style="background:${m.color}18;color:${m.color}">${m.name.split(' (')[0].replace('Mức độ ','')} ${v.value}</span>`}).join('')}</div>`:''}
            <span class="badge ${st.color}">${st.label}</span>
          </div>`}).join('')}</div></div>
      <div>
        <div class="card" style="margin-bottom:14px"><div class="card-h"><h3>Thanh toán</h3></div><div class="card-b">
          <div class="kv"><div class="k">Giá niêm yết</div><div class="v">${money(co.list_price)}đ</div>
            <div class="k">Giảm giá</div><div class="v">${co.discount?'-'+money(co.discount)+'đ':'—'}</div>
            <div class="k">Phải thanh toán</div><div class="v" style="font-size:15px">${money(co.total)}đ</div>
            <div class="k">Đã thanh toán</div><div class="v" style="color:var(--ok)">${money(co.paid)}đ</div>
            <div class="k">Còn lại</div><div class="v" style="color:${co.total-co.paid>0?'var(--danger)':'var(--ok)'};font-size:15px">${money(Math.max(0,co.total-co.paid))}đ</div></div>
          <div class="progress" style="margin-top:10px"><i style="width:${Math.min(100,co.paid/co.total*100)}%"></i></div>
          ${can('payments')?`<button class="btn primary block" style="margin-top:11px" onclick="openPayment('${co.id}')">＋ Thu tiền</button>`:''}
          <div class="divider"></div>
          <div class="sec-t">Giao dịch</div>
          ${coursePayments(id).map(p=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #F1F5F7;font-size:12.5px">
            <div><div>${fmtD(p.at)} · ${(PAY_METHODS.find(m=>m.code===p.method)||{}).label}</div><div class="t-sub">${esc(p.note)}</div></div>
            <b style="color:${p.amount<0?'var(--danger)':'var(--ok)'}">${p.amount<0?'':'+'}${money(p.amount)}</b></div>`).join('')||'<div class="t-sub">Chưa có giao dịch</div>'}
        </div></div>
        <div class="card"><div class="card-h"><h3>Dịch vụ trong gói</h3></div><div class="card-b">
          <div class="chips">${p.services.map(s=>`<span class="badge b-teal nodot">${esc(s)}</span>`).join('')}</div>
          <div class="kv" style="margin-top:12px"><div class="k">Nhóm dịch vụ</div><div class="v">${p.group}</div>
            <div class="k">Thời lượng</div><div class="v">${p.duration} phút/buổi</div>
            <div class="k">OP chăm sóc</div><div class="v">${esc(userName(co.op_id))}</div>
            <div class="k">Kích hoạt bởi</div><div class="v">${esc(userName(co.activated_by))} · ${fmtD(co.activated_at)}</div></div>
        </div></div>
      </div>
    </div>`;
}
function progressBlock(co){
  const ss=courseSessions(co.id).filter(s=>s.status==='done');
  const off=S.filters.mOff=S.filters.mOff||{};
  const series=co.metrics.map(mid=>{
    const m=metricById(mid);
    const pts=DB.metricValues.filter(v=>v.course_id===co.id&&v.metric_id===mid).sort((a,b)=>a.session_no-b.session_no).map(v=>({x:v.session_no,y:v.value}));
    return {metric:m, points:pts, on: off[co.id+mid]!==true};
  }).filter(s=>s.points.length);
  const cards=series.map(s=>{
    const first=s.points[0].y, last=s.points[s.points.length-1].y;
    const abs=Math.round((last-first)*10)/10;
    const pctv=first? Math.round(Math.abs((last-first)/first*100)*10)/10 : 0;
    const better = s.metric.higher_is_better ? last>first : last<first;
    return `<div class="card" style="box-shadow:none"><div class="card-b">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:7px">
        <span style="width:10px;height:10px;border-radius:3px;background:${s.metric.color}"></span>
        <div style="font-weight:700;font-size:13px">${esc(s.metric.name)}</div></div>
      <div class="metric-delta"><span class="from">${first}</span><span class="arrow">${ic('arrowRight',15)}</span><span class="to">${last}</span>
        <span class="t-sub">${s.metric.unit}</span></div>
      <div class="${better?'imp-up':'imp-dn'}" style="margin-top:5px">${ic(better?(s.metric.higher_is_better?'trendUp':'trendDown'):'alert',14)} ${pctv}% ${better?'cải thiện':'chưa cải thiện'} <span class="t-sub" style="font-weight:500">(${abs>0?'+':''}${abs} ${s.metric.unit})</span></div>
      <div class="t-sub" style="margin-top:4px">Đầu kỳ ${first} · Hiện tại ${last} · ${s.points.length} lần đo</div>
    </div></div>`;
  }).join('');
  return `<div class="card"><div class="card-h"><h3>Tiến triển điều trị</h3>
    <span class="sub">Dữ liệu do bác sĩ / KTV nhập tại từng buổi — hệ thống chỉ tính toán, không tự chẩn đoán</span>
    <div class="r">${can('doctor')||can('treatment.sessions')||can('admin')?`<button class="btn sm primary" onclick="openMetricEntry('${co.id}')">＋ Nhập lượng giá</button>`:''}</div></div>
    <div class="card-b">
      <div class="chips" style="margin-bottom:12px">${co.metrics.map(mid=>{const m=metricById(mid); const on=off[co.id+mid]!==true;
        return `<div class="chip ${on?'on':''}" onclick="S.filters.mOff['${co.id+mid}']=${on};render()" style="${on?`background:${m.color};border-color:${m.color}`:''}">${esc(m.name)} <span class="n">(${m.higher_is_better?'cao hơn = tốt hơn':'thấp hơn = tốt hơn'})</span></div>`}).join('')}</div>
      ${series.length? lineChart(series,{h:300}) : '<div class="empty"><div class="ic-box">'+ic('lineChart',22)+'</div><div class="t">Chưa có dữ liệu lượng giá</div><div>Nhập chỉ số ở từng buổi điều trị để biểu đồ hiển thị xu hướng.</div></div>'}
      ${series.filter(s=>s.on).length>1?'<div class="t-sub" style="text-align:center;margin-top:-6px">Trục Y hiển thị dạng % thang đo khi bật nhiều chỉ số · bật 1 chỉ số để xem giá trị tuyệt đối</div>':''}
      <div class="grid g3" style="margin-top:14px">${cards}</div>
    </div></div>`;
}
function openMetricEntry(coid){
  const co=courseById(coid);
  const ss=courseSessions(coid);
  const target=ss.find(s=>s.status==='booked')||ss.find(s=>s.status==='done'&&!DB.metricValues.some(v=>v.session_id===s.id))||ss[ss.length-1];
  modal(`<div class="modal"><div class="modal-h"><h3>Nhập chỉ số lượng giá</h3><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <label class="fld"><span class="lb">Buổi điều trị</span><select class="inp" id="me-sess">
      ${ss.map(s=>`<option value="${s.id}" ${s.id===target.id?'selected':''}>Buổi ${s.no}${s.at?' — '+fmtD(s.at):''} (${SESS_ST[s.status].label})</option>`).join('')}</select>
      <div class="hint">Chỉ số chỉ được ghi vào buổi thuộc chính liệu trình này.</div></label>
    <div class="divider"></div>
    ${co.metrics.map(mid=>{const m=metricById(mid);
      return `<label class="fld"><span class="lb">${esc(m.name)} <span class="t-sub" style="font-weight:500">(${m.min}–${m.max} ${m.unit} · ${m.higher_is_better?'cao hơn = tốt hơn':'thấp hơn = tốt hơn'})</span></span>
        <div style="display:flex;gap:11px;align-items:center">
          <input type="range" min="${m.min}" max="${m.max}" step="${m.max<=10?0.5:1}" value="${Math.round((m.min+m.max)/2)}" style="flex:1;accent-color:${m.color}" oninput="this.nextElementSibling.textContent=this.value" data-metric="${mid}">
          <span style="font-weight:800;font-size:18px;min-width:44px;text-align:right;color:${m.color}">${Math.round((m.min+m.max)/2)}</span>
        </div><div class="hint">${esc(m.desc)}</div></label>`}).join('')}
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveMetrics('${coid}')">Lưu lượng giá</button></div></div>`);
}
function saveMetrics(coid){
  const sid=$('#me-sess').value; const s=DB.sessions.find(x=>x.id===sid); const co=courseById(coid);
  document.querySelectorAll('[data-metric]').forEach(inp=>{
    const mid=inp.dataset.metric, val=parseFloat(inp.value);
    const ex=DB.metricValues.find(v=>v.session_id===sid&&v.metric_id===mid);
    if(ex){ au(new Date(),S.user.id,'update','clinical_metric_values',ex.id,metricById(mid).code+' '+ex.value,metricById(mid).code+' '+val); ex.value=val; }
    else DB.metricValues.push({id:'MV'+(DB.metricValues.length+1), course_id:coid, session_id:sid, session_no:s.no, metric_id:mid, value:val, at:s.at||new Date(), by:S.user.id});
  });
  DB.audit.sort((a,b)=>b.at-a.at);
  closeModal(); toast('Đã lưu lượng giá buổi '+s.no,'ok'); render();
}
function sessionDetail(sid){
  const s=DB.sessions.find(x=>x.id===sid), co=courseById(s.course_id), c=custById(co.customer_id);
  const mv=DB.metricValues.filter(v=>v.session_id===sid);
  const editable=s.status!=='done'||can('admin');
  modal(`<div class="modal wide"><div class="modal-h"><h3>Buổi ${s.no}/${co.total_sessions} — ${esc(c.name)}</h3>
    <span class="badge ${SESS_ST[s.status].color}">${SESS_ST[s.status].label}</span><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b"><div class="grid g2">
    <div>
      <div class="grid g2">
        <label class="fld"><span class="lb">Ngày</span><input class="inp" id="se-date" type="date" value="${s.at?new Date(s.at.getTime()-s.at.getTimezoneOffset()*60000).toISOString().slice(0,10):''}"></label>
        <label class="fld"><span class="lb">Giờ</span><input class="inp" id="se-time" type="time" value="${s.at?fmtT(s.at):'09:00'}"></label>
      </div>
      <div class="grid g2">
        <label class="fld"><span class="lb">Bác sĩ</span><select class="inp" id="se-doc">${DOCTORS.map(u=>`<option ${u.id===s.doctor_id?'selected':''}>${u.name}</option>`).join('')}</select></label>
        <label class="fld"><span class="lb">Kỹ thuật viên</span><select class="inp" id="se-tech">${TECHS.map(u=>`<option ${u.id===s.tech_id?'selected':''}>${u.name}</option>`).join('')}</select></label>
      </div>
      <label class="fld"><span class="lb">Dịch vụ thực hiện</span>
        <div class="chips">${pkgById(co.package_id).services.map(x=>`<div class="chip se-svc ${s.services.includes(x)?'on':''}" onclick="this.classList.toggle('on')">${esc(x)}</div>`).join('')}</div></label>
      <label class="fld"><span class="lb">Tình trạng trước buổi</span><textarea class="inp" id="se-before" rows="2">${esc(s.before)}</textarea></label>
      <label class="fld"><span class="lb">Can thiệp đã thực hiện</span><textarea class="inp" id="se-interv" rows="2">${esc(s.intervention)}</textarea></label>
    </div>
    <div>
      <label class="fld"><span class="lb">Tình trạng sau buổi</span><textarea class="inp" id="se-after" rows="2">${esc(s.after)}</textarea></label>
      <label class="fld"><span class="lb">Phản ứng / tác dụng không mong muốn</span><textarea class="inp" id="se-react" rows="2">${esc(s.reaction)}</textarea></label>
      <label class="fld"><span class="lb">Ghi chú</span><textarea class="inp" id="se-note" rows="2">${esc(s.note)}</textarea></label>
      <label class="fld"><span class="lb">Khuyến nghị cho bệnh nhân</span><textarea class="inp" id="se-rec" rows="2">${esc(s.recommend)}</textarea></label>
      <div class="sec-t">Chỉ số lượng giá buổi này</div>
      ${mv.length?mv.map(v=>{const m=metricById(v.metric_id);
        return `<div style="display:flex;align-items:center;gap:9px;padding:7px 10px;border:1px solid var(--line);border-radius:9px;margin-bottom:6px">
          <span style="width:9px;height:9px;border-radius:50%;background:${m.color}"></span>
          <span style="flex:1;font-size:13px">${esc(m.name)}</span><b style="font-size:16px;color:${m.color}">${v.value}</b><span class="t-sub">${m.unit}</span></div>`}).join('')
        :`<div class="alert al-warn">${ic('alert',16)} <div>Chưa nhập chỉ số lượng giá cho buổi này.</div></div>`}
      <button class="btn block" onclick="closeModal();openMetricEntry('${co.id}')">${ic('plus',15)} Nhập / sửa lượng giá</button>
    </div>
  </div></div>
  <div class="modal-f">
    <button class="btn" onclick="closeModal()">Đóng</button>
    <button class="btn" onclick="saveSession('${sid}')">${ic('check',15)} Lưu thông tin</button>
    ${s.status!=='done'?`<button class="btn danger" onclick="markSession('${sid}','skipped')">Bỏ buổi</button>
      <button class="btn primary" onclick="saveSession('${sid}');markSession('${sid}','done')">${ic('checkCircle',16)} Hoàn thành buổi</button>`
      :`<span class="badge b-green nodot" style="padding:9px 12px">Đã hoàn thành — không thể ghi nhận hai lần</span>`}</div></div>`);
}
function markSession(sid,st){
  const s=DB.sessions.find(x=>x.id===sid), co=courseById(s.course_id), c=custById(co.customer_id);
  if(s.status==='done') return toast('Buổi này đã hoàn thành — không thể ghi nhận hai lần','err');
  s.status=st; s.at=s.at||new Date();
  if(st==='done'){
    co.done_sessions++; co.status = co.done_sessions>=co.total_sessions?'completed':'active';
    if(c.status!=='IN_TREATMENT'&&co.status==='active') c.status='IN_TREATMENT';
    if(co.status==='completed'){ c.status='TREATMENT_COMPLETED';
      tl(c.id,new Date(),'flag','green','Hoàn thành liệu trình',co.total_sessions+'/'+co.total_sessions+' buổi',''); }
    const next=courseSessions(co.id).find(x=>x.status==='pending');
    if(next){ next.status='booked'; next.at=new Date((s.at).getTime()+2*86400000); }
    tl(c.id,s.at,'activity','green','Điều trị buổi '+s.no+'/'+co.total_sessions,s.intervention||'Đã thực hiện',S.user.name);
    DB.timeline.sort((x,y)=>y.at-x.at);
  }
  closeModal(); toast('Đã cập nhật buổi '+s.no+': '+SESS_ST[st].label,'ok'); buildNav(); render();
}

/* ================= SESSIONS (KTV) ================= */
function viewSessions(){
  const f=S.filters.se=S.filters.se||{tab:'today'};
  const all=DB.sessions.filter(s=>s.at);
  const groups={today:all.filter(s=>sameDay(s.at,TODAY)), upcoming:all.filter(s=>s.at>d(0,23,59)&&s.status==='booked'),
    mine:all.filter(s=>s.tech_id===S.user.id), done:all.filter(s=>s.status==='done')};
  const labels={today:'Hôm nay',upcoming:'Sắp tới',mine:'Của tôi',done:'Đã hoàn thành'};
  const list=groups[f.tab].sort((a,b)=>a.at-b.at).slice(0,50);
  return head('Buổi điều trị','Danh sách buổi được phân công · KTV ghi nhận thông tin thực hiện, không sửa chẩn đoán của bác sĩ')
  + `<div class="grid g4" style="margin-bottom:14px">
      ${stat('Buổi hôm nay',groups.today.length,'','calendar')}
      ${stat('Sắp tới',groups.upcoming.length,'','arrowRight')}
      ${stat('Được phân công cho tôi',groups.mine.length,'','user')}
      ${stat('Đã hoàn thành',groups.done.length,'','checkCircle','up')}</div>
    <div class="card"><div class="tabs">${Object.entries(labels).map(([k,l])=>`<div class="tab ${f.tab===k?'on':''}" onclick="S.filters.se.tab='${k}';render()">${l}<span class="cnt">${groups[k].length}</span></div>`).join('')}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Thời gian</th><th>Bệnh nhân</th><th>Liệu trình</th><th>Buổi</th><th>Dịch vụ</th><th>Bác sĩ</th><th>KTV</th><th>Chỉ số</th><th>Trạng thái</th><th></th></tr></thead>
    <tbody>${list.map(s=>{const co=courseById(s.course_id), c=custById(co.customer_id); const mv=DB.metricValues.filter(v=>v.session_id===s.id);
      return `<tr class="row-link" onclick="sessionDetail('${s.id}')">
        <td><b>${fmtDS(s.at)} ${fmtT(s.at)}</b></td>
        <td><div class="t-name">${esc(c.name)}</div><div class="t-sub">${fmtPhone(c.phone)}</div></td>
        <td class="t-sub">${esc(pkgById(co.package_id).name)}</td>
        <td class="t-center"><b>${s.no}</b>/${co.total_sessions}</td>
        <td class="t-sub" style="max-width:220px">${esc(s.services.slice(0,2).join(', '))}${s.services.length>2?'…':''}</td>
        <td class="t-sub">${esc(userName(s.doctor_id))}</td><td class="t-sub">${s.tech_id?esc(userName(s.tech_id)):'—'}</td>
        <td>${mv.map(v=>{const m=metricById(v.metric_id);return `<span class="badge nodot" style="background:${m.color}18;color:${m.color}">${v.value}</span>`}).join(' ')||'<span class="t-sub">—</span>'}</td>
        <td><span class="badge ${SESS_ST[s.status].color}">${SESS_ST[s.status].label}</span></td>
        <td><button class="btn sm" onclick="event.stopPropagation();sessionDetail('${s.id}')">Ghi nhận</button></td></tr>`}).join('')
      ||'<tr><td colspan="10"><div class="empty"><div class="t">Không có buổi điều trị</div></div></td></tr>'}</tbody></table></div></div>`;
}

/* ================= OP / CSKH ================= */
function viewOP(){
  const tasks=DB.careTasks;
  const byReason={}; tasks.forEach(t=>byReason[t.reason]=(byReason[t.reason]||0)+1);
  return head('Chăm sóc khách hàng (OP)','Khách đang trong liệu trình cần theo dõi · '+fmtD(TODAY),
    `${can('data.export')?`<button class="btn" onclick="exportCare(DB.careTasks)">${ic('download',16)} Xuất</button>`:''}`)
  + `<div class="grid g5" style="margin-bottom:14px">
      ${stat('Cần chăm sóc hôm nay',tasks.length,'','heart','dn')}
      ${Object.entries(CARE_REASON).map(([k,v])=>stat(v.label,byReason[k]||0,'','•',byReason[k]?'dn':'flat')).slice(0,4).join('')}
    </div>
    <div class="card"><div class="card-h"><h3>Danh sách cần chăm sóc</h3><span class="sub">${tasks.length} khách</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>Khách hàng</th><th>Liệu trình</th><th>Tiến độ</th><th>Buổi gần nhất</th><th>Lịch tiếp theo</th><th>Lý do cần chăm sóc</th><th>OP phụ trách</th><th style="width:230px">Thao tác</th></tr></thead>
    <tbody>${tasks.map(t=>{const co=courseById(t.course_id), c=custById(t.customer_id);
      return `<tr>
        <td class="row-link" onclick="location.hash='#/customers/${c.id}'"><div class="t-name">${esc(c.name)}</div><div class="t-sub">${fmtPhone(c.phone)} · ${c.code}</div></td>
        <td><div style="font-size:13px">${esc(pkgById(co.package_id).name)}</div><div class="t-code">${co.code}</div></td>
        <td><div style="font-size:12.5px">${co.done_sessions}/${co.total_sessions} buổi</div><div class="mini-bar"><i style="width:${co.done_sessions/co.total_sessions*100}%"></i></div></td>
        <td class="t-sub">${t.last?fmtD(t.last)+' ('+daysBetween(t.last,TODAY)+' ngày trước)':'—'}</td>
        <td>${t.next?`<span class="badge ${t.next<d(0,0,0)?'b-red':'b-blue'}">${fmtDT(t.next)}</span>`:'<span class="badge b-red">Chưa đặt lịch</span>'}</td>
        <td><span class="badge ${CARE_REASON[t.reason].color}">${CARE_REASON[t.reason].label}</span></td>
        <td class="t-sub">${esc(userName(t.op))}</td>
        <td><div style="display:flex;gap:4px">
          <button class="btn sm primary" onclick="callModal('${c.id}')">${ic('phone',15)} Gọi</button>
          <button class="btn sm" onclick="openBooking('${c.id}')">${ic('calendar',16)} Đặt buổi</button>
          <button class="btn sm" onclick="openNote('${c.id}')">${ic('edit',16)}</button></div></td></tr>`}).join('')
      ||'<tr><td colspan="8"><div class="empty"><div class="ic-box">'+ic('checkCircle',16)+'</div><div class="t">Không có khách nào cần chăm sóc hôm nay</div></div></td></tr>'}</tbody></table></div></div>`;
}

/* ================= PAYMENTS ================= */
function viewPayments(){
  const f=S.filters.py=S.filters.py||{q:'',method:''};
  let list=DB.payments.slice();
  if(f.method) list=list.filter(p=>p.method===f.method);
  if(f.q){const q=f.q.toLowerCase(); list=list.filter(p=>custById(p.customer_id).name.toLowerCase().includes(q)||p.ref.toLowerCase().includes(q)||normPhone(custById(p.customer_id).phone).includes(normPhone(f.q)));}
  window._payList=list;
  const today=DB.payments.filter(p=>sameDay(p.at,TODAY)).reduce((a,b)=>a+b.amount,0);
  const month=DB.payments.filter(p=>new Date(p.at).getMonth()===TODAY.getMonth()).reduce((a,b)=>a+b.amount,0);
  const debt=DB.courses.filter(c=>c.status!=='pending').reduce((a,b)=>a+Math.max(0,b.total-b.paid),0);
  return head('Thanh toán','Mọi giao dịch đều bất biến — sai sót được xử lý bằng bút toán điều chỉnh có kiểm toán',
    `${can('data.export')?`<button class="btn" onclick="exportPayments(window._payList||[])">${ic('download',16)} Xuất Excel</button>`:''}
     <button class="btn primary" onclick="openPayment()">${ic('plus',16)} Tạo phiếu thu</button>`)
  + `<div class="grid g4" style="margin-bottom:14px">
      ${stat('Thu hôm nay',money(today)+'đ',DB.payments.filter(p=>sameDay(p.at,TODAY)).length+' giao dịch','banknote','up')}
      ${stat('Thu tháng này',moneyS(month)+'đ','','lineChart','up')}
      ${stat('Công nợ',moneyS(debt)+'đ',DB.courses.filter(c=>c.status!=='pending'&&c.paid<c.total).length+' liệu trình','alert','dn')}
      ${stat('Bút toán điều chỉnh',DB.payments.filter(p=>p.type==='reversal').length,'Có audit trail','undo','flat')}
    </div>
    <div class="card"><div class="toolbar">
      <input class="inp" style="min-width:250px" placeholder="Tìm khách hàng / mã giao dịch…" value="${esc(f.q)}" oninput="S.filters.py.q=this.value;clearTimeout(window._t);window._t=setTimeout(render,300)">
      <select class="inp" onchange="S.filters.py.method=this.value;render()"><option value="">Mọi hình thức</option>${PAY_METHODS.map(m=>`<option value="${m.code}" ${f.method===m.code?'selected':''}>${m.label}</option>`).join('')}</select>
      <div style="margin-left:auto;font-size:12.5px;color:var(--muted)">${list.length} giao dịch</div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Thời gian</th><th>Mã GD</th><th>Khách hàng</th><th>Liệu trình</th><th class="t-right">Số tiền</th><th>Hình thức</th><th>Người thu</th><th>Ghi chú</th><th></th></tr></thead>
    <tbody>${list.slice(0,40).map(p=>{const c=custById(p.customer_id);
      return `<tr><td>${fmtDT(p.at)}</td><td class="t-code">${p.ref}</td>
        <td class="row-link" onclick="location.hash='#/customers/${c.id}'"><div class="t-name">${esc(c.name)}</div><div class="t-sub">${fmtPhone(c.phone)}</div></td>
        <td class="t-code">${(courseById(p.course_id)||{code:'—'}).code}</td>
        <td class="t-right" style="font-weight:700;color:${p.amount<0?'var(--danger)':'var(--ok)'}">${p.amount<0?'':'+'}${money(p.amount)}đ</td>
        <td>${(PAY_METHODS.find(m=>m.code===p.method)||{}).label}</td><td class="t-sub">${esc(userName(p.by))}</td>
        <td class="t-sub" style="max-width:280px">${esc(p.note)}${p.type==='reversal'?' <span class="badge b-red nodot">Điều chỉnh</span>':''}</td>
        <td><div class="row-actions"><button class="btn sm" onclick="openReceipt('${p.id}')">${ic('file',14)} Phiếu thu</button>
          ${p.type!=='reversal'?`<button class="btn sm" onclick="openReversal('${p.id}')">${ic('undo',14)} Điều chỉnh</button>`:''}</div></td></tr>`}).join('')}</tbody></table></div></div>`;
}
function openPayment(coid){
  const courses=DB.courses.filter(c=>c.status!=='pending'&&c.paid<c.total);
  const co=coid?courseById(coid):courses[0];
  modal(`<div class="modal"><div class="modal-h"><h3>Tạo phiếu thu</h3><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <label class="fld"><span class="lb">Liệu trình <span class="req">*</span></span><select class="inp" id="pm-co" onchange="pmInfo()">
      ${courses.map(x=>`<option value="${x.id}" ${co&&x.id===co.id?'selected':''}>${custById(x.customer_id).name} — ${x.code} (còn ${money(x.total-x.paid)}đ)</option>`).join('')}</select></label>
    <div id="pm-info"></div>
    <div class="grid g2">
      <label class="fld"><span class="lb">Số tiền thu <span class="req">*</span></span><input class="inp" type="number" id="pm-amt" step="100000" value="${co?Math.max(0,co.total-co.paid):0}"></label>
      <label class="fld"><span class="lb">Hình thức <span class="req">*</span></span><select class="inp" id="pm-m">${PAY_METHODS.map(m=>`<option value="${m.code}">${m.label}</option>`).join('')}</select></label>
    </div>
    <label class="fld"><span class="lb">Mã giao dịch / số phiếu</span><input class="inp" value="GD${71000+DB.payments.length}"></label>
    <label class="fld"><span class="lb">Ghi chú</span><input class="inp" id="pm-note" placeholder="VD: Thanh toán đợt 2"></label>
    <div class="alert al-warn">${ic('alert',16)} <div>Giao dịch sau khi lưu <b>không thể xóa</b>. Nếu sai, tạo bút toán điều chỉnh (reversal) có ghi lý do.</div></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="savePayment()">${ic('banknote',16)} Xác nhận thu tiền</button></div></div>`);
  pmInfo();
}
function pmInfo(){
  const co=courseById($('#pm-co').value); if(!co) return;
  $('#pm-info').innerHTML=`<div class="alert al-info" style="display:block"><div class="kv" style="grid-template-columns:110px 1fr">
    <div class="k">Khách hàng</div><div class="v">${esc(custById(co.customer_id).name)}</div>
    <div class="k">Gói</div><div class="v">${esc(pkgById(co.package_id).name)}</div>
    <div class="k">Phải thanh toán</div><div class="v">${money(co.total)}đ</div>
    <div class="k">Đã thanh toán</div><div class="v">${money(co.paid)}đ</div>
    <div class="k">Còn lại</div><div class="v" style="color:var(--danger)">${money(co.total-co.paid)}đ</div></div></div>`;
}
function savePayment(){
  const co=courseById($('#pm-co').value); const amt=+$('#pm-amt').value;
  if(!amt||amt<=0) return toast('Số tiền phải lớn hơn 0','err');
  const p={id:'PY'+(DB.payments.length+1), course_id:co.id, customer_id:co.customer_id, at:new Date(), amount:amt,
    method:$('#pm-m').value, by:S.user.id, ref:'GD'+(71000+DB.payments.length), note:$('#pm-note').value||'Thanh toán', type:'payment'};
  DB.payments.unshift(p); co.paid+=amt;
  tl(co.customer_id,p.at,'banknote','green','Thanh toán '+money(amt)+'đ',p.note,(PAY_METHODS.find(m=>m.code===p.method)||{}).label+' · Thu: '+S.user.name);
  DB.timeline.sort((a,b)=>b.at-a.at);
  au(p.at,S.user.id,'payment','payments',p.id,'—','+'+money(amt)+'đ'); DB.audit.sort((a,b)=>b.at-a.at);
  closeModal(); toast('Đã ghi nhận thanh toán '+money(amt)+'đ','ok'); render();
}
function openReversal(pid){
  const p=DB.payments.find(x=>x.id===pid);
  modal(`<div class="modal" style="max-width:460px"><div class="modal-h"><h3>Bút toán điều chỉnh</h3><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b"><div class="alert al-warn">${ic('alert',16)} <div>Giao dịch gốc <b>${p.ref}</b> (${money(p.amount)}đ) sẽ được giữ nguyên. Hệ thống tạo bút toán ngược có ghi lý do và lưu vào nhật ký kiểm toán.</div></div>
  <label class="fld"><span class="lb">Số tiền điều chỉnh</span><input class="inp" type="number" id="rv-amt" value="${p.amount}"></label>
  <label class="fld"><span class="lb">Lý do <span class="req">*</span></span><textarea class="inp" id="rv-note" placeholder="VD: Thu nhầm số tiền / khách hủy gói / nhập sai hình thức"></textarea></label></div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn danger" onclick="saveReversal('${pid}')">Tạo bút toán điều chỉnh</button></div></div>`);
}
function saveReversal(pid){
  const p=DB.payments.find(x=>x.id===pid); const note=$('#rv-note').value.trim();
  if(!note) return toast('Vui lòng nhập lý do điều chỉnh','err');
  const amt=-Math.abs(+$('#rv-amt').value);
  const r={id:'PY'+(DB.payments.length+1), course_id:p.course_id, customer_id:p.customer_id, at:new Date(), amount:amt,
    method:p.method, by:S.user.id, ref:'GD'+(71000+DB.payments.length), note:'Điều chỉnh phiếu '+p.ref+': '+note, type:'reversal'};
  DB.payments.unshift(r); const co=courseById(p.course_id); if(co) co.paid+=amt;
  au(r.at,S.user.id,'reversal','payments',r.id,money(p.amount)+'đ',money(amt)+'đ ('+note+')'); DB.audit.sort((a,b)=>b.at-a.at);
  closeModal(); toast('Đã tạo bút toán điều chỉnh','ok'); render();
}

/* ================= REPORTS ================= */
function viewReports(kind){
  const tabs=[['overview','Tổng quan'],['telesales','Hiệu quả Telesales'],['marketing','Hiệu quả Marketing'],['revenue','Doanh thu']];
  const ALL=S.range==='all';
  const R_pay=DB.payments.filter(p=>ALL||inRange(p.at));
  const R_cus=DB.customers.filter(c=>ALL||inRange(c.created_at));
  const R_call=DB.calls.filter(c=>ALL||inRange(c.at));
  const revOf=cos=>R_pay.filter(p=>cos.some(co=>co.id===p.course_id)).reduce((a,b)=>a+b.amount,0);
  let body='';
  if(kind==='telesales'){
    const rows=TELESALES.map(u=>{
      const leads=R_cus.filter(c=>c.assigned_to===u.id);
      const calls=R_call.filter(c=>c.user_id===u.id);
      const booked=leads.filter(c=>['APPOINTMENT_BOOKED','ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','PACKAGE_PENDING','NO_SHOW'].includes(c.status));
      const arrived=leads.filter(c=>['ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','PACKAGE_PENDING'].includes(c.status));
      const pkgs=DB.courses.filter(co=>co.status!=='pending'&&leads.some(l=>l.id===co.customer_id));
      const rev=revOf(pkgs);
      return {u,leads:leads.length,calls:calls.length,booked:booked.length,arrived:arrived.length,pkg:pkgs.length,rev};
    }).sort((a,b)=>b.pkg-a.pkg);
    const rate=(a,b)=>b?Math.round(a/b*100):0;
    const cls=v=>v>=40?'hi':v>=20?'md':'lo';
    body=`<div class="card"><div class="card-h"><h3>Bảng hiệu quả Telesales</h3><span class="sub">${RANGES[S.range]} · sắp xếp theo số gói chốt</span>
      <div class="r">${can('data.export')?`<button class="btn sm" onclick="exportReport('telesales')">${ic('download',15)} Xuất</button>`:''}</div></div>
      <div class="tbl-wrap"><table><thead><tr><th>Nhân viên</th><th class="t-center">Lead</th><th class="t-center">Cuộc gọi</th><th class="t-center">Đặt lịch</th><th class="t-center">Đến khám</th><th class="t-center">Chốt gói</th>
      <th class="t-center">Lead${ic('arrowRight',15)}Lịch</th><th class="t-center">Lịch'+ic('arrowRight',15)+'Đến</th><th class="t-center">Đến${ic('arrowRight',15)}Gói</th><th class="t-right">Doanh thu</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td><div style="display:flex;align-items:center;gap:8px"><div class="avatar">${initials(r.u.name)}</div>
        <div><div class="t-name">${esc(r.u.name)}</div><div class="t-sub">${esc(r.u.email)}</div></div></div></td>
        <td class="t-center">${r.leads}</td><td class="t-center">${r.calls}</td><td class="t-center">${r.booked}</td>
        <td class="t-center">${r.arrived}</td><td class="t-center"><b>${r.pkg}</b></td>
        <td class="t-center"><span class="rate ${cls(rate(r.booked,r.leads))}">${rate(r.booked,r.leads)}%</span></td>
        <td class="t-center"><span class="rate ${cls(rate(r.arrived,r.booked))}">${rate(r.arrived,r.booked)}%</span></td>
        <td class="t-center"><span class="rate ${cls(rate(r.pkg,r.arrived))}">${rate(r.pkg,r.arrived)}%</span></td>
        <td class="t-right"><b>${money(r.rev)}đ</b></td></tr>`).join('')}
        <tr style="background:#FAFCFD;font-weight:700"><td>TỔNG</td><td class="t-center">${rows.reduce((a,b)=>a+b.leads,0)}</td>
        <td class="t-center">${rows.reduce((a,b)=>a+b.calls,0)}</td><td class="t-center">${rows.reduce((a,b)=>a+b.booked,0)}</td>
        <td class="t-center">${rows.reduce((a,b)=>a+b.arrived,0)}</td><td class="t-center">${rows.reduce((a,b)=>a+b.pkg,0)}</td>
        <td colspan="3"></td><td class="t-right">${money(rows.reduce((a,b)=>a+b.rev,0))}đ</td></tr></tbody></table></div></div>
      <div class="card" style="margin-top:14px"><div class="card-h"><h3>So sánh số gói chốt</h3></div>
        <div class="card-b">${barChart(rows.map(r=>({l:r.u.name.split(' ').slice(-1)[0],v:r.rev})),{h:230})}</div></div>`;
  }
  else if(kind==='marketing'){
    const rows=DB.campaigns.map(cp=>{
      const leads=R_cus.filter(c=>c.campaign===cp.id);
      const booked=leads.filter(c=>['APPOINTMENT_BOOKED','ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','PACKAGE_PENDING','NO_SHOW'].includes(c.status));
      const arrived=leads.filter(c=>['ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','PACKAGE_PENDING'].includes(c.status));
      const pkgs=DB.courses.filter(co=>co.status!=='pending'&&leads.some(l=>l.id===co.customer_id));
      const rev=revOf(pkgs);
      return {cp,leads:leads.length,booked:booked.length,arrived:arrived.length,pkg:pkgs.length,rev,
        cpl:leads.length?Math.round(cp.spend/leads.length):0, roas:cp.spend?(rev/cp.spend):0};
    }).sort((a,b)=>b.rev-a.rev);
    window._mkRows=rows;
    body=`<div class="alert al-info">${ic('info',16)} <div>Doanh thu được tính từ <b>giao dịch thực thu</b>, không tính theo giá gói khi khách chưa thanh toán — để biết chính xác quảng cáo nào sinh ra tiền thật.</div></div>
      <div class="card"><div class="card-h"><h3>Hiệu quả theo chiến dịch</h3><span class="sub">Nguồn ${ic('arrowRight',15)} Lead '+ic('arrowRight',15)+' Lịch '+ic('arrowRight',15)+' Đến '+ic('arrowRight',15)+' Gói ${ic('arrowRight',15)} Doanh thu</span>
      <div class="r">${can('data.export')?`<button class="btn sm" onclick="exportMarketing(window._mkRows||[])">${ic('download',16)} Xuất</button>`:''}</div></div>
      <div class="tbl-wrap"><table><thead><tr><th>Chiến dịch</th><th>Nguồn</th><th class="t-right">Chi phí</th><th class="t-center">Lead</th><th class="t-center">Lịch</th><th class="t-center">Đến</th><th class="t-center">Gói</th><th class="t-right">CPL</th><th class="t-right">Doanh thu</th><th class="t-center">ROAS</th></tr></thead>
      <tbody>${rows.map(r=>`<tr class="row-link" onclick="drillCampaign('${r.cp.id}')">
        <td><div class="t-name">${esc(r.cp.name)}</div><div class="t-sub">${esc(r.cp.adset)} · ${esc(r.cp.ad)}</div></td>
        <td><span class="badge ${srcColor(r.cp.source)}">${srcName(r.cp.source)}</span></td>
        <td class="t-right">${r.cp.spend?money(r.cp.spend)+'đ':'—'}</td>
        <td class="t-center"><b>${r.leads}</b></td><td class="t-center">${r.booked}</td><td class="t-center">${r.arrived}</td><td class="t-center"><b>${r.pkg}</b></td>
        <td class="t-right">${r.cpl?money(r.cpl)+'đ':'—'}</td>
        <td class="t-right"><b style="color:var(--ok)">${money(r.rev)}đ</b></td>
        <td class="t-center">${r.roas?`<span class="rate ${r.roas>=2?'hi':r.roas>=1?'md':'lo'}">${r.roas.toFixed(2)}x</span>`:'—'}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><div class="card-h"><h3>Doanh thu theo chiến dịch</h3></div><div class="card-b">${barChart(rows.map(r=>({l:r.cp.name.split(' - ')[0].replace('FB','FB').slice(0,10),v:r.rev})),{h:230})}</div></div>
        <div class="card"><div class="card-h"><h3>Chi phí trên mỗi lead (CPL)</h3></div><div class="card-b">${barChart(rows.filter(r=>r.cpl).map(r=>({l:r.cp.name.split(' - ')[0].slice(0,10),v:r.cpl,color:'#7C3AED'})),{h:230})}</div></div>
      </div>`;
  }
  else if(kind==='revenue'){
    const nDays = S.range==='today'?1 : S.range==='7d'?7 : S.range==='month'?TODAY.getDate() : 30;
    const rev=[]; for(let i=nDays-1;i>=0;i--){ const day=d(-i,0,0); rev.push({l:fmtDS(day), v:DB.payments.filter(p=>sameDay(p.at,day)&&p.amount>0).reduce((a,b)=>a+b.amount,0)}); }
    const byPkg={}, bySrc={}, byDoc={};
    R_pay.forEach(p=>{ const co=courseById(p.course_id); if(!co) return;
      const k1=pkgById(co.package_id).name, k2=srcName(custById(p.customer_id).source), k3=userName(co.doctor_id);
      byPkg[k1]=(byPkg[k1]||0)+p.amount; bySrc[k2]=(bySrc[k2]||0)+p.amount; byDoc[k3]=(byDoc[k3]||0)+p.amount; });
    const tot=R_pay.filter(p=>p.amount>0).reduce((a,b)=>a+b.amount,0);
    const tbl=(title,obj,kind)=>`<div class="card"><div class="card-h"><h3>${title}</h3><span class="sub">Bấm để xem giao dịch</span></div><div class="tbl-wrap"><table style="min-width:auto">
      <thead><tr><th>Hạng mục</th><th class="t-right">Doanh thu</th><th class="t-center">Tỷ trọng</th></tr></thead>
      <tbody>${Object.entries(obj).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr class="row-link" onclick="drillRevenue('${kind}',${JSON.stringify(k)})">
        <td>${esc(k)}</td><td class="t-right"><b>${money(v)}đ</b></td>
        <td class="t-center"><div style="display:flex;align-items:center;gap:8px"><div class="mini-bar" style="flex:1"><i style="width:${v/tot*100}%"></i></div><span class="t-sub">${Math.round(v/tot*100)}%</span></div></td></tr>`).join('')}</tbody></table></div></div>`;
    body=`<div class="grid g4" style="margin-bottom:14px">
      ${stat('Hôm nay',money(DB.payments.filter(p=>sameDay(p.at,TODAY)).reduce((a,b)=>a+b.amount,0))+'đ','','banknote','up')}
      ${stat('Tháng này',moneyS(DB.payments.filter(p=>new Date(p.at).getMonth()===TODAY.getMonth()&&p.amount>0).reduce((a,b)=>a+b.amount,0))+'đ','','calendar','up')}
      ${stat('Thực thu ('+RANGES[S.range].toLowerCase()+')',moneyS(tot)+'đ',R_pay.filter(p=>p.amount>0).length+' giao dịch','clipboard','flat')}
      ${stat('Giá trị TB/gói',moneyS(tot/Math.max(1,DB.courses.filter(c=>c.status!=='pending').length))+'đ','','package','flat')}</div>
      <div class="card" style="margin-bottom:14px"><div class="card-h"><h3>Doanh thu ${nDays} ngày</h3><span class="sub">Theo giao dịch thực thu</span></div><div class="card-b">${barChart(rev,{h:260})}</div></div>
      <div class="grid g3">${tbl('Theo gói dịch vụ',byPkg,'pkg')}${tbl('Theo nguồn khách',bySrc,'src')}${tbl('Theo bác sĩ',byDoc,'doc')}</div>`;
  }
  else {
    body=`<div class="alert al-info">${ic('info',16)}<div>Chọn tab bên trên để xem báo cáo chi tiết. Mọi số liệu đều lấy từ giao dịch và hoạt động thực tế trong hệ thống.</div></div>`+
      `<div class="grid g3">${[
        ['phone','Hiệu quả Telesales','Lead → gọi → lịch hẹn → đến khám → chốt gói, kèm tỷ lệ chuyển đổi của từng nhân viên','#/reports/telesales'],
        ['target','Hiệu quả Marketing','Chi phí, CPL, ROAS theo từng chiến dịch quảng cáo','#/reports/marketing'],
        ['banknote','Doanh thu','Theo ngày, gói dịch vụ, nguồn khách, chiến dịch, telesales, bác sĩ','#/reports/revenue'],
      ].map(([icn,t,d2,l])=>`
        <div class="card" role="button" tabindex="0" style="cursor:pointer" onclick="location.hash='${l}'" onkeydown="if(event.key==='Enter'){location.hash='${l}'}"><div class="card-b">
          <div class="ic-box" style="width:42px;height:42px;border-radius:12px;background:var(--brand-50);color:var(--brand);display:grid;place-items:center">${ic(icn,21)}</div>
          <div style="font-weight:700;font-size:15px;margin-top:10px">${t}</div>
          <div class="t-sub" style="margin-top:4px">${d2}</div>
          <div class="btn sm primary" style="margin-top:12px;display:inline-flex">Mở báo cáo ${ic('arrowRight',14)}</div>
        </div></div>`).join('')}</div>`;
  }
  return head('Báo cáo','Số liệu lấy từ giao dịch &amp; hoạt động thực tế · khoảng thời gian: <b>'+RANGES[S.range]+'</b>',
    `${rangeSelect()}${can('data.export')?`<button class="btn" onclick="exportReport('${kind}')">${ic('download',16)} Xuất Excel</button>`:''}`)
  + `<div class="card" style="margin-bottom:14px"><div class="tabs">${tabs.map(([k,l])=>`<div class="tab ${kind===k?'on':''}" onclick="location.hash='#/reports${k==='overview'?'':'/'+k}'">${l}</div>`).join('')}</div></div>`+body;
}

/* ================= ADMIN ================= */
function viewAdminUsers(){
  return head('Người dùng &amp; phân quyền','Một tài khoản có thể mang nhiều vai trò. RBAC được kiểm tra ở tầng máy chủ và Row-Level Security, không chỉ ẩn menu.',
    `${can('data.export')?`<button class="btn" onclick="exportUsers()">${ic('download',16)} Xuất</button>`:''}
     <button class="btn" onclick="location.hash='#/admin/roles'">${ic('shield',16)} Vai trò &amp; quyền</button>
     <button class="btn" onclick="location.hash='#/admin/staff-import'">${ic('upload',16)} Import từ Excel</button>
     <button class="btn primary" onclick="openUserForm()">${ic('userPlus',16)} Thêm người dùng</button>`)
  + `<div class="grid g2" style="margin-bottom:14px">
      <div class="card"><div class="card-h"><h3>Ma trận vai trò</h3><span class="sub">${DB.roles.length} vai trò</span></div>
        <div class="tbl-wrap"><table><thead><tr><th>Vai trò</th><th>Mô tả quyền</th><th class="t-center">Số tài khoản</th></tr></thead>
        <tbody>${DB.roles.map(r=>`<tr><td><span class="badge ${r.color} nodot">${r.name}</span></td><td class="t-sub">${r.desc}</td>
          <td class="t-center">${DB.users.filter(u=>u.roles.includes(r.code)).length}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Quyền theo vai trò (trích)</h3></div><div class="card-b" style="max-height:290px;overflow-y:auto">
        ${Object.entries(PERMS).map(([r,ps])=>`<div style="margin-bottom:10px"><span class="badge ${roleColor(r)} nodot">${roleName(r)}</span>
          <div class="chips" style="margin-top:5px">${ps.map(p=>`<span class="badge b-gray nodot mono" style="font-size:10.5px">${p}</span>`).join('')}</div></div>`).join('')}</div></div>
    </div>
    <div class="card"><div class="card-h"><h3>Danh sách người dùng</h3><span class="sub">${DB.users.length} tài khoản</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Cơ sở</th><th>Chuyên môn</th><th>Trạng thái</th><th></th></tr></thead>
    <tbody>${DB.users.map(u=>`<tr><td><div style="display:flex;align-items:center;gap:9px"><div class="avatar">${initials(u.name)}</div>
      <div class="t-name">${esc(u.name)}</div></div></td>
      <td class="t-sub">${esc(u.email)}</td>
      <td><div class="chips">${u.roles.map(r=>`<span class="badge ${roleColor(r)} nodot">${roleName(r)}</span>`).join('')}</div></td>
      <td class="t-sub">${(DB.branches.find(b=>b.id===u.branch)||{name:''}).name}</td>
      <td class="t-sub">${esc(u.spec||'—')}</td>
      <td><span class="badge ${u.active?'b-green':'b-gray'}">${u.active?'Hoạt động':'Khóa'}</span></td>
      <td><div class="row-actions"><button class="btn sm" onclick="openUserForm('${u.id}')">Sửa</button>
        <button class="btn sm" onclick="toggleUserActive('${u.id}')">${u.active?'Khóa':'Mở khóa'}</button>
        <button class="btn sm" onclick="loginAs('${u.id}')">Đăng nhập thử</button></div></td></tr>`).join('')}</tbody></table></div></div>`;
}
function openUserForm(uid){
  const u=uid?userById(uid):{name:'',email:'',roles:[],branch:'B1',active:true};
  modal(`<div class="modal"><div class="modal-h"><h3>${uid?'Chỉnh sửa':'Thêm'} người dùng</h3><button class="x" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="grid g2">
      <label class="fld"><span class="lb">Họ tên <span class="req">*</span></span><input class="inp" id="uf-name" value="${esc(u.name)}"></label>
      <label class="fld"><span class="lb">Email <span class="req">*</span></span><input class="inp" id="uf-mail" value="${esc(u.email)}"></label>
    </div>
    <label class="fld"><span class="lb">Cơ sở</span><select class="inp">${DB.branches.map(b=>`<option value="${b.id}" ${u.branch===b.id?'selected':''}>${b.name}</option>`).join('')}</select></label>
    <div class="sec-t">Vai trò (có thể chọn nhiều)</div>
    ${DB.roles.map(r=>`<label style="display:flex;gap:10px;align-items:center;padding:9px 11px;border:1px solid var(--line);border-radius:10px;margin-bottom:5px;cursor:pointer">
      <input type="checkbox" class="uf-role" value="${r.code}" ${u.roles.includes(r.code)?'checked':''}>
      <span class="badge ${r.color} nodot">${r.name}</span><span class="t-sub" style="flex:1">${r.desc}</span></label>`).join('')}
    <div class="alert al-warn" style="margin-top:12px">${ic('alert',16)} <div>Mật khẩu được cấp qua email mời — hệ thống <b>không lưu mật khẩu dạng văn bản thuần</b>. Mọi thay đổi quyền đều ghi vào nhật ký kiểm toán.</div></div>
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn primary" onclick="saveUser('${uid||''}')">Lưu</button></div></div>`);
}
function saveUser(uid){
  const roles=[...document.querySelectorAll('.uf-role:checked')].map(x=>x.value);
  if(!roles.length) return toast('Chọn ít nhất một vai trò','err');
  if(uid){ const u=userById(uid); const before=JSON.stringify(u.roles); u.roles=roles; u.name=$('#uf-name').value; u.email=$('#uf-mail').value;
    au(new Date(),S.user.id,'permission_change','user_roles',uid,before,JSON.stringify(roles)); }
  else { const u={id:'U'+(DB.users.length+1), name:$('#uf-name').value, email:$('#uf-mail').value, roles, active:true, branch:'B1'};
    if(!u.name||!u.email) return toast('Nhập họ tên và email','err');
    DB.users.push(u); au(new Date(),S.user.id,'create','users',u.id,'—',u.name+' · '+roles.join(',')); }
  DB.audit.sort((a,b)=>b.at-a.at);
  closeModal(); toast('Đã lưu người dùng','ok'); render();
}
function viewAdminPackages(){
  return head('Gói / liệu trình điều trị','Cấu hình linh hoạt — không hard-code dịch vụ trong mã nguồn',
    `<button class="btn primary" onclick="openPkgForm()">＋ Thêm gói</button>`)
  + `<div class="grid g3">${DB.packages.map(p=>`<div class="card"><div class="card-h"><h3>${esc(p.name)}</h3>
      <span class="badge ${p.active?'b-green':'b-gray'}">${p.active?'Đang bán':'Ngừng'}</span></div>
      <div class="card-b">
        <div class="t-code" style="margin-bottom:8px">${p.code} · ${p.group}</div>
        <div class="kv"><div class="k">Số buổi</div><div class="v">${p.sessions} buổi</div>
          <div class="k">Thời lượng</div><div class="v">${p.duration} phút/buổi</div>
          <div class="k">Giá niêm yết</div><div class="v" style="font-size:15px;color:var(--brand-700)">${money(p.price)}đ</div>
          <div class="k">Đơn giá/buổi</div><div class="v">${money(Math.round(p.price/p.sessions))}đ</div></div>
        <div class="sec-t" style="margin-top:12px">Dịch vụ trong mỗi buổi</div>
        <div class="chips">${p.services.map(s=>`<span class="badge b-teal nodot">${esc(s)}</span>`).join('')}</div>
        <div class="t-sub" style="margin-top:10px">Đang áp dụng cho ${DB.courses.filter(c=>c.package_id===p.id).length} liệu trình</div>
        <button class="btn block" style="margin-top:10px" onclick="openPkgForm('${p.id}')">${ic('edit',16)} Chỉnh sửa</button>
      </div></div>`).join('')}</div>`;
}
function openPkgForm(pid){
  const p=pid?pkgById(pid):{name:'',code:'',group:'Phục hồi chức năng',sessions:10,duration:60,price:0,services:[],active:true};
  const groups=['Phục hồi chức năng','Trị liệu cơ xương khớp','Y học cổ truyền','Gói dùng thử','Khác'];
  modal(`<div class="modal"><div class="modal-h"><h3>${pid?'Chỉnh sửa':'Thêm'} gói điều trị</h3>
    <button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="grid g2">
      <label class="fld" for="pk-name"><span class="lb">Tên gói <span class="req">*</span></span><input class="inp" id="pk-name" value="${esc(p.name)}" placeholder="VD: PHCN Cột sống thắt lưng - 10 buổi"></label>
      <label class="fld" for="pk-code"><span class="lb">Mã gói <span class="req">*</span></span><input class="inp mono" id="pk-code" value="${esc(p.code)}" placeholder="PHCN-CS-10"></label>
    </div>
    <div class="grid g3">
      <label class="fld" for="pk-group"><span class="lb">Nhóm dịch vụ</span>
        <select class="inp" id="pk-group">${groups.map(g=>`<option ${g===p.group?'selected':''}>${g}</option>`).join('')}</select></label>
      <label class="fld" for="pk-n"><span class="lb">Số buổi</span><input class="inp" id="pk-n" type="number" min="1" value="${p.sessions}" oninput="pkCalc()"></label>
      <label class="fld" for="pk-dur"><span class="lb">Phút/buổi</span><input class="inp" id="pk-dur" type="number" min="15" step="15" value="${p.duration}"></label>
    </div>
    <label class="fld" for="pk-price"><span class="lb">Giá niêm yết (đ)</span>
      <input class="inp" id="pk-price" type="number" step="100000" value="${p.price}" oninput="pkCalc()">
      <div class="hint" id="pk-calc">Đơn giá mỗi buổi: ${p.sessions?money(Math.round(p.price/p.sessions)):0}đ</div></label>
    <label class="fld" for="pk-svc"><span class="lb">Dịch vụ trong mỗi buổi <span class="req">*</span></span>
      <textarea class="inp" id="pk-svc" rows="5" placeholder="Mỗi dòng một dịch vụ">${p.services.join('\n')}</textarea>
      <div class="hint">VD: Điện xung giảm đau · Siêu âm trị liệu · Kéo giãn cột sống · Sóng xung kích · Laser công suất cao · Tập vận động trị liệu</div></label>
    <label style="display:flex;gap:9px;align-items:center;font-size:13.5px"><input type="checkbox" id="pk-active" ${p.active!==false?'checked':''}> Đang mở bán</label>
    ${pid?`<div class="alert al-info" style="margin-top:12px">${ic('info',16)}<div>Gói này đang áp dụng cho <b>${DB.courses.filter(c=>c.package_id===pid).length} liệu trình</b>.
      Thay đổi giá <b>không ảnh hưởng</b> tới các liệu trình đã kích hoạt.</div></div>`:''}
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" onclick="savePkg('${pid||''}')">Lưu gói</button></div></div>`);
}
function pkCalc(){
  const n=+$('#pk-n').value||1, pr=+$('#pk-price').value||0;
  $('#pk-calc').textContent='Đơn giá mỗi buổi: '+money(Math.round(pr/n))+'đ';
}
function viewAdminMetrics(){
  return head('Chỉ số lượng giá lâm sàng','Bác sĩ/Admin tự định nghĩa chỉ số theo dõi — hệ thống chỉ tính toán và vẽ biểu đồ từ dữ liệu nhập, không tự đưa ra chẩn đoán',
    `<button class="btn primary" onclick="openMetricForm()">＋ Thêm chỉ số</button>`)
  + `<div class="card"><div class="tbl-wrap"><table><thead><tr><th>Tên chỉ số</th><th>Mã</th><th>Đơn vị</th><th class="t-center">Min</th><th class="t-center">Max</th><th>Chiều cải thiện</th><th>Mô tả</th><th class="t-center">Đang dùng</th><th>Trạng thái</th><th></th></tr></thead>
    <tbody>${DB.metrics.map(m=>`<tr>
      <td><div style="display:flex;align-items:center;gap:8px"><span style="width:11px;height:11px;border-radius:3px;background:${m.color}"></span><b>${esc(m.name)}</b></div></td>
      <td class="t-code">${m.code}</td><td>${m.unit}</td><td class="t-center">${m.min}</td><td class="t-center">${m.max}</td>
      <td><span class="badge ${m.higher_is_better?'b-green':'b-blue'}">${m.higher_is_better?ic('trendUp',14)+' Tăng = cải thiện':ic('trendDown',14)+' Giảm = cải thiện'}</span></td>
      <td class="t-sub" style="max-width:280px">${esc(m.desc)}</td>
      <td class="t-center">${DB.courses.filter(c=>c.metrics.includes(m.id)).length} LT</td>
      <td><span class="badge ${m.active?'b-green':'b-gray'}">${m.active?'Hoạt động':'Ẩn'}</span></td>
      <td><div class="row-actions"><button class="btn sm" onclick="openMetricForm('${m.id}')">Sửa</button></div></td></tr>`).join('')}</tbody></table></div></div>
    <div class="alert al-info" style="margin-top:14px">${ic('info',16)} <div>Khi <b>higher_is_better = false</b> (VD: Mức độ đau), biểu đồ và ô "% cải thiện" hiểu <b>giá trị giảm là tiến triển tốt</b>. Ngược lại với các chỉ số như Tầm vận động hay Sức cơ.</div></div>`;
}
function openMetricForm(mid){
  const m=mid?metricById(mid):{name:'',code:'',unit:'điểm',min:0,max:10,higher_is_better:false,desc:'',color:'#0167B8',active:true};
  modal(`<div class="modal"><div class="modal-h"><h3>${mid?'Chỉnh sửa':'Thêm'} chỉ số lượng giá</h3>
    <button class="x" aria-label="Đóng" onclick="closeModal()">${ic('x',16)}</button></div>
  <div class="modal-b">
    <div class="grid g2">
      <label class="fld" for="mt-name"><span class="lb">Tên chỉ số <span class="req">*</span></span><input class="inp" id="mt-name" value="${esc(m.name)}" placeholder="VD: Mức độ đau (VAS)"></label>
      <label class="fld" for="mt-code"><span class="lb">Mã <span class="req">*</span></span><input class="inp mono" id="mt-code" value="${esc(m.code)}" placeholder="PAIN_VAS"></label>
    </div>
    <div class="grid g3">
      <label class="fld" for="mt-unit"><span class="lb">Đơn vị</span><input class="inp" id="mt-unit" value="${esc(m.unit)}"></label>
      <label class="fld" for="mt-min"><span class="lb">Giá trị nhỏ nhất</span><input class="inp" id="mt-min" type="number" value="${m.min}"></label>
      <label class="fld" for="mt-max"><span class="lb">Giá trị lớn nhất</span><input class="inp" id="mt-max" type="number" value="${m.max}"></label>
    </div>
    <label class="fld" for="mt-dir"><span class="lb">Chiều cải thiện <span class="req">*</span></span>
      <select class="inp" id="mt-dir">
        <option value="down" ${!m.higher_is_better?'selected':''}>Giá trị GIẢM là cải thiện (đau, tê, ODI…)</option>
        <option value="up" ${m.higher_is_better?'selected':''}>Giá trị TĂNG là cải thiện (tầm vận động, sức cơ…)</option></select>
      <div class="hint">Quyết định cách biểu đồ tính “% cải thiện” và hướng mũi tên.</div></label>
    <label class="fld" for="mt-color"><span class="lb">Màu trên biểu đồ</span>
      <input class="inp" id="mt-color" type="color" value="${m.color}" style="height:42px;padding:4px"></label>
    <label class="fld" for="mt-desc"><span class="lb">Mô tả / hướng dẫn nhập</span><textarea class="inp" id="mt-desc" rows="2">${esc(m.desc)}</textarea></label>
    <label style="display:flex;gap:9px;align-items:center;font-size:13.5px"><input type="checkbox" id="mt-active" ${m.active!==false?'checked':''}> Cho phép chọn khi kích hoạt liệu trình</label>
    ${mid?`<div class="alert al-warn" style="margin-top:12px">${ic('alert',16)}<div>Chỉ số đang dùng ở <b>${DB.courses.filter(c=>c.metrics.includes(mid)).length} liệu trình</b>
      với <b>${DB.metricValues.filter(v=>v.metric_id===mid).length} lần đo</b>. Đổi thang đo có thể làm biểu đồ cũ hiển thị sai — cân nhắc tạo chỉ số mới.</div></div>`:''}
  </div>
  <div class="modal-f"><button class="btn" onclick="closeModal()">Hủy</button>
    <button class="btn primary" onclick="saveMetric('${mid||''}')">Lưu chỉ số</button></div></div>`);
}
function viewAudit(){
  const f=S.filters.au=S.filters.au||{action:'',entity:''};
  let list=DB.audit.slice();
  if(f.action) list=list.filter(a=>a.action===f.action);
  if(f.entity) list=list.filter(a=>a.entity===f.entity);
  window._auList=list;
  const actions=[...new Set(DB.audit.map(a=>a.action))], entities=[...new Set(DB.audit.map(a=>a.entity))];
  const AC={create:'b-green',update:'b-blue',delete:'b-red',status_change:'b-purple',payment:'b-teal',reversal:'b-red',
    activate:'b-green',finalize:'b-teal',amend:'b-amber',permission_change:'b-red',import:'b-purple',assign:'b-blue'};
  return head('Nhật ký hệ thống (Audit log)','Mọi thay đổi quan trọng đều được ghi lại: ai – làm gì – trên bản ghi nào – trước/sau – khi nào',
    `${can('data.export')?`<button class="btn" onclick="exportAudit(window._auList||[])">${ic('download',16)} Xuất</button>`:''}`)
  + `<div class="card"><div class="toolbar">
      <select class="inp" onchange="S.filters.au.action=this.value;render()"><option value="">Mọi hành động</option>${actions.map(a=>`<option ${f.action===a?'selected':''}>${a}</option>`).join('')}</select>
      <select class="inp" onchange="S.filters.au.entity=this.value;render()"><option value="">Mọi bảng dữ liệu</option>${entities.map(a=>`<option ${f.entity===a?'selected':''}>${a}</option>`).join('')}</select>
      <div style="margin-left:auto;font-size:12.5px;color:var(--muted)">${list.length} bản ghi</div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Bảng</th><th>Bản ghi</th><th>Trước</th><th>Sau</th><th>IP</th></tr></thead>
    <tbody>${list.map(a=>`<tr><td>${fmtDT(a.at)}</td>
      <td><div style="display:flex;align-items:center;gap:7px"><div class="avatar" style="width:22px;height:22px;font-size:9px">${initials(userName(a.user))}</div>
        <span class="t-sub">${esc(userName(a.user))}</span></div></td>
      <td><span class="badge ${AC[a.action]||'b-gray'} nodot">${a.action}</span></td>
      <td class="t-code">${a.entity}</td><td class="t-code">${a.entity_id}</td>
      <td class="t-sub mono" style="max-width:200px;font-size:11.5px">${esc(a.before)}</td>
      <td class="t-sub mono" style="max-width:240px;font-size:11.5px">${esc(a.after)}</td>
      <td class="t-sub mono">${a.ip}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ================= BOOT (được gọi ở cuối flows.js) ================= */
function bootApp(){
  initTheme();
  renderDemoUsers();
  renderLoginArt();
  const P=new URLSearchParams(location.search);
  if(P.get('theme')) applyTheme(P.get('theme')==='dark'?'dark':'light');
  if(P.get('imp')) S.imp.step=Math.max(1,Math.min(6,+P.get('imp')));
  if(P.get('simp')&&S.simp) S.simp.step=Math.max(1,Math.min(6,+P.get('simp')));
  const M=P.get('m'); if(M) setTimeout(()=>{ try{
    if(M==='call') callModal(DB.customers.find(c=>c.assigned_to).id);
    if(M==='book') openBooking(DB.customers[0].id);
    if(M==='pay') openPayment();
    if(M==='cust') openCustomerForm();
  }catch(e){} },250);
  const q=P.get('as');
  if(q){ const u=DB.users.find(x=>x.id===q||x.roles.includes(q)||x.email.split('@')[0]===q); if(u){ loginAs(u.id); return; } }
  if(location.hash) history.replaceState(null,'','#');
}
