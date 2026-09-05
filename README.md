# VITALIFE CLINIC MANAGER — Demo UI (bản click-through)

Bản demo giao diện **chạy được ngay, không cần cài đặt** cho phần mềm quản lý nội bộ
Phòng khám Cơ xương khớp & Phục hồi chức năng Vitalife.

> Mục đích: **chốt luồng nghiệp vụ + giao diện** trước khi build bản thật
> (Next.js App Router + TypeScript + Tailwind + shadcn/ui + Supabase).
> Toàn bộ dữ liệu là **giả lập trong trình duyệt** — không có backend, không có dữ liệu bệnh nhân thật.

## Cập nhật mới (bản 1.0)

Năm nhóm chức năng bổ sung, dựng trên đúng kiến trúc/design system sẵn có — không viết lại, không đổi framework.

### 1. Hồ sơ khám bệnh: Lưu · In · Xuất PDF

Thanh hành động: `[trạng thái] [Lưu] [In hồ sơ] [Xuất PDF] [Chốt bệnh án] [Hồ sơ 360°] [Hàng chờ]`

Ba trạng thái rõ ràng, hiển thị bằng một badge duy nhất trên đầu màn hình:

| Trạng thái | Điều kiện | Ý nghĩa |
|---|---|---|
| **Chưa lưu** | `saved_at = null` hoặc đang có sửa đổi | Bác sĩ gõ nhưng chưa bấm Lưu |
| **Đã lưu** | `saved_at` có giá trị, không còn sửa đổi | Đóng màn hình mở lại vẫn còn, **sửa tiếp được**, in/xuất được |
| **Đã chốt bệnh án** | `status = final`, có `finalized_at` | Chỉ đọc; muốn sửa phải tạo phiên bản v+1 (logic cũ **giữ nguyên**) |

**In / Xuất PDF** chỉ bật sau khi đã lưu. Tài liệu in là một trang HTML độc lập
(`encounterDocHTML`) với CSS riêng `@page size:A4`, không phụ thuộc theme sáng/tối, gồm:
tiêu đề phòng khám + logo · khối thông tin bệnh nhân · đủ mục A→M của **đúng lần khám đang xem** ·
phụ lục sơ đồ vùng tổn thương · ô ký tên bệnh nhân và bác sĩ · chân trang ghi người in.
Bệnh án chưa chốt được đóng dấu *“Bản nháp”*.

Vì demo là static site không nhúng thư viện ngoài, **PDF tạo bằng hộp thoại in của trình duyệt**
(chọn đích *Lưu thành PDF*) — hộp thoại có nêu rõ hướng dẫn và tên tệp gợi ý.

### 2. Mua thêm gói trị liệu

Nút **＋ Mua thêm gói** ở header hồ sơ 360°, tab *Liệu trình* và trang liệu trình.
Một khách có **nhiều treatment course song song** — cùng loại gói, khác loại, hoặc cùng loại cho **vùng khác**.
Gói mới chỉ được `push` thêm, **không ghi đè** gói đang chạy (`createCourse()` là đường ghi duy nhất).

Mỗi gói giữ riêng: loại gói · **vùng điều trị** (`area`) · ngày bắt đầu · ngày dự kiến kết thúc ·
tổng buổi · đã dùng · còn lại · trạng thái · giá/giảm giá/công nợ · lịch sử từng buổi.

Tab *Liệu trình* có **bộ chip chuyển gói**; chọn gói nào thì xem lịch sử buổi và thẻ tóm tắt của gói đó.
Trang `#/treatment/[id]` cũng có dải chip chuyển nhanh sang các gói khác của cùng khách.

Mặc định gói mới ở trạng thái **Chờ kích hoạt** đúng quy trình duyệt hiện tại; ai có `treatment.approve`
mới thấy tuỳ chọn *Kích hoạt ngay*.

### 3. Hai quyền mới trong ma trận Vai trò & quyền

| Quyền | Không có quyền | Có quyền |
|---|---|---|
| `customer.view_phone` | SĐT bị che ở **mọi** màn hình, kết quả tìm kiếm và bản xuất (`09******53`); nút gọi bị khoá; ô SĐT trong form chuyển chỉ đọc | Xem và sửa số đầy đủ |
| `data.export` | Ẩn toàn bộ nút xuất **và** `openExport()`/`doExport()` từ chối ngay cả khi gọi thẳng từ console (ghi `denied` vào audit) | Xuất CSV/PDF như hiện tại |

Che số điện thoại làm tại **một điểm duy nhất** — hàm `fmtPhone()` trong `data.js` — nên mọi bảng,
hồ sơ, tìm kiếm và bản xuất đều tự động tuân thủ, không thể quên chỗ nào. Dữ liệu gốc trong DB không đổi.

Thêm quyền `treatment.purchase` (bán/thêm gói trị liệu). Cả ba quyền đều bật/tắt được theo từng vai trò
trong `#/admin/roles` như các quyền cũ.

**Mặc định** (chỉnh được trong ma trận): `customer.view_phone` cấp cho Telesales, Lễ tân, OP, Bác sĩ;
`data.export` cấp cho Marketing, Telesales, Lễ tân, Bác sĩ, Trưởng phòng. KTV không có cả hai —
dùng tài khoản KTV để kiểm chứng nhanh.

### 4. Tiếp đón: một visit, hai luồng

Check-in xong khách xuất hiện **đồng thời** ở hàng chờ bác sĩ **và** danh sách chờ check-out,
trên **cùng một bản ghi visit** (`DB.appointments`) — không nhân bản record.

```
FLOW A   Check-in → Bác sĩ khám → Điều trị → Check-out
FLOW B   Check-in → Điều trị trực tiếp → Check-out
```

Lễ tân chọn luồng ngay trên form check-in. Trạng thái visit thêm `in_treatment`; nhóm
`waiting · in_exam · in_treatment` = *đang có mặt*, đều check-out được. Bác sĩ thấy toàn bộ khách đã
check-in kèm cột **Luồng**; khách chọn trị liệu trực tiếp xếp cuối danh sách để bác sĩ chủ động bỏ qua.

Màn *Tiếp đón* có thêm thẻ **Chờ check-out** (mọi khách đang có mặt) và nút **Trị liệu** để đẩy khách
sang trị liệu mà không cần qua bác sĩ.

### 5. Form check-in: Kỹ thuật viên & Tư vấn viên

Thêm hai dropdown **Kỹ thuật viên** và **Tư vấn viên**, lấy động từ `DB.users`
(`techList()` = vai trò `tech`; `consultantList()` = `telesales` + `op`) — nhân sự vừa import từ Excel
xuất hiện ngay, không hard-code. Cả hai nullable.

Lưu vào chính bản ghi visit (`technician_id`, `consultant_id`) cùng bác sĩ, phòng, lý do khám và luồng;
mở lại visit hiển thị đúng. Đổi được sau check-in qua nút **Nhân sự** (có ghi audit).
Form khách vãng lai cũng có đủ các trường này.

### Thay đổi dữ liệu (in-memory, tương đương migration)

| Bảng | Cột thêm |
|---|---|
| `appointments` (visit) | `technician_id`, `consultant_id`, `flow`, `reason`, `checkin_by`, `checkout_by`, `treat_start` |
| `medical_encounters` | `saved_at`, `finalized_at` |
| `treatment_courses` | `area`, `sold_by`, `sold_at` |
| trạng thái lịch hẹn | thêm `in_treatment` |
| state machine khách | `CHECKED_IN` / `WAITING_DOCTOR` mở thêm nhánh sang `IN_TREATMENT` |

Tất cả đều là cột **thêm mới, nullable** — dữ liệu seed cũ vẫn đọc được bình thường.

### Nhật ký kiểm toán

Ghi thêm: `save` / `print` / `export` hồ sơ khám · `add_package` · `checkin` / `checkout` /
`treatment_start` / `exam_start` · `change_technician` / `change_consultant` / `change_doctor` ·
`denied` (mọi lần bị từ chối vì thiếu quyền). Log chứa người thực hiện, thời gian, hành động,
entity + id, giá trị trước/sau. Số điện thoại trong log đã qua `fmtPhone()` nên không lộ dữ liệu thô.

### Kiểm thử

```bash
npx serve demo         # rồi mở http://localhost:3000/index.html?test=1
```

`tests.js` chạy 10 kịch bản bám đúng tiêu chí nghiệm thu (lưu bệnh án · nội dung PDF ·
nhiều gói song song · che SĐT · chặn export ở tầng nghiệp vụ · check-in hiện ở 2 danh sách ·
không sinh visit trùng · luồng không qua bác sĩ · lưu KTV/TVV · **render toàn bộ 22 route × 8 vai trò
không lỗi**). Kết quả hiện ở route `#/tests`, chi tiết in ra console. Test chạy trên dữ liệu trong
bộ nhớ — F5 để về seed ban đầu.

---

## Hệ thống thiết kế (design system)

Xây theo skill **ui-ux-pro-max** — pattern *Data-Dense Dashboard*, nhận diện lấy trực tiếp từ `logo.png`
và thông tin nghiệp vụ từ **phongkhamvitalife.vn**.

| Token | Giá trị | Ghi chú |
|---|---|---|
| Primary (Vitalife Blue) | `#0167B8` | màu chủ đạo của wordmark VitaLife |
| Cyan | `#0198C3` | màu chuyển tiếp trong icon cột sống |
| Mint / Accent | `#0EBB98` (text `#06705C`) | đuôi gradient của logo |
| Gradient thương hiệu | `#0167B8 → #0198C3 → #0EBB98` | hero đăng nhập, header hồ sơ 360°, thanh tiến độ |
| Chữ / nền | `#0C1B2A` trên `#F4F7FA` | 16:1 contrast |
| Font | **Be Vietnam Pro** (UI) + **Fira Code** (số liệu, mã) | Be Vietnam Pro thay Fira Sans vì dựng riêng cho tiếng Việt; số dùng `tabular-nums` để cột không nhảy |

Chuẩn đã áp dụng:

- **Không dùng emoji làm icon.** Toàn bộ 282 vị trí emoji cũ đã thay bằng **70 icon SVG** (`icons.js`,
  phong cách Lucide, stroke 1.75, `currentColor`) — nhất quán trên mọi hệ điều hành, đổi màu theo theme.
- **Sáng / tối đầy đủ.** Toàn bộ màu là token CSS, dark mode định nghĩa riêng (không đảo màu),
  nút chuyển ở header, ghi nhớ trong `localStorage`, mặc định theo `prefers-color-scheme`.
- **Tương phản WCAG AA.** Mọi cặp chữ/nền đã đo và đạt ≥ 4.5:1 ở cả hai theme
  (chữ phụ 5.03, badge xanh 5.26, nút mint 6.03…).
- **Bàn phím & screen reader.** Skip-link, `:focus-visible` rõ ràng, focus trap trong modal,
  `role`/`aria-selected`/`aria-pressed` cho tab & chip, Enter/Space kích hoạt control tuỳ biến,
  vùng `aria-live` cho toast và lỗi form.
- **Touch target ≥ 40–44px** cho mọi nút, ô nhập, dòng nav.
- **Responsive** 375 / 768 / 1024 / 1440: sidebar thu thành drawer có scrim, thẻ KPI 2 cột trên mobile,
  bảng dữ liệu cuộn ngang trong khung riêng (trang không bao giờ cuộn ngang).
- **`prefers-reduced-motion`** được tôn trọng; chuyển động 180–220ms, chỉ dùng `transform`/`opacity`.
- Biểu đồ tự vẽ bằng SVG, màu lấy từ token nên đọc được ở cả hai theme; có legend bật/tắt, tooltip,
  nhãn trục, empty state.

## Chạy demo

```bash
open demo/index.html          # macOS
# hoặc chạy qua http để tránh mọi hạn chế của file://
npx serve demo                # rồi mở http://localhost:3000
```

### Đăng nhập nhanh
Màn hình login có sẵn nút đăng nhập theo vai trò. Hoặc dùng query param
(thêm `&theme=dark` để mở giao diện tối, `&simp=5` / `&imp=5` để nhảy thẳng tới bước 5 của wizard import):

| Vai trò | Link |
|---|---|
| Admin | `index.html?as=admin` |
| Marketing | `index.html?as=marketing` |
| Telesales | `index.html?as=telesales` |
| Lễ tân | `index.html?as=reception` |
| Bác sĩ | `index.html?as=doctor` |
| Trưởng phòng | `index.html?as=manager` |
| KTV | `index.html?as=tech` |
| OP / CSKH | `index.html?as=op` |

Có thể kèm route: `index.html?as=doctor#/doctor`

## Quy tắc nghiệp vụ quan trọng: ai phân bổ lead?

> **Chỉ Admin được phân bổ lead cho Telesales.**

| Vai trò | Được làm gì với lead |
|---|---|
| **Ads / Marketing** | Import lead từ Excel, xem toàn bộ lead, xem hiệu quả chiến dịch. **Không** được phân bổ. |
| **Admin** | Import nhân sự, phân bổ lead, chuyển lead giữa nhân viên, xem tất cả. |
| **Telesales** | Chỉ thấy lead được giao cho mình (Row-Level Security), gọi, đặt lịch. |

Màn hình **CRM › Phân bổ lead** (`#/admin/assign`) chỉ hiện với Admin, gồm:
danh sách lead chờ chia (lọc theo nguồn / chiến dịch / thời gian) · bảng tải công việc từng Telesales
(số lead đang mở, cuộc gọi hôm nay, tỷ lệ chốt lịch) · 3 cách chia (**chia đều**, **cân bằng tải**,
**theo hiệu suất**) · xem trước số lead mỗi người sẽ nhận trước khi xác nhận · gửi thông báo trong hệ thống
· và **Chuyển lead giữa nhân viên** khi có người nghỉ việc / quá tải.

Nút phân bổ ở màn Lead cũng bị ẩn với Marketing, và hàm `doAssign()`/`doBulkAssign()`/`doAdminAssign()`
đều kiểm tra `can('leads.assign')` một lần nữa — mô phỏng đúng cách backend chặn ở tầng server.

## Import danh sách Telesales bằng Excel

**Quản trị › Người dùng &amp; quyền › Import từ Excel** (`#/admin/staff-import`) — wizard 6 bước
giống hệt luồng import lead, nhưng tạo **tài khoản đăng nhập kèm vai trò**:

1. Kéo thả file `.xlsx/.xls/.csv` (có nút tải **file Excel mẫu** thật)
2. Chọn sheet
3. Ghép cột — bắt buộc **Họ tên**, **Email**, **Vai trò**
4. Xem trước toàn bộ dòng, số điện thoại đã chuẩn hóa, vai trò đã ánh xạ
5. Kiểm tra lỗi: thiếu email · thiếu vai trò · **email đã tồn tại** (chọn *Bỏ qua* / *Cập nhật*),
   tải được **báo cáo dòng lỗi** dạng CSV
6. Tạo tài khoản → gợi ý sang ngay màn **Phân bổ lead**

Cột *Vai trò* tự sửa lỗi chính tả và nhận nhiều biến thể:
`Telesale`, `TVV`, `Tư vấn`, `sale` → **Telesales**; `CSKH` → **OP / CSKH**; `KTV` → **Kỹ thuật viên**;
`Lễ tân`, `Bác sĩ`, `Trưởng phòng`, `Marketing`, `Admin`. Một người có thể mang **nhiều vai trò**
(`Telesales, CSKH`) phân cách bằng dấu phẩy.

## Kịch bản demo end-to-end (Definition of Done)

0. `?as=admin` → **Quản trị › Người dùng** → **Import từ Excel** → tạo 10 tài khoản Telesales mới.
1. `?as=marketing` → **Lead marketing** → **Import Excel** → đi hết 6 bước wizard
   (upload → chọn sheet → ghép cột → preview → kiểm tra trùng/lỗi → import).
   Để ý: Marketing **không có** nút phân bổ.
2. `?as=admin` → **CRM › Phân bổ lead** → chọn cách chia → xem trước → xác nhận.
3. `?as=telesales` → **Danh sách gọi** → bấm **📞 Gọi** → chọn kết quả **"Đặt lịch khám"**
   → lưu → form **Đặt lịch khám** tự mở, có bảng khung giờ chống trùng phòng/bác sĩ.
4. `?as=reception` → **Tiếp đón** → cột "Sắp đến" → **CHECK-IN** → khách chuyển sang *Phòng chờ*.
5. `?as=doctor` → **Khám bệnh** → **🩺 BẮT ĐẦU KHÁM** → nhập bệnh án (A→M, có autosave + body map)
   → mục **K** chọn gói → **Đề xuất liệu trình** → **✓ Chốt bệnh án**.
6. `?as=manager` → **Liệu trình** (tab *Chờ kích hoạt*) → **✓ Xác nhận** → chỉnh giảm giá,
   ngày bắt đầu, chọn chỉ số lượng giá → **🔓 Kích hoạt** → hệ thống sinh đủ N buổi.
7. `?as=tech` → **Buổi điều trị** → mở buổi → ghi nhận → **✓ Hoàn thành buổi**
   (buổi kế tiếp tự chuyển sang *Đã đặt lịch*).
8. Trong trang liệu trình → **＋ Nhập lượng giá** → biểu đồ tiến triển cập nhật ngay.
9. `?as=op` → **CSKH / OP** → danh sách cần chăm sóc (chưa có lịch / quá lịch / nghỉ dài / sắp kết thúc).
10. `?as=reception` → **Thanh toán** → **＋ Tạo phiếu thu**; sai thì tạo **↩ bút toán điều chỉnh**.
11. `?as=admin` → **Báo cáo** → funnel, hiệu quả Telesales, hiệu quả Marketing (CPL/ROAS), doanh thu.
12. `?as=admin` → **Vai trò &amp; quyền** → sửa ma trận quyền → Lưu → menu của vai trò đổi theo.
13. `?as=admin` → **Nhật ký hệ thống** → thấy toàn bộ audit trail của các thao tác trên,
    kể cả lượt **xuất Excel** và lượt **xem tệp y khoa**.

## Toàn bộ luồng đã chạy thật (không còn nút “demo”)

| Nhóm | Đã có |
|---|---|
| **Xuất dữ liệu** | Hộp thoại xuất chung: chọn phạm vi, **chọn từng cột**, xem trước 5 dòng, tải file **CSV mở bằng Excel** (có BOM, phân tách `;`, giữ dấu tiếng Việt). Áp dụng cho khách hàng, danh sách gọi, sổ quỹ, liệu trình, chăm sóc, nhân sự, audit log, báo cáo Telesales/Marketing. Mỗi lần xuất ghi vào audit log. |
| **Tệp y khoa** | Tải lên (kéo thả, thanh tiến trình, chọn loại tệp) · Xem tệp với **signed URL đếm ngược 5 phút** · ghi audit mỗi lượt xem |
| **Hồ sơ khách hàng** | Tạo mới / sửa với **kiểm tra trùng SĐT theo thời gian thực**, chuẩn hóa `+84`→`0`, gợi ý mở hồ sơ trùng |
| **Lịch hẹn** | Đặt · **Đổi lịch** (kiểm tra trùng phòng/bác sĩ, ghi lý do) · **Hủy lịch** (lý do + tự tạo nhắc gọi lại) · check-in · check-out |
| **Khách vãng lai** | Tra SĐT → dùng lại hồ sơ cũ hoặc tạo mới → đặt lịch + check-in trong một bước |
| **Buổi điều trị** | Sửa & **lưu** toàn bộ trường (dịch vụ, tình trạng trước/sau, phản ứng, khuyến nghị) · hoàn thành buổi · nhập lượng giá |
| **Thanh toán** | Phiếu thu · **In phiếu thu** có logo/địa chỉ/MST · bút toán điều chỉnh có lý do |
| **Báo cáo** | Bộ lọc thời gian **thực sự lọc số liệu** (hôm nay / 7 / 30 ngày / tháng này / toàn bộ) · drill-down: bấm chiến dịch → danh sách lead, bấm dòng doanh thu → danh sách giao dịch |
| **Quản trị** | Người dùng (thêm/sửa/khóa/đăng nhập thử) · **Ma trận vai trò & quyền** chỉnh được · Gói điều trị · Chỉ số lượng giá · **Cấu hình hệ thống** (thông tin phòng khám, cơ sở, phòng, nguồn, chiến dịch — đều thêm/sửa được) · Audit log |
| **Thông báo** | Bấm để đọc, badge tự giảm, đánh dấu tất cả đã đọc, điều hướng tới bản ghi liên quan |

## Màn hình đã có trong demo

| Route | Nội dung |
|---|---|
| `#/dashboard` | KPI hôm nay, phễu chuyển đổi, lead theo nguồn, doanh thu 14 ngày, việc cần xử lý |
| `#/leads` · `#/leads/import` | Danh sách lead + wizard import Excel 6 bước, phân bổ hàng loạt |
| `#/telesales` | 10 nhóm lead, gọi (tel: + CallProvider abstraction), form kết quả cuộc gọi, đặt lịch |
| `#/customers` · `#/customers/[id]` | Customer 360 với 9 tab + timeline duy nhất |
| `#/calendar` | View Ngày / Tuần / Danh sách, filter, chống trùng resource |
| `#/reception` | Hàng chờ theo trạng thái, check-in / check-out, đo thời gian chờ |
| `#/doctor` · `#/doctor/encounter/[id]` | Hàng chờ bác sĩ, bệnh án A→M, autosave, body map SVG, versioning |
| `#/treatment` · `#/treatment/[courseId]` | Duyệt & kích hoạt gói, tiến độ, **biểu đồ tiến triển**, danh sách buổi |
| `#/sessions` | Buổi điều trị cho KTV |
| `#/op` | Dashboard chăm sóc khách đang điều trị |
| `#/payments` | Sổ thu, phiếu thu, bút toán điều chỉnh (không xóa giao dịch) |
| `#/reports/*` | Tổng quan · Telesales · Marketing · Doanh thu |
| `#/admin/*` | Người dùng & quyền · Gói điều trị · Chỉ số lượng giá · Audit log |

## Điểm nghiệp vụ đã mô phỏng đúng

- **Một người – một hồ sơ**: Lead → Khách hàng → Bệnh nhân chỉ là *lifecycle* của cùng một bản ghi.
- **State machine**: chuyển trạng thái trái luồng bị chặn (có toast cảnh báo), không cho tùy tiện.
- **Chuẩn hóa số điện thoại**: `+84` / `84` / có dấu chấm, khoảng trắng → `0xxxxxxxxx`; dò trùng theo số đã chuẩn hóa.
- **Import không tạo trùng âm thầm**: người dùng chọn Bỏ qua / Cập nhật / Tạo mới.
- **Chỉ số lượng giá tùy biến** (`clinical_metric_definitions`): tên, mã, đơn vị, min, max, `higher_is_better`.
  Biểu đồ tự hiểu "giảm là cải thiện" với VAS/ODI và "tăng là cải thiện" với ROM/MMT.
- **Không AI chẩn đoán** — chỉ tính toán trên số liệu bác sĩ nhập.
- **Bệnh án final → versioned**, sửa phải tạo v+1 và ghi audit.
- **Giao dịch tài chính bất biến** — sai thì tạo reversal có lý do.
- **RBAC**: sidebar và nội dung khác nhau theo vai trò (tab *Hồ sơ khám* bị chặn với Telesales).
  Ở bản thật, mọi kiểm tra này lặp lại ở server + Row-Level Security của Supabase.

## Những gì **chưa** có trong demo (thuộc bản build thật)

- Backend thật: Supabase Postgres, migrations, seed, Auth, RLS, Storage + signed URL.
- Server actions / API, transaction cho nghiệp vụ quan trọng (kích hoạt gói, thanh toán).
- Đọc file Excel thật bằng SheetJS (demo đang dùng dữ liệu mẫu cố định cho wizard).
- React Hook Form + Zod validation, test tự động (13 flow theo yêu cầu).
- Tích hợp mở rộng: tổng đài VoIP, Zalo OA, Facebook Lead Ads, SMS, hóa đơn.

## Cấu trúc thư mục demo

```
demo/
  index.html    # shell: login, sidebar, header, search, modal/drawer/toast, skip-link
  styles.css    # design system: token sáng/tối, component, responsive, a11y
  icons.js      # 70 icon SVG (Lucide-style) + helper ic(name, size)
  data.js       # dữ liệu giả lập + helper (chuẩn hóa SĐT, tiền, ngày, state machine)
  app.js        # router hash, RBAC, 20+ view, biểu đồ SVG tự vẽ (line/bar/donut)
  flows.js      # xuất Excel, tệp y khoa, CRUD khách hàng, import nhân sự,
                # phân bổ lead, ma trận quyền, cấu hình, drill-down, phiếu thu,
                # in/xuất PDF hồ sơ khám, mua thêm gói trị liệu
  tests.js      # 10 kịch bản kiểm thử nghiệp vụ (mở ?test=1 hoặc route #/tests)
  assets/
    logo.png    # logo chính thức VitaLife
```

Không dùng CDN JS — chỉ font Google. Mở bằng `file://` cũng chạy.

## Thông tin phòng khám dùng trong demo

Lấy từ website chính thức **phongkhamvitalife.vn**:

- Công ty CP Thương mại và Dịch vụ Y tế Vitalife · MST 0111216156
- Địa chỉ: Số 16 P. Thượng Đình, Phường Khương Đình, Hà Nội
- Hotline **0936.278.589** · Email vitalifevn026@gmail.com · Giờ làm việc 7:00–12:00 | 13:00–20:00 (T2–CN)
- Slogan: *"Sáng y đức - vững niềm tin"* · *"Phục vụ bằng cả trái tim"*
- 10 chuyên khoa trên website được dùng làm danh mục **Nhu cầu khám**: cột sống, khớp gối, khớp háng,
  khớp vai, hội chứng cổ vai gáy, bệnh lý bàn tay – bàn chân, hội chứng ống cổ tay, PHCN sau phẫu thuật,
  nắn chỉnh cong vẹo cột sống, vật lý trị liệu.
- Bác sĩ **Phùng Quang Vũ** (Y học cổ truyền) là tài khoản bác sĩ thật; các nhân sự còn lại là giả lập.
- **Không có tên hay số điện thoại bệnh nhân thật** trong seed.



## Tối ưu cho điện thoại

Bản demo dùng được thật trên điện thoại, không phải chỉ "co lại cho vừa":

- **Thanh điều hướng dưới cùng (bottom nav)** — 4 mục hay dùng nhất *theo vai trò đang đăng nhập*
  (Telesales thấy “Gọi khách”, Lễ tân thấy “Tiếp đón”…) + nút **Thêm** mở menu đầy đủ.
  Có badge số việc cần làm, tôn trọng vùng an toàn (notch / thanh gesture của iPhone).
- **Bảng dữ liệu tự chuyển thành danh sách thẻ** — không bắt vuốt ngang. Nhãn cột lấy tự động từ
  tiêu đề bảng, dòng đầu làm tên khách, nút thao tác tách xuống dưới và giãn rộng cho dễ bấm.
  Riêng ma trận phân quyền vẫn giữ dạng bảng cuộn ngang vì đó là bản chất của dữ liệu.
- **Modal thành bottom sheet** — có thanh kéo, nội dung cuộn riêng, nút hành động to 46px dính đáy.
- **Tìm kiếm** thu thành một nút; bấm vào mở thanh tìm kiếm toàn chiều ngang.
- **Màn đăng nhập** xếp dọc, khối thương hiệu rút gọn thành dải đầu trang.
- **Biểu đồ** giảm chiều cao, thưa nhãn trục để không chồng chữ; lịch tự chuyển sang chế độ
  Ngày/Danh sách thay vì lưới tuần 7 cột.
- **Vùng chạm ≥ 44px**, bỏ mọi vùng cuộn lồng nhau trong thẻ.
- Kiểm chứng **không tràn ngang** ở 320 / 360 / 390 / 414px trên toàn bộ 27 màn hình.

## Triển khai lên GitHub Pages (để gửi khách duyệt)

Bản demo là **static thuần** — không cần build, không cần server, không có backend.
GitHub Pages chạy trực tiếp được.

```bash
# 1. Tạo repo và đẩy code (chạy trong thư mục demo/)
gh repo create vitalife-clinic-demo --public --source=. --remote=origin --push

# 2. Bật GitHub Pages: Settings › Pages › Source = Deploy from a branch
#    Branch = main, Folder = / (root)  →  Save
gh api -X POST repos/:owner/vitalife-clinic-demo/pages \
  -f "source[branch]=main" -f "source[path]=/"
```

Sau 1–2 phút, link demo sẽ là:

```
https://<tài-khoản>.github.io/vitalife-clinic-demo/
```

Gửi khách kèm link đăng nhập nhanh theo vai trò, ví dụ:

| Vai trò | Link gửi khách |
|---|---|
| Admin (xem toàn hệ thống) | `…/?as=admin` |
| Telesales | `…/?as=telesales#/telesales` |
| Lễ tân | `…/?as=reception#/reception` |
| Bác sĩ | `…/?as=doctor#/doctor` |
| Trưởng phòng duyệt gói | `…/?as=manager#/treatment` |
| Giao diện tối | `…/?as=admin&theme=dark` |

### Cập nhật demo sau khi sửa

```bash
git add -A && git commit -m "cập nhật demo" && git push
```

Các tệp CSS/JS đã gắn tham số `?v=…` để tránh trình duyệt của khách dùng bản cache cũ —
khi sửa code nhớ đổi số version trong `index.html`.

### Lưu ý khi demo cho khách

- Dữ liệu chỉ nằm trong bộ nhớ trình duyệt: khách bấm thử thoải mái, **F5 là về trạng thái ban đầu**.
- Không có tài khoản/mật khẩu thật — màn login chỉ để minh họa, bấm nút vai trò là vào.
- Toàn bộ tên, số điện thoại bệnh nhân là **giả lập**; chỉ thông tin phòng khám và BS. Phùng Quang Vũ là thật.
- Repo public đồng nghĩa mã nguồn demo công khai. Nếu cần riêng tư: dùng repo private
  (GitHub Pages cho repo private cần gói **GitHub Pro/Team**), hoặc deploy lên Netlify/Vercel/Cloudflare Pages
  bằng cách kéo thả thư mục — cũng chạy ngay vì đây là static site.

## Bước tiếp theo đề xuất

Sau khi bạn duyệt UI/luồng ở bản demo này, build thật theo 8 phase:
Architecture & schema & RBAC & Auth → CRM + Import + Telesales → Calendar + Reception →
Medical encounter → Treatment + Metrics + Chart → OP → Payment + Reports → Admin + Audit + Polish.
