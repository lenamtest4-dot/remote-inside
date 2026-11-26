# Remote Inside (v0.18.0)

Công cụ gom nhanh **5 trang nội bộ FPT** về một màn hình gọn nhẹ, tối ưu thao tác 1 tay trên **App Android (`.apk`)**, **iPhone 15+ Safari 1 chạm / `.ipa`** và **MacBook / PC** khi đi hiện trường. *(Các cổng đã dùng được luôn được xếp lên đầu thanh tab.)*

- **Inside** (`inside.fpt.net` / `fox-erp.fpt.net` / `partner.fpt.net`) — *Đã ghép đủ 8 lệnh*: Tra thông tin HĐ, **Phiếu triển khai FOX-ERP** (Xem phiếu, **Phân tuyến KTV** kèm tìm nhanh KTV, Khoản thu, Clear MAC vật tư, Hoàn tất phiếu, SĐT User & Sửa SĐT CMR, Biên bản ĐT, Cập nhật Online), **Phiếu bảo trì FOX-ERP & Chuyển Cloud Camera** (chọn phiếu bảo trì, **Điều chỉnh vật tư sử dụng & thu hồi** kèm kho MAC/lịch sử MAC Camera & Modem MAC tự động, kiểm tra trạng thái & mở nhanh **1 chạm Chuyển Cloud trên Partner** cùng mã `?q=...`, ghi nhận ban đầu, nguyên nhân lỗi, ghi chú, đóng/cập nhật kết quả xử lý & trả tình trạng), ByPass (CheckList ByPass), Reset MAC Modem/Box (+ Lịch sử), Kill Session (IP từng dòng), Clear OSP (Clear Serial tự đọc OLT/Port) *(hỗ trợ làm sạch phiên riêng & đổi tài khoản IAM riêng cho từng cổng)*
- **Port** (`port.fpt.net` / `mvcport.fpt.net`) — *Đã ghép đủ 3 lệnh FTTH NEW*: Xem Port hiện tại, Lịch sử Port, Cấp/Đổi Port & Thu hồi Port *(tự động làm sạch cookie/cache riêng của Port như tab ẩn danh + làm mới OIDC IAM `https://iam.fpt.net` và kích hoạt `LeftMenu.aspx` / `mvcport.fpt.net` khi gặp lỗi 401; hỗ trợ đổi tài khoản IAM riêng mà không làm mất phiên cổng khác)*
- **Vật tư** (`nextgen.fpt.net/resource/recall` & `/resource/equipment`) — *Thu hồi & Tồn nợ*: Phiếu thu hồi vật tư NextGen (thêm/sửa thiết bị, **Đổi / Cập nhật tên KTV theo từng dòng vật tư** với lọc danh sách KTV Radzen Blazor, chờ tải đủ phiếu/thiết bị, tạo phiếu `+`, ghi chú) và Tra cứu tồn nợ vật tư theo KTV (Báo cáo nợ); trên App Android & iOS chạy qua WebView nền, tự làm sạch cookie NextGen khi hết phiên và tự cấp lại `SessionCode` từ Fox-ERP *(hỗ trợ đổi TK IAM riêng qua Menu / Kết quả)*
- **Radius** (`radius-portal.fpt.net`) — *Đã ghép IPNAT & IPv6*: Tra cứu thông số kết nối, chỉnh Tình trạng NAT (`Default NAT` / `Khách hàng dùng Camera` / `ByPass NAT`), chỉnh IPv6 (`Deactivate` / `Active` / `Rule`) kèm ghi chú không dấu & Kill Session *(tự xóa cookie/token Radius cũ khi gặp HTTP 401; hỗ trợ đổi TK IAM riêng)*
- **Camera** (`fli-mngt.fcam.vn`) — **Tạm khóa** *(chưa có dữ liệu thao tác thực tế, khóa click ở cả thanh tab và Menu)*

> **An toàn thông tin:** Remote Inside không lưu mật khẩu hay mã đăng nhập. Cả App Android, App iOS lẫn bản Safari / PC đều chạy trực tiếp qua VPN công ty và phiên đăng nhập IAM (Azure AD) chính chủ của bạn — chỉ cần **đăng nhập IAM 1 lần**, app tự đồng bộ phiên SSO sang toàn bộ các cổng dùng chung IAM (`Inside`, `Partner/FOX-ERP`, `Port`, `Vật tư`, `Radius`), đồng thời hỗ trợ **Đổi TK IAM riêng** từng cổng trong `Menu → Mở trang cổng riêng lẻ` hoặc trực tiếp trên khung thông báo hết phiên.

---

## 1. Cài App Android (`.apk`) trên điện thoại (Khuyên dùng khi đi hiện trường)

### Cách tải và cài
1. Mở trang **Releases** của repo để tải file **`remote-inside-v0.18.0.apk`**:
   https://github.com/lenamtest4-dot/remote-inside/releases
   *(Hoặc tải trực tiếp ở mục Artifacts trong tab Actions của GitHub).*
2. Trên điện thoại Android, mở file `.apk` vừa tải -> chọn **Cài đặt** *(cho phép "Cài đặt ứng dụng không rõ nguồn gốc" cho trình duyệt/Tệp nếu máy hỏi lần đầu)*.
3. Bật **VPN công ty**, mở biểu tượng app **Remote Inside** trên màn hình chính.
4. Khi chưa có phiên đăng nhập (hoặc sau khi bấm **Tiện ích -> Đăng xuất & Đổi tài khoản FPT**), app tự yêu cầu bạn **đăng nhập trực tiếp trên cổng nội bộ FPT (`inside.fpt.net` -> IAM / Azure AD)** trước khi mở bảng điều khiển. Remote Inside không cài sẵn bất kỳ tài khoản hay mật khẩu mặc định nào; sau khi bạn đăng nhập 1 lần bằng tài khoản FPT chính chủ, app tự đóng màn hình đăng nhập và đồng bộ phiên sang toàn bộ cổng (`Inside`, `Partner`, `FOX-ERP`, `Port`, `Vật tư`, `Radius`).

> **Cập nhật đè trực tiếp từ bản v0.10.1 trở đi:**
> Các bản phát hành từ `v0.10.1` trở lên đều được ký bằng khóa Release cố định (`remoteinside`) trên GitHub Actions, nên mọi máy cài về sau chỉ cần tải file `.apk` mới về bấm **Cập nhật (Cài đè)** không cần gỡ bản cũ. *(Riêng máy nào đang cài bản thử `v0.10.0` dạng debug cần gỡ `v0.10.0` một lần duy nhất trước khi cài `v0.10.1`.)*

---

## 2. Cài trên iPhone 15+ (iOS) — Miễn phí

Trên **iPhone 15 trở lên (iOS 17 / 18+)**, Apple chặn bấm cài trực tiếp file `.ipa` chưa ký và thu hồi chứng chỉ web miễn phí, nên **Cách A (1 link Safari + Icon App ngoài màn hình chính)** là cách đơn giản, ổn định và dùng vĩnh viễn không cần máy tính:

### Cách A: 1 link cài nhanh Safari iPhone + Icon App ngoài màn hình chính (Khuyên dùng)
- Mở **Safari** trên iPhone truy cập đúng 1 đường link:
  https://lenamtest4-dot.github.io/remote-inside/ios.html
  *(Hoặc tải file `remote-inside-ios-setup.html` từ trang Releases.)*
- Trang hướng dẫn tự động có sẵn 4 nút bấm tuần tự:
  1. Bấm **1. Tải app Userscripts miễn phí** từ App Store (hoặc dùng Stay for Safari).
  2. Vào **Cài đặt → Ứng dụng → Safari → Phần mở rộng** (iOS 18+) hoặc **Cài đặt → Safari → Phần mở rộng** (iOS 17) → gạt BẬT **Userscripts** (Luôn cho phép trên tất cả trang web) & TẮT **Ngăn chặn theo dõi chéo trang**.
  3. Bấm **3. Cài tự động Remote Inside** → bấm biểu tượng `🧩 / AA` trên Safari → **Userscripts** → **Install / Lưu** *(tự cập nhật khi có bản mới, không hết hạn 7 ngày)*.
  4. Bấm **4. Tạo Icon App Remote Inside ngoài màn hình chính** → **Cho phép** → **Cài đặt → Đã tải về hồ sơ → Cài đặt** để có icon màu cam y hệt file APK ngoài màn hình chính *(chỉ chứa link `inside.fpt.net` và icon, không MDM, bấm vào tự mở Safari + bảng điều khiển Remote Inside kèm nút **Cổng nhanh** chuyển 1 chạm sang Inside / Port / Vật tư / Radius)*.

### Cách B: Cài App iOS riêng (`.ipa`) qua SideStore / Sideloadly / TestFlight
- Tải file **`remote-inside-v0.18.0-ios.ipa`** từ trang Releases:
  https://github.com/lenamtest4-dot/remote-inside/releases
- **SideStore (cần máy tính 1 lần đầu, miễn phí bằng Apple ID thường):**
  1. Cài **SideStore** lên iPhone 1 lần đầu qua máy tính Windows/Mac theo hướng dẫn tại https://sidestore.io (trên iOS 17+ cần bật thêm *Chế độ nhà phát triển* trong Quyền riêng tư & Bảo mật).
  2. Trên iPhone, tải `remote-inside-v0.18.0-ios.ipa` -> mở bằng app **SideStore** -> nhập Apple ID miễn phí của bạn để ký và cài app **Remote Inside** lên màn hình chính.
- **Sideloadly (nhanh trên máy tính Windows/Mac):** Tải https://sideloadly.io, cắm cáp USB vào iPhone, kéo file `remote-inside-v0.18.0-ios.ipa` vào và nhập Apple ID miễn phí *(gia hạn 7 ngày/lần hoặc dùng TrollStore / chứng chỉ Developer / TestFlight)*.

---

## 3. Bản Userscript 1 chạm + Tự động cập nhật trên MacBook / PC

### Link cài đặt trực tiếp (1 đường link duy nhất)
```
https://raw.githubusercontent.com/lenamtest4-dot/remote-inside/main/dist/remote-inside.user.js
```
*(Script đã gắn sẵn `@updateURL` trỏ về `dist/remote-inside.meta.js` và `@downloadURL` trỏ về `dist/remote-inside.user.js`, nên mỗi khi có phiên bản mới trên `main`, Tampermonkey sẽ tự kiểm tra và cập nhật.)*

### Trên MacBook / PC (Chrome / Brave / Edge)
1. Cài tiện ích **Tampermonkey** từ Chrome Web Store.
2. Mở link `https://raw.githubusercontent.com/lenamtest4-dot/remote-inside/main/dist/remote-inside.user.js` -> Tampermonkey tự bật tab xác nhận -> bấm **Install / Update**.
3. **Lưu ý quan trọng nếu dùng trình duyệt Brave:** Bấm biểu tượng **con sư tử màu cam (Brave Shields)** bên phải thanh địa chỉ và gạt **TẮT Shields** trên các trang `iam.fpt.net`, `port.fpt.net`, `inside.fpt.net` để Brave không chặn cookie đăng nhập xuyên trang (`cookieNotFoundMessage`).
4. Khi bật VPN mở `inside.fpt.net` hoặc `port.fpt.net`, góc dưới bên phải sẽ hiện nút nổi màu cam **Remote Inside** để mở bảng điều khiển.

---

## 4. Mở xem thử giao diện nhanh (không cần VPN)

Bạn có thể bấm mở trực tiếp file **`dist/preview.html`** bằng trình duyệt trên MacBook hoặc điện thoại để xem thử giao diện và bấm thử các nút (chạy dữ liệu mô phỏng).

Hoặc nếu chạy trên máy tính có mở sẵn terminal trong thư mục `Remote inside`:

```bash
npm run preview
```

Sau đó mở trình duyệt vào `http://localhost:4173/preview.html`.

---

## 5. Cách dùng nút "Quét cấu trúc" (bản PC) để ghép nốt Camera

1. Trên trình duyệt PC đang bật VPN, mở trang gốc của mục cần ghép (ví dụ `fli-mngt.fcam.vn`) và đăng nhập IAM.
2. Bấm nút nổi **Remote Inside** ở góc dưới bên phải -> bấm **Quét cấu trúc** ở thanh trên cùng.
3. Bấm **1b. Quét sâu trang đang mở (mã JS + mục chọn)** (hoặc **2. Bật ghi thao tác mạng** rồi thao tác thử 1 lần) -> **Tải file JSON** gửi lại để ghép tiếp lên cả App Android và PC cùng lúc.

*(Công cụ tự động xóa mật khẩu, cookie, token và che thông tin cá nhân khách hàng thành `[REDACTED]` trước khi tạo báo cáo.)*
