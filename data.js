/* ============ MOCK DATA (dữ liệu giả lập – KHÔNG dùng dữ liệu bệnh nhân thật) ============ */
const DB = {};

/* deterministic pseudo-random */
let _s = 20260829;
function rnd(){ _s = (_s*1664525 + 1013904223) % 4294967296; return _s/4294967296; }
function ri(a,b){ return a + Math.floor(rnd()*(b-a+1)); }
function pick(arr){ return arr[Math.floor(rnd()*arr.length)]; }
function pickw(arr,w){ const t=w.reduce((a,b)=>a+b,0); let r=rnd()*t; for(let i=0;i<arr.length;i++){ r-=w[i]; if(r<=0) return arr[i]; } return arr[arr.length-1]; }

const HO = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Phan','Vũ','Đặng','Bùi','Đỗ','Hồ','Ngô','Dương','Lý','Đinh','Mai','Trịnh','Cao'];
const DEM_M = ['Văn','Hữu','Đức','Minh','Quang','Thanh','Tuấn','Anh','Bá','Xuân','Công','Đình'];
const DEM_F = ['Thị','Ngọc','Thu','Kim','Hoài','Bích','Thanh','Minh','Diệu','Hà'];
const TEN_M = ['An','Bình','Cường','Dũng','Đạt','Hải','Hùng','Khoa','Long','Nam','Phong','Quân','Sơn','Tài','Thắng','Trung','Tú','Vinh','Bảo','Kiên'];
const TEN_F = ['Anh','Chi','Dung','Hà','Hằng','Hoa','Huyền','Lan','Linh','Mai','Nga','Nhung','Oanh','Phương','Quỳnh','Thảo','Trang','Vân','Yến','Ngân'];
const DUONG = ['Nguyễn Trãi','Lê Lợi','Trần Hưng Đạo','Hoàng Văn Thụ','Cầu Giấy','Xuân Thủy','Lạc Long Quân','Kim Mã','Giải Phóng','Nguyễn Chí Thanh','Trường Chinh','Tôn Đức Thắng'];
const QUAN = ['Q. Cầu Giấy','Q. Đống Đa','Q. Ba Đình','Q. Thanh Xuân','Q. Hai Bà Trưng','Q. Hoàng Mai','Q. Nam Từ Liêm','H. Hoài Đức'];
const NGHE = ['Nhân viên văn phòng','Lái xe','Giáo viên','Kinh doanh tự do','Công nhân','Nội trợ','Nghỉ hưu','Kỹ sư','Y tá','Bảo vệ'];

const BENH_LY = ['Thoát vị đĩa đệm L4-L5','Thoái hóa cột sống cổ','Đau vai gáy','Viêm quanh khớp vai','Đau thần kinh tọa','Thoái hóa khớp gối','Viêm gân gót chân','Hội chứng ống cổ tay','Đau thắt lưng mạn tính','Cứng khớp sau chấn thương','Vẹo cột sống','Liệt VII ngoại biên','Phục hồi sau mổ dây chằng chéo','Đau cổ tay do máy tính','Gai gót chân'];
const NHU_CAU = ['Khám chuyên khoa cột sống','Khám chuyên khoa khớp gối','Khám chuyên khoa khớp háng','Khám chuyên khoa khớp vai',
  'Khám hội chứng cổ vai gáy','Khám bệnh lý bàn tay - bàn chân','Khám hội chứng ống cổ tay','Phục hồi chức năng sau phẫu thuật',
  'Nắn chỉnh cong vẹo cột sống','Vật lý trị liệu','Châm cứu - bấm huyệt','Khám lại'];
DB.specialties = NHU_CAU.slice(0,10);
function needForDx(dx){
  const t=(dx||'').toLowerCase();
  if(t.includes('ống cổ tay')) return 'Khám hội chứng ống cổ tay';
  if(t.includes('vai gáy')||t.includes('cột sống cổ')) return 'Khám hội chứng cổ vai gáy';
  if(t.includes('khớp vai')||t.includes('quanh khớp vai')) return 'Khám chuyên khoa khớp vai';
  if(t.includes('gối')||t.includes('dây chằng')) return 'Khám chuyên khoa khớp gối';
  if(t.includes('háng')) return 'Khám chuyên khoa khớp háng';
  if(t.includes('cột sống')||t.includes('thắt lưng')||t.includes('đĩa đệm')||t.includes('tọa')) return 'Khám chuyên khoa cột sống';
  if(t.includes('bàn tay')||t.includes('bàn chân')||t.includes('gót')) return 'Khám bệnh lý bàn tay - bàn chân';
  if(t.includes('vẹo')) return 'Nắn chỉnh cong vẹo cột sống';
  if(t.includes('sau mổ')||t.includes('phẫu thuật')) return 'Phục hồi chức năng sau phẫu thuật';
  if(t.includes('liệt')) return 'Châm cứu - bấm huyệt';
  return 'Vật lý trị liệu';
}

const SOURCES = [
  {code:'facebook', name:'Facebook', color:'b-blue'},
  {code:'google', name:'Google', color:'b-red'},
  {code:'tiktok', name:'TikTok', color:'b-purple'},
  {code:'zalo', name:'Zalo', color:'b-teal'},
  {code:'hotline', name:'Hotline', color:'b-amber'},
  {code:'referral', name:'Khách giới thiệu', color:'b-pink'},
  {code:'website', name:'Website', color:'b-gray'},
  {code:'walkin', name:'Walk-in', color:'b-green'},
  {code:'other', name:'Khác', color:'b-gray'},
];
const srcName = c => (SOURCES.find(s=>s.code===c)||{name:c}).name;
const srcColor = c => (SOURCES.find(s=>s.code===c)||{color:'b-gray'}).color;

DB.campaigns = [
  {id:'CP01', name:'FB - Thoát vị đĩa đệm T8', source:'facebook', adset:'HN 35-55 Đau lưng', ad:'Video BN chia sẻ', spend:42500000, utm_source:'facebook', utm_campaign:'tvdd_t8'},
  {id:'CP02', name:'FB - Đau vai gáy văn phòng', source:'facebook', adset:'HN 25-40 Dân VP', ad:'Carousel 5 bài tập', spend:28000000, utm_source:'facebook', utm_campaign:'vaigay_t8'},
  {id:'CP03', name:'Google Search - PHCN', source:'google', adset:'Từ khóa PHCN', ad:'Text ad #3', spend:33000000, utm_source:'google', utm_campaign:'phcn_search'},
  {id:'CP04', name:'TikTok - Bài tập cột sống', source:'tiktok', adset:'HN 22-45', ad:'Video 30s BS Vũ', spend:19500000, utm_source:'tiktok', utm_campaign:'cotsong_reels'},
  {id:'CP05', name:'Zalo OA - Chăm sóc cũ', source:'zalo', adset:'Data KH cũ', ad:'Broadcast T8', spend:6500000, utm_source:'zalo', utm_campaign:'zoa_t8'},
  {id:'CP06', name:'Hotline / Tự đến', source:'hotline', adset:'-', ad:'-', spend:0, utm_source:'', utm_campaign:''},
];

DB.clinic = {
  name:'Phòng khám Cơ xương khớp & Phục hồi chức năng Vitalife',
  company:'Công ty Cổ phần Thương mại và Dịch vụ Y tế Vitalife',
  slogan:'Sáng y đức - vững niềm tin',
  motto:'Phục vụ bằng cả trái tim',
  address:'Số 16 P. Thượng Đình, Phường Khương Đình, Hà Nội',
  hotline:'0936.278.589', email:'vitalifevn026@gmail.com',
  hours:'7:00 - 12:00 | 13:00 - 20:00 (T2 - CN)',
  tax:'0111216156', web:'phongkhamvitalife.vn',
};
DB.branches = [
  {id:'B1',name:'Vitalife Thượng Đình',addr:'Số 16 P. Thượng Đình, Phường Khương Đình, Hà Nội',hours:'7:00-12:00 | 13:00-20:00'},
  {id:'B2',name:'Vitalife cơ sở 2 (demo)',addr:'Dữ liệu giả lập phục vụ demo đa cơ sở',hours:'7:00-12:00 | 13:00-20:00'} ];
DB.rooms = [
  {id:'R1',name:'Phòng khám 1',branch:'B1',type:'exam'},{id:'R2',name:'Phòng khám 2',branch:'B1',type:'exam'},
  {id:'R3',name:'Phòng trị liệu A',branch:'B1',type:'therapy'},{id:'R4',name:'Phòng trị liệu B',branch:'B1',type:'therapy'},
  {id:'R5',name:'Phòng tập PHCN',branch:'B1',type:'gym'},{id:'R6',name:'Phòng khám 1 - CS2',branch:'B2',type:'exam'},
];

DB.roles = [
  {code:'admin', name:'Admin', color:'b-red', desc:'Toàn quyền hệ thống'},
  {code:'marketing', name:'Ads / Marketing', color:'b-purple', desc:'Lead, import, hiệu quả campaign'},
  {code:'telesales', name:'Telesales', color:'b-blue', desc:'Lead được giao, gọi, đặt lịch'},
  {code:'op', name:'OP / CSKH', color:'b-pink', desc:'Chăm sóc khách đang điều trị'},
  {code:'reception', name:'Lễ tân', color:'b-amber', desc:'Lịch, check-in/out, thu ngân'},
  {code:'doctor', name:'Bác sĩ', color:'b-teal', desc:'Khám, bệnh án, chỉ định liệu trình'},
  {code:'manager', name:'Trưởng phòng', color:'b-green', desc:'Duyệt & kích hoạt liệu trình'},
  {code:'tech', name:'Kỹ thuật viên', color:'b-gray', desc:'Thực hiện buổi điều trị'},
];
const roleName = c => (DB.roles.find(r=>r.code===c)||{name:c}).name;
const roleColor = c => (DB.roles.find(r=>r.code===c)||{color:'b-gray'}).color;

DB.users = [
  {id:'U01', name:'Trần Quốc Bảo', email:'admin@vitalife.vn', roles:['admin'], active:true, branch:'B1'},
  {id:'U02', name:'Phạm Thu Hà', email:'ha.marketing@vitalife.vn', roles:['marketing'], active:true, branch:'B1'},
  {id:'U03', name:'Nguyễn Thị Lan', email:'lan.ts@vitalife.vn', roles:['telesales'], active:true, branch:'B1'},
  {id:'U04', name:'Lê Minh Tuấn', email:'tuan.ts@vitalife.vn', roles:['telesales'], active:true, branch:'B1'},
  {id:'U05', name:'Vũ Ngọc Mai', email:'mai.ts@vitalife.vn', roles:['telesales'], active:true, branch:'B1'},
  {id:'U06', name:'Đỗ Hồng Nhung', email:'nhung.ts@vitalife.vn', roles:['telesales'], active:true, branch:'B2'},
  {id:'U07', name:'Bùi Văn Khoa', email:'khoa.ts@vitalife.vn', roles:['telesales','op'], active:true, branch:'B1'},
  {id:'U08', name:'Trịnh Thu Trang', email:'trang.lt@vitalife.vn', roles:['reception'], active:true, branch:'B1'},
  {id:'U09', name:'Mai Kim Chi', email:'chi.lt@vitalife.vn', roles:['reception'], active:true, branch:'B2'},
  {id:'U10', name:'BS. Phùng Quang Vũ', email:'bs.vu@vitalife.vn', roles:['doctor'], active:true, branch:'B1', spec:'Y học cổ truyền · Cơ xương khớp'},
  {id:'U11', name:'BS. Nguyễn Thanh Sơn', email:'bs.son@vitalife.vn', roles:['doctor'], active:true, branch:'B1', spec:'PHCN - Vật lý trị liệu'},
  {id:'U12', name:'BS. Lê Diệu Linh', email:'bs.linh@vitalife.vn', roles:['doctor'], active:true, branch:'B2', spec:'Phục hồi chức năng'},
  {id:'U13', name:'KTV. Hoàng Văn Nam', email:'ktv.nam@vitalife.vn', roles:['tech'], active:true, branch:'B1'},
  {id:'U14', name:'KTV. Đặng Thị Yến', email:'ktv.yen@vitalife.vn', roles:['tech'], active:true, branch:'B1'},
  {id:'U15', name:'KTV. Phan Bá Long', email:'ktv.long@vitalife.vn', roles:['tech'], active:true, branch:'B2'},
  {id:'U16', name:'Ngô Thị Phương', email:'phuong.op@vitalife.vn', roles:['op'], active:true, branch:'B1'},
  {id:'U17', name:'Dương Quốc Đạt', email:'dat.op@vitalife.vn', roles:['op'], active:true, branch:'B1'},
  {id:'U18', name:'Hồ Thị Bích Ngân', email:'ngan.tp@vitalife.vn', roles:['manager'], active:true, branch:'B1'},
];
const userName = id => (DB.users.find(u=>u.id===id)||{name:'—'}).name;
const userById = id => DB.users.find(u=>u.id===id);
const TELESALES = DB.users.filter(u=>u.roles.includes('telesales'));
const DOCTORS = DB.users.filter(u=>u.roles.includes('doctor'));
const TECHS = DB.users.filter(u=>u.roles.includes('tech'));
const OPS = DB.users.filter(u=>u.roles.includes('op'));

/* ---------- STATUS MACHINE ---------- */
DB.statuses = {
  NEW_LEAD:{label:'Lead mới',color:'b-gray',stage:'lead'},
  ASSIGNED:{label:'Đã phân bổ',color:'b-gray',stage:'lead'},
  CONTACTING:{label:'Đang liên hệ',color:'b-blue',stage:'lead'},
  CALLBACK:{label:'Hẹn gọi lại',color:'b-amber',stage:'lead'},
  NO_ANSWER:{label:'Không nghe máy',color:'b-amber',stage:'lead'},
  INTERESTED:{label:'Quan tâm',color:'b-teal',stage:'lead'},
  APPOINTMENT_BOOKED:{label:'Đã đặt lịch',color:'b-purple',stage:'appt'},
  NO_SHOW:{label:'Không đến',color:'b-red',stage:'appt'},
  ARRIVED:{label:'Đã đến',color:'b-green',stage:'clinic'},
  CHECKED_IN:{label:'Đã check-in',color:'b-green',stage:'clinic'},
  WAITING_DOCTOR:{label:'Chờ bác sĩ',color:'b-amber',stage:'clinic'},
  IN_EXAMINATION:{label:'Đang khám',color:'b-blue',stage:'clinic'},
  TREATMENT_PROPOSED:{label:'Đã đề xuất LT',color:'b-purple',stage:'clinic'},
  PACKAGE_PENDING:{label:'Chờ kích hoạt gói',color:'b-amber',stage:'treat'},
  PACKAGE_ACTIVE:{label:'Gói đã kích hoạt',color:'b-green',stage:'treat'},
  IN_TREATMENT:{label:'Đang điều trị',color:'b-teal',stage:'treat'},
  TREATMENT_COMPLETED:{label:'Hoàn thành LT',color:'b-green',stage:'done'},
  NOT_INTERESTED:{label:'Không quan tâm',color:'b-red',stage:'lost'},
  CANCELLED:{label:'Đã hủy',color:'b-red',stage:'lost'},
};
DB.transitions = {
  NEW_LEAD:['ASSIGNED','CONTACTING','NOT_INTERESTED'],
  ASSIGNED:['CONTACTING','NO_ANSWER','NOT_INTERESTED'],
  CONTACTING:['CALLBACK','NO_ANSWER','INTERESTED','APPOINTMENT_BOOKED','NOT_INTERESTED'],
  CALLBACK:['CONTACTING','INTERESTED','APPOINTMENT_BOOKED','NO_ANSWER','NOT_INTERESTED'],
  NO_ANSWER:['CONTACTING','CALLBACK','NOT_INTERESTED'],
  INTERESTED:['APPOINTMENT_BOOKED','CALLBACK','NOT_INTERESTED'],
  APPOINTMENT_BOOKED:['ARRIVED','NO_SHOW','CANCELLED'],
  NO_SHOW:['CONTACTING','APPOINTMENT_BOOKED','NOT_INTERESTED'],
  ARRIVED:['CHECKED_IN','CANCELLED'],
  CHECKED_IN:['WAITING_DOCTOR'],
  WAITING_DOCTOR:['IN_EXAMINATION'],
  IN_EXAMINATION:['TREATMENT_PROPOSED','TREATMENT_COMPLETED'],
  TREATMENT_PROPOSED:['PACKAGE_PENDING','NOT_INTERESTED'],
  PACKAGE_PENDING:['PACKAGE_ACTIVE','CANCELLED'],
  PACKAGE_ACTIVE:['IN_TREATMENT','CANCELLED'],
  IN_TREATMENT:['TREATMENT_COMPLETED','CANCELLED'],
  TREATMENT_COMPLETED:['APPOINTMENT_BOOKED'],
  NOT_INTERESTED:['CONTACTING'], CANCELLED:['CONTACTING'],
};
const stLabel = s => (DB.statuses[s]||{label:s}).label;
const stColor = s => (DB.statuses[s]||{color:'b-gray'}).color;

/* ---------- CLINICAL METRICS ---------- */
DB.metrics = [
  {id:'M1', code:'PAIN_VAS', name:'Mức độ đau (VAS)', unit:'điểm', min:0, max:10, higher_is_better:false, desc:'Thang điểm đau 0-10, 0 = không đau', color:'#EF4444', active:true},
  {id:'M2', code:'ROM_FLEX', name:'Tầm vận động (gập)', unit:'độ', min:0, max:180, higher_is_better:true, desc:'Đo bằng thước đo góc', color:'#0E9F8E', active:true},
  {id:'M3', code:'FUNC_ODI', name:'Chỉ số chức năng ODI', unit:'%', min:0, max:100, higher_is_better:false, desc:'Oswestry Disability Index - càng thấp càng tốt', color:'#7C3AED', active:true},
  {id:'M4', code:'MMT', name:'Sức cơ (MMT)', unit:'bậc', min:0, max:5, higher_is_better:true, desc:'Manual Muscle Testing 0-5', color:'#2563EB', active:true},
  {id:'M5', code:'NUMB', name:'Mức độ tê bì', unit:'điểm', min:0, max:10, higher_is_better:false, desc:'Tự đánh giá 0-10', color:'#D97706', active:true},
  {id:'M6', code:'MOBILITY', name:'Khả năng vận động', unit:'điểm', min:0, max:100, higher_is_better:true, desc:'Điểm lượng giá chức năng vận động tổng hợp', color:'#16A34A', active:true},
  {id:'M7', code:'SLEEP', name:'Chất lượng giấc ngủ', unit:'điểm', min:0, max:10, higher_is_better:true, desc:'Tự đánh giá 0-10', color:'#DB2777', active:false},
];
const metricById = id => DB.metrics.find(m=>m.id===id);

/* ---------- PACKAGE TEMPLATES ---------- */
DB.packages = [
  {id:'PKG01', code:'PHCN-CS-10', name:'PHCN Cột sống thắt lưng - 10 buổi', group:'Phục hồi chức năng', sessions:10, duration:60, price:12000000,
   services:['Điện xung giảm đau','Siêu âm trị liệu','Kéo giãn cột sống','Tập vận động trị liệu có KTV','Xoa bóp trị liệu'], active:true},
  {id:'PKG02', code:'PHCN-CS-15', name:'PHCN Cột sống thắt lưng - 15 buổi', group:'Phục hồi chức năng', sessions:15, duration:60, price:16500000,
   services:['Điện xung giảm đau','Siêu âm trị liệu','Kéo giãn cột sống','Tập vận động trị liệu có KTV','Laser công suất cao'], active:true},
  {id:'PKG03', code:'VAI-GAY-8', name:'Trị liệu Vai gáy - 8 buổi', group:'Trị liệu cơ xương khớp', sessions:8, duration:45, price:8800000,
   services:['Sóng xung kích','Điện xung','Di động mô mềm','Bài tập kéo giãn cổ vai'], active:true},
  {id:'PKG04', code:'KHOP-GOI-12', name:'Điều trị Thoái hóa khớp gối - 12 buổi', group:'Trị liệu cơ xương khớp', sessions:12, duration:60, price:14400000,
   services:['Sóng xung kích','Laser công suất cao','Tập mạnh cơ tứ đầu đùi','Chườm parafin'], active:true},
  {id:'PKG05', code:'CHAM-CUU-10', name:'Châm cứu - Bấm huyệt 10 buổi', group:'Y học cổ truyền', sessions:10, duration:45, price:7000000,
   services:['Châm cứu','Cứu ngải','Bấm huyệt','Giác hơi'], active:true},
  {id:'PKG06', code:'HAU-PHAU-20', name:'PHCN sau phẫu thuật - 20 buổi', group:'Phục hồi chức năng', sessions:20, duration:75, price:26000000,
   services:['Tập PHCN 1-1','Điện xung','Siêu âm trị liệu','Tập với dụng cụ','Lượng giá định kỳ'], active:true},
  {id:'PKG07', code:'TRIAL-3', name:'Gói trải nghiệm 3 buổi', group:'Gói dùng thử', sessions:3, duration:45, price:1500000,
   services:['Điện xung','Siêu âm trị liệu','Xoa bóp trị liệu'], active:true},
];
const pkgById = id => DB.packages.find(p=>p.id===id);

/* ---------- DATE HELPERS ---------- */
const TODAY = new Date(2026,7,29); // 29/08/2026
function d(off,h,m){ const x=new Date(TODAY); x.setDate(x.getDate()+off); x.setHours(h||0,m||0,0,0); return x; }
function fmtD(x){ if(!x) return '—'; x=new Date(x); return String(x.getDate()).padStart(2,'0')+'/'+String(x.getMonth()+1).padStart(2,'0')+'/'+x.getFullYear(); }
function fmtDS(x){ if(!x) return '—'; x=new Date(x); return String(x.getDate()).padStart(2,'0')+'/'+String(x.getMonth()+1).padStart(2,'0'); }
function fmtT(x){ if(!x) return '—'; x=new Date(x); return String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0'); }
function fmtDT(x){ if(!x) return '—'; return fmtD(x)+' '+fmtT(x); }
function sameDay(a,b){ a=new Date(a);b=new Date(b); return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }
function money(n){ if(n===null||n===undefined) return '—'; return new Intl.NumberFormat('vi-VN').format(Math.round(n)); }
function moneyS(n){ const s=n<0?'-':''; n=Math.abs(n||0);
  if(n>=1e9) return s+(n/1e9).toFixed(2).replace(/\.?0+$/,'')+' tỷ';
  if(n>=1e6) return s+(n/1e6).toFixed(1).replace(/\.0$/,'')+' tr';
  return s+money(n); }
function age(dob){ return TODAY.getFullYear()-new Date(dob).getFullYear(); }

/* ---------- PHONE NORMALIZE ---------- */
function normPhone(p){
  if(!p) return '';
  let s = String(p).replace(/[^\d+]/g,'');
  if(s.startsWith('+84')) s='0'+s.slice(3);
  else if(s.startsWith('84') && s.length>=10) s='0'+s.slice(2);
  if(!s.startsWith('0') && s.length===9) s='0'+s;
  return s;
}
function fmtPhone(p){ p=normPhone(p); return p.length===10 ? p.slice(0,4)+' '+p.slice(4,7)+' '+p.slice(7) : p; }

/* ---------- GENERATE CUSTOMERS ---------- */
DB.customers = [];
const usedPhones = new Set();
function genPhone(){
  let p;
  do { p = pick(['090','091','093','094','096','097','098','032','033','035','038','039','070','076','078','081','082','086','088'])+String(ri(1000000,9999999)); } while(usedPhones.has(p));
  usedPhones.add(p); return p;
}
function genName(gender){
  const ho=pick(HO);
  return gender==='M' ? ho+' '+pick(DEM_M)+' '+pick(TEN_M) : ho+' '+pick(DEM_F)+' '+pick(TEN_F);
}
const LEAD_STATES = ['NEW_LEAD','ASSIGNED','CONTACTING','CALLBACK','NO_ANSWER','INTERESTED','APPOINTMENT_BOOKED','NO_SHOW','ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED','NOT_INTERESTED'];
const LEAD_W     = [ 10,          8,          12,           10,         11,          9,           8,                   4,        6,        14,           4,                    8];

for(let i=1;i<=118;i++){
  const gender = rnd()>0.45 ? 'F':'M';
  const cp = pickw(DB.campaigns, [26,20,18,12,8,16]);
  const created = d(-ri(0,55), ri(8,20), ri(0,59));
  const st = pickw(LEAD_STATES, LEAD_W);
  const assigned = st==='NEW_LEAD' ? null : pick(TELESALES).id;
  const c = {
    id:'C'+String(i).padStart(4,'0'),
    code:'KH-'+String(100+i).padStart(6,'0'),
    name: genName(gender),
    gender,
    dob: new Date(TODAY.getFullYear()-ri(24,74), ri(0,11), ri(1,28)),
    phone: genPhone(),
    phone2: rnd()>0.85 ? genPhone() : '',
    email: rnd()>0.7 ? 'kh'+i+'@example.com' : '',
    address: 'Số '+ri(1,220)+' '+pick(DUONG)+', '+pick(QUAN)+', Hà Nội',
    job: pick(NGHE),
    contact_person: rnd()>0.8 ? genName(rnd()>.5?'M':'F')+' (con)' : '',
    source: cp.source,
    campaign: cp.id,
    need: '', concern: pick(BENH_LY),
    note: '',
    status: st,
    lifecycle: ['ARRIVED','IN_TREATMENT','TREATMENT_COMPLETED'].includes(st) ? 'patient' : (['APPOINTMENT_BOOKED','INTERESTED','NO_SHOW'].includes(st)?'customer':'lead'),
    assigned_to: assigned,
    created_at: created,
    last_call: null, next_call: null, call_count: 0,
    interest: 0,
  };
  c.need = needForDx(c.concern);
  DB.customers.push(c);
}

/* ---------- CALL LOGS ---------- */
const CALL_RESULTS = [
  {code:'no_answer', label:'Không nghe máy', color:'b-amber', next:'NO_ANSWER'},
  {code:'busy', label:'Máy bận', color:'b-amber', next:'NO_ANSWER'},
  {code:'wrong', label:'Sai số', color:'b-red', next:'NOT_INTERESTED'},
  {code:'callback', label:'Gọi lại sau', color:'b-blue', next:'CALLBACK'},
  {code:'considering', label:'Đang cân nhắc', color:'b-blue', next:'CONTACTING'},
  {code:'interested', label:'Quan tâm', color:'b-teal', next:'INTERESTED'},
  {code:'booked', label:'Đặt lịch khám', color:'b-purple', next:'APPOINTMENT_BOOKED'},
  {code:'refuse', label:'Không quan tâm', color:'b-red', next:'NOT_INTERESTED'},
  {code:'other', label:'Khác', color:'b-gray', next:null},
];
const crLabel = c => (CALL_RESULTS.find(r=>r.code===c)||{label:c}).label;
const crColor = c => (CALL_RESULTS.find(r=>r.code===c)||{color:'b-gray'}).color;

DB.calls = [];
let callId=1;
DB.customers.forEach(c=>{
  if(!c.assigned_to) return;
  const n = c.status==='NEW_LEAD'?0 : ri(1,4);
  let t = new Date(c.created_at);
  for(let i=0;i<n;i++){
    t = new Date(t.getTime() + ri(4,72)*3600000);
    if(t>d(0,23,59)) break;
    const last = i===n-1;
    let res;
    if(last){
      const m = {NO_ANSWER:'no_answer',CALLBACK:'callback',INTERESTED:'interested',APPOINTMENT_BOOKED:'booked',NOT_INTERESTED:'refuse',CONTACTING:'considering'};
      res = m[c.status] || pick(['considering','interested','callback','no_answer']);
    } else res = pick(['no_answer','busy','callback','considering']);
    DB.calls.push({
      id:'CL'+String(callId++).padStart(4,'0'), customer_id:c.id, user_id:c.assigned_to, at:new Date(t),
      result:res, duration: ['no_answer','busy','wrong'].includes(res)?ri(0,18):ri(45,420),
      note: pick(['Khách đang bận, hẹn gọi lại buổi tối','Khách hỏi giá liệu trình và thời gian điều trị','Khách ở xa, cân nhắc lịch cuối tuần','Đã tư vấn về gói PHCN, khách sẽ trao đổi với gia đình','Khách quan tâm, xin địa chỉ phòng khám','Chưa nghe máy, thử lại sau','Khách đã đi khám nơi khác, đang cân nhắc chuyển']),
      need: c.need, concern: c.concern, interest: ri(1,5),
      next_call: res==='callback' ? new Date(t.getTime()+ri(6,72)*3600000) : null,
    });
    c.last_call = new Date(t); c.call_count++;
    if(res==='callback') c.next_call = new Date(t.getTime()+ri(6,72)*3600000);
  }
  if(['CALLBACK'].includes(c.status) && !c.next_call) c.next_call = d(ri(-2,3), ri(9,18), pick([0,30]));
  c.interest = c.call_count? ri(1,5):0;
});

/* ---------- APPOINTMENTS ---------- */
const APPT_ST = {
  booked:{label:'Đã đặt',color:'b-blue',cls:'ap-blue'},
  confirmed:{label:'Đã xác nhận',color:'b-purple',cls:'ap-purple'},
  arrived:{label:'Đã đến',color:'b-teal',cls:'ap-teal'},
  waiting:{label:'Đang chờ',color:'b-amber',cls:'ap-amber'},
  in_exam:{label:'Đang khám',color:'b-blue',cls:'ap-blue'},
  done:{label:'Hoàn thành',color:'b-green',cls:'ap-green'},
  no_show:{label:'Không đến',color:'b-red',cls:'ap-red'},
  cancelled:{label:'Hủy',color:'b-gray',cls:'ap-gray'},
};
const apLabel = s => (APPT_ST[s]||{label:s}).label;
const apColor = s => (APPT_ST[s]||{color:'b-gray'}).color;
const apCls   = s => (APPT_ST[s]||{cls:'ap-gray'}).cls;

DB.appointments = [];
let apId=1;
function addAppt(o){ const a=Object.assign({id:'AP'+String(apId++).padStart(4,'0'),branch:'B1',type:'Khám lần đầu',room:'R1',note:''},o); DB.appointments.push(a); return a; }

/* hôm nay: dày lịch cho lễ tân */
const todayPlan = [
  {h:8,m:0,st:'done'},{h:8,m:30,st:'done'},{h:9,m:0,st:'done'},{h:9,m:0,st:'done'},
  {h:9,m:30,st:'in_exam'},{h:9,m:30,st:'waiting'},{h:10,m:0,st:'waiting'},{h:10,m:0,st:'arrived'},
  {h:10,m:30,st:'confirmed'},{h:10,m:30,st:'booked'},{h:11,m:0,st:'confirmed'},{h:11,m:0,st:'no_show'},
  {h:14,m:0,st:'booked'},{h:14,m:30,st:'confirmed'},{h:15,m:0,st:'booked'},{h:15,m:0,st:'booked'},
  {h:15,m:30,st:'confirmed'},{h:16,m:0,st:'booked'},{h:16,m:30,st:'booked'},{h:17,m:0,st:'booked'},
];
const pool = DB.customers.filter(c=>['APPOINTMENT_BOOKED','ARRIVED','IN_TREATMENT','NO_SHOW','TREATMENT_COMPLETED'].includes(c.status));
todayPlan.forEach((p,i)=>{
  const c = pool[i % pool.length];
  const at = d(0,p.h,p.m);
  const isTreat = rnd()>0.55;
  addAppt({
    customer_id:c.id, at, status:p.st, doctor: pick(DOCTORS).id, room: isTreat?pick(['R3','R4','R5']):pick(['R1','R2']),
    type: isTreat?'Buổi điều trị':(rnd()>.5?'Khám lần đầu':'Tái khám'),
    booked_by: c.assigned_to || pick(TELESALES).id,
    checkin_at: ['arrived','waiting','in_exam','done'].includes(p.st)? new Date(at.getTime()-ri(2,14)*60000):null,
    exam_start: ['in_exam','done'].includes(p.st)? new Date(at.getTime()+ri(3,20)*60000):null,
    exam_end: p.st==='done'? new Date(at.getTime()+ri(25,50)*60000):null,
    checkout_at: p.st==='done'? new Date(at.getTime()+ri(50,70)*60000):null,
  });
});
/* các ngày khác */
for(let off=-6; off<=10; off++){
  if(off===0) continue;
  const n = off<0? ri(6,14) : ri(4,11);
  for(let i=0;i<n;i++){
    const c = pick(pool);
    const at = d(off, ri(8,17), pick([0,30]));
    const st = off<0 ? pickw(['done','no_show','cancelled'],[85,10,5]) : pickw(['booked','confirmed'],[55,45]);
    const isTreat = rnd()>0.5;
    addAppt({customer_id:c.id, at, status:st, doctor:pick(DOCTORS).id, room:isTreat?pick(['R3','R4','R5']):pick(['R1','R2']),
      type:isTreat?'Buổi điều trị':(rnd()>.6?'Khám lần đầu':'Tái khám'), booked_by:c.assigned_to||pick(TELESALES).id,
      checkin_at: st==='done'? new Date(at.getTime()-ri(2,12)*60000):null,
      exam_end: st==='done'? new Date(at.getTime()+ri(30,60)*60000):null});
  }
}
DB.appointments.sort((a,b)=>a.at-b.at);

/* ---------- MEDICAL ENCOUNTERS ---------- */
DB.encounters = [];
let enId=1;
const treatingPool = DB.customers.filter(c=>['IN_TREATMENT','TREATMENT_COMPLETED'].includes(c.status));
const PKG_DX = {
  PKG01:['Thoát vị đĩa đệm L4-L5','Đau thắt lưng mạn tính','Đau thần kinh tọa','Thoái hóa cột sống thắt lưng'],
  PKG02:['Thoát vị đĩa đệm L4-L5','Đau thần kinh tọa','Thoái hóa cột sống thắt lưng'],
  PKG03:['Thoái hóa cột sống cổ','Đau vai gáy','Viêm quanh khớp vai'],
  PKG04:['Thoái hóa khớp gối','Cứng khớp sau chấn thương'],
  PKG05:['Liệt VII ngoại biên','Đau vai gáy','Đau thắt lưng mạn tính'],
  PKG06:['Phục hồi sau mổ dây chằng chéo','Cứng khớp sau chấn thương'],
  PKG07:['Đau vai gáy','Đau thắt lưng mạn tính'],
};
const SYMPTOM_BY_SITE = {
  lumbar:'Tê lan xuống mặt sau đùi, đau tăng khi ngồi lâu trên 30 phút.',
  neck:'Hạn chế xoay cổ, đau lan lên vùng chẩm, mỏi khi làm việc máy tính.',
  shoulder_r:'Khó giơ tay quá đầu, đau khi nằm nghiêng bên phải.',
  knee_l:'Lục khục khi lên xuống cầu thang, cứng khớp buổi sáng khoảng 15 phút.',
};
const DX_SITE = {
  'Thoát vị đĩa đệm L4-L5':['vùng thắt lưng','lumbar','cạnh sống L4-L5','Lasègue (+) 45°','MRI cột sống thắt lưng: thoát vị đĩa đệm L4-L5 chèn ép rễ trái.'],
  'Đau thắt lưng mạn tính':['vùng thắt lưng','lumbar','cạnh sống L4-L5','Lasègue (-)','X-quang cột sống thắt lưng: thoái hóa, hẹp khe đĩa đệm L4-L5.'],
  'Đau thần kinh tọa':['vùng thắt lưng lan xuống chân','lumbar','cạnh sống L5-S1','Lasègue (+) 40°','MRI: chèn ép rễ L5 trái.'],
  'Thoái hóa cột sống thắt lưng':['vùng thắt lưng','lumbar','cạnh sống thắt lưng','Lasègue (-)','X-quang: gai xương thân đốt sống, hẹp khe khớp.'],
  'Thoái hóa cột sống cổ':['vùng cổ vai','neck','cơ thang trên hai bên','Spurling (+)','X-quang cột sống cổ: mất đường cong sinh lý, thoái hóa C5-C6.'],
  'Đau vai gáy':['vùng cổ vai','neck','cơ thang trên hai bên','Spurling (-)','Siêu âm phần mềm: chưa phát hiện tổn thương rách gân.'],
  'Viêm quanh khớp vai':['vai phải','shoulder_r','mỏm cùng vai','Neer (+)','Siêu âm phần mềm: viêm gân trên gai.'],
  'Thoái hóa khớp gối':['khớp gối','knee_l','khe khớp gối trong','Dấu bào gỗ (+)','X-quang khớp gối: hẹp khe khớp trong, gai xương bờ khớp.'],
  'Cứng khớp sau chấn thương':['khớp gối','knee_l','bao khớp','Hạn chế gấp gối 90°','X-quang: không thấy tổn thương xương mới.'],
  'Liệt VII ngoại biên':['nửa mặt phải','neck','cơ vùng mặt','Dấu Charles-Bell (+)','Khám lâm sàng thần kinh: liệt mặt ngoại biên độ III.'],
  'Phục hồi sau mổ dây chằng chéo':['khớp gối','knee_l','đường mổ nội soi','Lachman (-) sau mổ','MRI sau mổ: mảnh ghép đúng vị trí.'],
};
function mkEncounter(c, at, doctor, dxIn){
  const dx = dxIn || c.concern;
  const site = DX_SITE[dx] || ['vùng thắt lưng','lumbar','cạnh sống L4-L5','Lasègue (+) 45°','X-quang: thoái hóa cột sống.'];
  return {
    id:'EN'+String(enId++).padStart(4,'0'), customer_id:c.id, doctor_id:doctor, at,
    status:'final', version:1,
    reason: 'Đau '+site[0]+' kéo dài '+ri(2,18)+' '+pick(['tuần','tháng']),
    symptoms: 'Đau âm ỉ tại '+site[0]+', tăng khi vận động và về đêm. '+(SYMPTOM_BY_SITE[site[1]]||'Cứng khớp buổi sáng khoảng 20 phút.'),
    history: 'Khởi phát sau '+pick(['bê vác nặng','ngồi làm việc kéo dài','tai nạn sinh hoạt','tập gym sai tư thế'])+'. Đã dùng giảm đau NSAIDs, đỡ ít, tái phát.',
    past: pick(['Không có bệnh lý mạn tính đáng kể.','Tăng huyết áp đang điều trị ổn định.','Đái tháo đường type 2, kiểm soát tốt.','Viêm dạ dày HP (+) đã điều trị.']),
    clinical: 'Ấn đau '+site[2]+'. '+site[3]+'. Co cứng cơ cạnh vùng tổn thương (+).',
    assessment_scale: 'VAS '+ri(6,9)+'/10; ROM hạn chế ~'+ri(20,45)+'%; MMT bậc '+ri(3,4)+'/5.',
    paraclinical: site[4],
    diagnosis: dx,
    doctor_note: 'Bệnh nhân có chỉ định điều trị bảo tồn bằng vật lý trị liệu - PHCN. Tiên lượng đáp ứng tốt nếu tuân thủ liệu trình.',
    plan: 'Điều trị bảo tồn: giảm đau bằng vật lý trị liệu, kết hợp tập vận động trị liệu tăng dần. Theo dõi VAS và tầm vận động mỗi buổi.',
    advice: 'Tránh bê vác nặng, ngồi đúng tư thế, nghỉ giữa giờ 5 phút mỗi 45 phút làm việc. Tập bài tập tại nhà theo hướng dẫn KTV.',
    followup: fmtD(new Date(at.getTime()+ri(14,30)*86400000)),
    body_map: [{part:site[1],type:'pain',level:ri(6,9)}],
  };
}

/* ---------- TREATMENT COURSES + SESSIONS + METRICS ---------- */
DB.courses = []; DB.sessions = []; DB.metricValues = []; DB.payments = [];
let coId=1, seId=1, mvId=1, pyId=1;
const PAY_METHODS = [{code:'cash',label:'Tiền mặt'},{code:'transfer',label:'Chuyển khoản'},{code:'card',label:'Thẻ'},{code:'other',label:'Khác'}];
const SESS_ST = {
  pending:{label:'Chưa thực hiện',color:'b-gray'}, booked:{label:'Đã đặt lịch',color:'b-blue'},
  doing:{label:'Đang thực hiện',color:'b-amber'}, done:{label:'Hoàn thành',color:'b-green'},
  cancelled:{label:'Hủy',color:'b-red'}, skipped:{label:'Bỏ buổi',color:'b-red'},
};

const courseSpecs = [
  {pkg:'PKG01', done:8,  status:'active',    dstart:-22},
  {pkg:'PKG03', done:5,  status:'active',    dstart:-14},
  {pkg:'PKG04', done:11, status:'active',    dstart:-31},
  {pkg:'PKG02', done:15, status:'completed', dstart:-46},
  {pkg:'PKG05', done:6,  status:'active',    dstart:-16},
  {pkg:'PKG06', done:9,  status:'active',    dstart:-27},
  {pkg:'PKG01', done:10, status:'completed', dstart:-38},
  {pkg:'PKG04', done:3,  status:'active',    dstart:-8},
  {pkg:'PKG03', done:2,  status:'active',    dstart:-5},
  {pkg:'PKG07', done:3,  status:'completed', dstart:-11},
  {pkg:'PKG02', done:0,  status:'pending',   dstart:-1},
  {pkg:'PKG01', done:0,  status:'pending',   dstart:0},
  {pkg:'PKG04', done:0,  status:'pending',   dstart:0},
];

courseSpecs.forEach((spec,idx)=>{
  const c = treatingPool[idx % treatingPool.length] || DB.customers[idx];
  const pkg = pkgById(spec.pkg);
  const doctor = pick(DOCTORS).id;
  const start = d(spec.dstart, 9, 0);
  const dx = pick(PKG_DX[pkg.id] || BENH_LY);
  c.concern = dx; c.need = needForDx(dx);
  const enc = mkEncounter(c, new Date(start.getTime()-2*86400000), doctor, dx);
  DB.encounters.push(enc);
  const discount = pickw([0, 500000, 1000000, 2000000],[55,20,15,10]);
  const total = pkg.price - discount;
  const co = {
    id:'CO'+String(coId++).padStart(4,'0'),
    code:'LT-'+String(2026000+coId).slice(-6),
    customer_id:c.id, package_id:pkg.id, encounter_id:enc.id, doctor_id:doctor,
    diagnosis: enc.diagnosis,
    start_date: spec.status==='pending'?null:start,
    end_date_est: spec.status==='pending'?null:new Date(start.getTime()+pkg.sessions*3*86400000),
    total_sessions: pkg.sessions, done_sessions: spec.done,
    list_price: pkg.price, discount, total, paid:0,
    status: spec.status, // pending | active | completed | cancelled
    proposed_at: new Date(start.getTime()-2*86400000),
    proposed_by: doctor,
    activated_at: spec.status==='pending'?null:new Date(start.getTime()-1*86400000),
    activated_by: spec.status==='pending'?null:'U18',
    op_id: pick(OPS).id,
    metrics: [],
  };

  /* chọn 2-3 metric phù hợp */
  const mset = pkg.group==='Y học cổ truyền' ? ['M1','M5','M6'] : (pkg.code.includes('GOI')?['M1','M2','M4']:['M1','M2','M3']);
  co.metrics = mset;

  if(spec.status!=='pending'){
    /* baseline values */
    const base = {};
    mset.forEach(mid=>{
      const m = metricById(mid);
      base[mid] = m.higher_is_better ? ri(Math.round(m.max*0.25), Math.round(m.max*0.45)) : ri(Math.round(m.max*0.65), Math.round(m.max*0.9));
    });
    for(let i=1;i<=pkg.sessions;i++){
      const isDone = i<=spec.done;
      const at = new Date(start.getTime()+(i-1)*ri(2,3)*86400000);
      let st = 'pending';
      if(isDone) st='done';
      else if(i===spec.done+1 && spec.status==='active') st='booked';
      const s = {
        id:'SE'+String(seId++).padStart(4,'0'), course_id:co.id, no:i,
        at: (isDone||st==='booked') ? at : null,
        doctor_id: co.doctor_id, tech_id: pick(TECHS).id,
        services: pkg.services.slice(0, ri(2,pkg.services.length)),
        status: st,
        before: isDone? pick(['Đau âm ỉ vùng thắt lưng, VAS ổn định','Còn tê nhẹ mặt sau đùi','Đau tăng nhẹ sau khi làm việc nhà','Cảm giác dễ chịu hơn so với buổi trước','Ngủ tốt hơn, đau giảm']) : '',
        intervention: isDone? pkg.services.slice(0,3).join(', ') : '',
        after: isDone? pick(['Giảm đau rõ sau buổi, vận động dễ hơn','Đỡ căng cơ, tầm vận động cải thiện','Giảm tê, đi lại thoải mái hơn','Đau giảm, còn hơi mỏi vùng lưng']) : '',
        reaction: isDone? pickw(['Không có phản ứng bất thường','Đỏ da nhẹ vùng điều trị, tự hết','Mỏi cơ nhẹ sau tập'],[75,12,13]) : '',
        note: isDone? pick(['Bệnh nhân hợp tác tốt','Đã hướng dẫn bài tập tại nhà','Nhắc BN uống đủ nước sau trị liệu','']) : '',
        recommend: isDone? pick(['Duy trì bài tập tại nhà 2 lần/ngày','Chườm ấm 15 phút buổi tối','Hạn chế ngồi quá 45 phút liên tục','Tăng dần cường độ tập']) : '',
      };
      DB.sessions.push(s);
      if(isDone){
        mset.forEach(mid=>{
          const m = metricById(mid);
          const prog = i/pkg.sessions;
          const span = m.higher_is_better ? (m.max*0.9 - base[mid]) : (base[mid] - m.max*0.12);
          let v = m.higher_is_better ? base[mid] + span*prog*(0.85+rnd()*0.3) : base[mid] - span*prog*(0.85+rnd()*0.3);
          v = Math.max(m.min, Math.min(m.max, v));
          v = m.max<=10 ? Math.round(v*10)/10 : Math.round(v);
          DB.metricValues.push({id:'MV'+String(mvId++).padStart(4,'0'), course_id:co.id, session_id:s.id, session_no:i, metric_id:mid, value:v, at:s.at, by:s.doctor_id});
        });
      }
    }
    /* payments */
    const nPay = pickw([1,2,3],[45,40,15]);
    let remain = co.total;
    for(let i=0;i<nPay;i++){
      const last = i===nPay-1;
      let amt = last ? remain : Math.round(co.total*(i===0?0.5:0.3)/100000)*100000;
      if(spec.status==='active' && last && rnd()>0.55){ amt = Math.round(remain*0.6/100000)*100000; }
      if(amt<=0) break;
      const at = new Date(start.getTime()+i*ri(5,12)*86400000);
      if(at>d(0,23,59)) break;
      DB.payments.push({id:'PY'+String(pyId++).padStart(4,'0'), course_id:co.id, customer_id:c.id, at, amount:amt,
        method: pickw(['cash','transfer','card'],[45,40,15]), by: pick(DB.users.filter(u=>u.roles.includes('reception'))).id,
        ref: 'GD'+String(pyId+70000), note: i===0?'Thanh toán đợt 1':'Thanh toán đợt '+(i+1), type:'payment'});
      remain -= amt; co.paid += amt;
      if(remain<=0) break;
    }
  } else {
    for(let i=1;i<=pkg.sessions;i++){
      DB.sessions.push({id:'SE'+String(seId++).padStart(4,'0'), course_id:co.id, no:i, at:null, doctor_id:co.doctor_id, tech_id:null,
        services:pkg.services.slice(0,3), status:'pending', before:'',intervention:'',after:'',reaction:'',note:'',recommend:''});
    }
  }
  if(spec.status==='active'){
    const doneS = DB.sessions.filter(s=>s.course_id===co.id && s.status==='done');
    const bk = DB.sessions.find(s=>s.course_id===co.id && s.status==='booked');
    if(bk){
      const lastAt = doneS.length ? doneS[doneS.length-1].at : start;
      let nxt = new Date(Math.max(lastAt.getTime()+2*86400000, d(ri(0,4),0,0).getTime()));
      nxt.setHours(pick([8,9,10,14,15,16]), pick([0,30]), 0, 0);
      bk.at = nxt;
    }
  }
  DB.courses.push(co);
  if(spec.status==='active') c.status='IN_TREATMENT';
  if(spec.status==='completed') c.status='TREATMENT_COMPLETED';
  if(spec.status==='pending') c.status='PACKAGE_PENDING';
  c.lifecycle='patient';
});

/* thêm 1 correction payment demo */
DB.payments.push({id:'PY'+String(pyId++).padStart(4,'0'), course_id:DB.courses[0].id, customer_id:DB.courses[0].customer_id,
  at:d(-5,15,20), amount:-500000, method:'cash', by:'U08', ref:'GD70999', note:'Điều chỉnh: thu thừa 500.000đ buổi 3 (phiếu GD70123)', type:'reversal'});
DB.courses[0].paid -= 500000;
DB.payments.sort((a,b)=>b.at-a.at);

const courseById = id => DB.courses.find(c=>c.id===id);
const custById = id => DB.customers.find(c=>c.id===id);
const encById = id => DB.encounters.find(e=>e.id===id);

/* ---------- TIMELINE ---------- */
DB.timeline = [];
let tlId=1;
function tl(cid, at, icon, cls, title, desc, meta){ DB.timeline.push({id:'TL'+(tlId++), customer_id:cid, at, icon, cls, title, desc:desc||'', meta:meta||''}); }
DB.customers.forEach(c=>{
  tl(c.id, c.created_at, 'inbox','gray','Lead được tạo từ '+srcName(c.source), (DB.campaigns.find(x=>x.id===c.campaign)||{name:''}).name, 'Nguồn: '+srcName(c.source));
  if(c.assigned_to) tl(c.id, new Date(c.created_at.getTime()+ri(10,180)*60000), 'user','gray','Phân bổ cho Telesales', userName(c.assigned_to), '');
});
DB.calls.forEach(cl=>{
  tl(cl.customer_id, cl.at, 'phone','amber', userName(cl.user_id)+' gọi điện', '→ '+crLabel(cl.result)+(cl.note?' · '+cl.note:''), cl.duration? 'Thời lượng '+Math.floor(cl.duration/60)+'p'+(cl.duration%60)+'s':'');
});
DB.appointments.forEach(a=>{
  tl(a.customer_id, new Date(a.at.getTime()-ri(2,48)*3600000), 'calendar','purple','Đặt lịch '+a.type.toLowerCase(), fmtDT(a.at)+' · '+userName(a.doctor), 'Người đặt: '+userName(a.booked_by));
  if(a.checkin_at) tl(a.customer_id, a.checkin_at, 'checkCircle','green','Lễ tân check-in', 'Phòng '+(DB.rooms.find(r=>r.id===a.room)||{name:''}).name, '');
  if(a.exam_start) tl(a.customer_id, a.exam_start, 'stethoscope','teal', userName(a.doctor)+' bắt đầu khám', '', '');
  if(a.status==='no_show') tl(a.customer_id, new Date(a.at.getTime()+3600000), 'alert','red','Khách không đến', 'Lịch '+fmtDT(a.at), '');
});
DB.encounters.forEach(e=>{
  tl(e.customer_id, e.at, 'note','teal','Bác sĩ hoàn tất hồ sơ khám', 'Chẩn đoán: '+e.diagnosis, userName(e.doctor_id));
});
DB.courses.forEach(co=>{
  tl(co.customer_id, co.proposed_at, 'pill','purple','Đề xuất liệu trình', pkgById(co.package_id).name+' · '+money(co.list_price)+'đ', userName(co.proposed_by));
  if(co.activated_at) tl(co.customer_id, co.activated_at, 'unlock','green','Trưởng phòng kích hoạt liệu trình', co.code+' · '+co.total_sessions+' buổi', userName(co.activated_by));
  if(co.status==='completed') tl(co.customer_id, new Date(co.start_date.getTime()+co.total_sessions*3*86400000), 'flag','green','Hoàn thành liệu trình', co.total_sessions+'/'+co.total_sessions+' buổi', '');
});
DB.sessions.filter(s=>s.status==='done').forEach(s=>{
  const co = courseById(s.course_id);
  const mv = DB.metricValues.filter(v=>v.session_id===s.id);
  tl(co.customer_id, s.at, 'activity','green','Điều trị buổi '+s.no+'/'+co.total_sessions, s.intervention,
     mv.map(v=>metricById(v.metric_id).name.split(' (')[0]+': '+v.value).join(' · '));
});
DB.payments.forEach(p=>{
  tl(p.customer_id, p.at, p.amount<0?'undo':'banknote', p.amount<0?'red':'green', p.amount<0?'Điều chỉnh thanh toán':'Thanh toán '+money(p.amount)+'đ',
     p.note, (PAY_METHODS.find(m=>m.code===p.method)||{label:''}).label+' · Thu: '+userName(p.by));
});
DB.timeline.sort((a,b)=>b.at-a.at);

/* ---------- CARE TASKS (OP) ---------- */
DB.careTasks = [];
DB.courses.filter(c=>c.status==='active').forEach((co,i)=>{
  const nextS = DB.sessions.find(s=>s.course_id===co.id && s.status==='booked');
  const lastS = DB.sessions.filter(s=>s.course_id===co.id && s.status==='done').slice(-1)[0];
  const gap = lastS && lastS.at ? daysBetween(lastS.at, TODAY) : 0;
  let reason=null;
  if(!nextS) reason='no_next';
  else if(nextS.at < d(0,0,0)) reason='overdue';
  else if(gap>=6) reason='long_gap';
  else if(co.total_sessions - co.done_sessions <= 2) reason='ending';
  else if(i%3===0) reason='routine';
  if(reason) DB.careTasks.push({course_id:co.id, customer_id:co.customer_id, reason, gap, op:co.op_id, next: nextS?nextS.at:null, last: lastS?lastS.at:null});
});
const CARE_REASON = {
  no_next:{label:'Chưa có lịch buổi tiếp',color:'b-red'}, overdue:{label:'Quá lịch hẹn',color:'b-red'},
  long_gap:{label:'Nghỉ nhiều ngày',color:'b-amber'}, ending:{label:'Sắp kết thúc liệu trình',color:'b-purple'},
  routine:{label:'Gọi chăm sóc định kỳ',color:'b-blue'},
};

/* ---------- NOTIFICATIONS ---------- */
DB.notifications = [
  {id:'N1', at:d(0,8,12), icon:'inbox', cls:'b-blue', title:'Bạn có 12 lead mới được phân bổ', desc:'Từ chiến dịch FB - Thoát vị đĩa đệm T8', link:'#/telesales', read:false},
  {id:'N2', at:d(0,8,40), icon:'clock', cls:'b-amber', title:'Khách '+custById(DB.careTasks[0]?.customer_id||'C0001').name+' cần gọi lại lúc 15:00', desc:'Hẹn gọi lại từ cuộc gọi hôm qua', link:'#/telesales', read:false},
  {id:'N3', at:d(0,9,5), icon:'checkCircle', cls:'b-green', title:'Khách đã check-in tại quầy lễ tân', desc:'Phòng khám 1 · BS. Vũ Đình Hùng', link:'#/reception', read:false},
  {id:'N4', at:d(0,9,20), icon:'lock', cls:'b-red', title:'3 liệu trình chưa được kích hoạt', desc:'Đang chờ Trưởng phòng duyệt', link:'#/treatment', read:false},
  {id:'N5', at:d(0,10,2), icon:'calendar', cls:'b-purple', title:'2 khách chưa có lịch điều trị tiếp theo', desc:'Cần OP liên hệ đặt lịch', link:'#/op', read:true},
  {id:'N6', at:d(-1,16,45), icon:'banknote', cls:'b-teal', title:'Doanh thu hôm qua: 18.400.000đ', desc:'6 giao dịch · 4 gói mới', link:'#/reports/revenue', read:true},
];

/* ---------- AUDIT LOG ---------- */
DB.audit = [];
let auId=1;
function au(at,user,action,entity,eid,before,after){ DB.audit.push({id:'AU'+(auId++),at,user,action,entity,entity_id:eid,before,after,ip:'118.70.'+ri(10,250)+'.'+ri(2,250)}); }
au(d(0,8,2),'U02','import','leads','BATCH-0829','—','903 dòng · 850 tạo mới · 32 trùng · 21 lỗi');
au(d(0,8,15),'U02','assign','leads','BATCH-0829','chưa phân bổ','chia đều 5 telesales');
au(d(0,9,1),'U08','update','customers',DB.customers[3].id,'{"address":"..."}','{"address":"Số 45 Kim Mã..."}');
au(d(0,9,12),'U08','status_change','appointments',DB.appointments[0].id,'confirmed','arrived');
au(d(0,9,35),'U10','create','medical_encounters',DB.encounters[0].id,'—','draft');
au(d(0,10,5),'U10','finalize','medical_encounters',DB.encounters[0].id,'draft','final (v1)');
au(d(0,10,18),'U18','activate','treatment_courses',DB.courses[1].id,'pending','active');
au(d(0,10,40),'U08','payment','payments',DB.payments[0].id,'—','+'+money(Math.abs(DB.payments[0].amount))+'đ');
au(d(-1,15,20),'U08','reversal','payments','PY'+pyId,'+500.000đ','-500.000đ (điều chỉnh thu thừa)');
au(d(-1,17,2),'U01','permission_change','user_roles','U07','["telesales"]','["telesales","op"]');
au(d(-2,9,0),'U01','create','users','U07','—','Bùi Văn Khoa · telesales');
au(d(-2,14,30),'U11','update','clinical_metric_values','MV0012','VAS 6','VAS 5 (sửa nhập nhầm)');
DB.audit.sort((a,b)=>b.at-a.at);

/* ---------- IMPORT DEMO ROWS ---------- */
DB.importSample = {
  filename:'Lead_Facebook_T8_2026.xlsx', sheets:['Sheet1 (903 dòng)','Data_raw (1.204 dòng)','Ghi chú'],
  headers:['STT','Họ và tên','SĐT','Ngày sinh','Giới tính','Địa chỉ','Facebook','Nguồn','Chiến dịch','Nhóm QC','Quảng cáo','Nhu cầu','Bệnh lý quan tâm','Ghi chú','Ngày có lead'],
  rows:[
    ['1','Nguyễn Vãn An','0912.345.678','15/03/1978','Nam','Cầu Giấy, Hà Nội','fb.com/an.nguyen','Facebook','TVDD T8','HN 35-55','Video BN','Trị liệu giảm đau','Thoát vị đĩa đệm','Đau 3 tháng','28/08/2026'],
    ['2','Trần Thị Bình','84987654321','1985','Nữ','Đống Đa, Hà Nội','','Facebook','TVDD T8','HN 35-55','Video BN','Khám & tư vấn','Đau thắt lưng','','28/08/2026'],
    ['3','Lê Minh Cường','0938 111 222','02/11/1969','Nam','Hà Đông','fb.com/cuongle','Facebook','Vai gáy T8','Dân VP','Carousel','Vật lý trị liệu','Đau vai gáy','Hỏi giá','28/08/2026'],
    ['4','Phạm Thu Dung','+84906222333','1990','Nữ','Thanh Xuân','','Facebook','TVDD T8','HN 35-55','Video BN','PHCN','Thoái hóa cột sống cổ','','28/08/2026'],
    ['5','Hoàng Văn Em','0912345678','07/07/1975','Nam','Ba Đình','','Facebook','TVDD T8','HN 35-55','Video BN','Trị liệu giảm đau','Đau thần kinh tọa','Trùng SĐT dòng 1','28/08/2026'],
    ['6','Vũ Thị Gấm','','12/09/1982','Nữ','Nam Từ Liêm','','Facebook','Vai gáy T8','Dân VP','Carousel','Khám & tư vấn','Đau vai gáy','Thiếu SĐT','28/08/2026'],
    ['7','Đặng Quốc Hải','097.888.9999','30/01/1988','Nam','Hoàng Mai','','Facebook','TVDD T8','HN 35-55','Video BN','Châm cứu','Đau thắt lưng mạn tính','','28/08/2026'],
    ['8','Bùi Ngọc Hoa','0333.444.555','1995','Nữ','Long Biên','','Facebook','Vai gáy T8','Dân VP','Carousel','Trị liệu giảm đau','Hội chứng ống cổ tay','','28/08/2026'],
  ],
  fields:[
    {key:'', label:'— Bỏ qua —'},{key:'name',label:'Họ tên *'},{key:'phone',label:'Số điện thoại *'},{key:'dob',label:'Ngày sinh'},
    {key:'gender',label:'Giới tính'},{key:'address',label:'Địa chỉ'},{key:'facebook',label:'Facebook'},{key:'source',label:'Nguồn'},
    {key:'campaign',label:'Chiến dịch'},{key:'adset',label:'Nhóm quảng cáo'},{key:'ad',label:'Quảng cáo'},{key:'need',label:'Nhu cầu'},
    {key:'concern',label:'Bệnh lý quan tâm'},{key:'note',label:'Ghi chú'},{key:'lead_date',label:'Ngày có lead'},{key:'email',label:'Email'},
  ],
  autoMap:['','name','phone','dob','gender','address','facebook','source','campaign','adset','ad','need','concern','note','lead_date'],
  result:{total:903, valid:850, missing_phone:21, dup_existing:32, dup_infile:0}
};

/* ---------- BODY MAP PARTS ---------- */
DB.bodyParts = [
  {id:'neck',name:'Cổ'},{id:'shoulder_l',name:'Vai trái'},{id:'shoulder_r',name:'Vai phải'},
  {id:'back',name:'Lưng trên'},{id:'lumbar',name:'Thắt lưng'},{id:'hip_l',name:'Hông trái'},{id:'hip_r',name:'Hông phải'},
  {id:'elbow_l',name:'Khuỷu trái'},{id:'elbow_r',name:'Khuỷu phải'},{id:'wrist_l',name:'Cổ tay trái'},{id:'wrist_r',name:'Cổ tay phải'},
  {id:'hand_l',name:'Bàn tay trái'},{id:'hand_r',name:'Bàn tay phải'},
  {id:'knee_l',name:'Gối trái'},{id:'knee_r',name:'Gối phải'},{id:'ankle_l',name:'Cổ chân trái'},{id:'ankle_r',name:'Cổ chân phải'},
  {id:'foot_l',name:'Bàn chân trái'},{id:'foot_r',name:'Bàn chân phải'},
];
const BM_TYPES=[{code:'pain',label:'Đau',color:'#EF4444'},{code:'numb',label:'Tê',color:'#F59E0B'},{code:'limit',label:'Hạn chế vận động',color:'#7C3AED'},{code:'other',label:'Khác',color:'#64748B'}];

/* ---------- FILES ---------- */
DB.files = [
  {id:'F1', customer_id:DB.courses[0].customer_id, kind:'MRI', name:'MRI_cot_song_that_lung.pdf', size:'4.2 MB', at:d(-24,10,12), by:'U10'},
  {id:'F2', customer_id:DB.courses[0].customer_id, kind:'X-quang', name:'Xquang_L4L5_nghieng.jpg', size:'1.8 MB', at:d(-24,10,15), by:'U10'},
  {id:'F3', customer_id:DB.courses[0].customer_id, kind:'Xét nghiệm', name:'Ket_qua_xet_nghiem_mau.pdf', size:'320 KB', at:d(-23,9,2), by:'U08'},
  {id:'F4', customer_id:DB.courses[0].customer_id, kind:'Đơn thuốc', name:'Don_thuoc_29082026.pdf', size:'180 KB', at:d(-22,11,30), by:'U10'},
  {id:'F5', customer_id:DB.courses[1].customer_id, kind:'Siêu âm', name:'Sieu_am_phan_mem_vai.pdf', size:'900 KB', at:d(-15,14,20), by:'U11'},
];
const FILE_KINDS=['X-quang','MRI','CT','Siêu âm','Xét nghiệm','Đơn thuốc','Tài liệu khác'];
