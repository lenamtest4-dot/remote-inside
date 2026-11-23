# Remote Inside (v0.13.1)

Công cụ gom nhanh **5 trang nội bộ FPT** về một màn hình gọn nhẹ, tối ưu thao tác 1 tay trên **App Android (`.apk`)** và **MacBook / PC** khi đi hiện trường. *(Các cổng đã dùng được luôn được xếp lên đầu thanh tab.)*

- **Inside** (`inside.fpt.net` / `fox-erp.fpt.net`) — *Đã ghép đủ 7 lệnh*: Tra thông tin HĐ, **Phiếu triển khai FOX-ERP** (Xem phiếu, Khoản thu, Clear MAC vật tư, Hoàn tất phiếu, SĐT User & Sửa SĐT CMR, Biên bản ĐT, Cập nhật Online), ByPass (CheckList ByPass), Reset MAC Modem/Box (+ Lịch sử), Kill Session (IP từng dòng), Clear OSP (Clear Serial tự đọc OLT/Port)
- **Port** (`port.fpt.net` / `mvcport.fpt.net`) — *Đã ghép đủ 3 lệnh FTTH NEW*: Xem Port hiện tại, Lịch sử Port, Cấp/Đổi Port & Thu hồi Port
- **Vật tư** (`nextgen.fpt.net/resource/recall` & `/resource/equipment`) — *Thu hồi & Tồn nợ*: Phiếu thu hồi vật tư NextGen (thêm/sửa thiết bị, tạo phiếu `+`, ghi chú) và Tra cứu tồn nợ vật tư theo KTV (Báo cáo nợ)
- **Camera** (`fli-mngt.fcam.vn`) — Kiểm tra lỗi, Khởi động lại Camera *(đang chờ quét ghép tiếp)*
- **Radius** (`radius-portal.fpt.net`) — Bỏ IPNAT, Bỏ IPv6 *(đang chờ quét ghép tiếp)*

> **An toàn thông tin:** Remote Inside không lưu mật khẩu hay mã đăng nhập. Cả App Android lẫn bản PC đều chạy trực tiếp qua VPN công ty và phiên đăng nhập IAM (Azure AD) chính chủ của bạn — chỉ cần **đăng nhập IAM 1 lần**, app tự đồng bộ phiên SSO sang toàn bộ các cổng dùng chung IAM (`Inside`, `Partner/FOX-ERP`, `Port`, `Vật tư`, `Radius`).

---

## 1. Cài App Android (`.apk`) trên điện thoại (Khuyên dùng khi đi hiện trường)

### Cách tải và cài
1. Mở trang **Releases** của repo để tải file **`remote-inside-v0.13.1.apk`**:
   https://github.com/lenamtest4-dot/remote-inside/releases
   *(Hoặc tải trực tiếp ở mục Artifacts trong tab Actions của GitHub).*
2. Trên điện thoại Android, mở file `.apk` vừa tải -> chọn **Cài đặt** *(cho phép "Cài đặt ứng dụng không rõ nguồn gốc" cho trình duyệt/Tệp nếu máy hỏi lần đầu)*.
3. Bật **VPN công ty**, mở biểu tượng app **Remote Inside** trên màn hình chính.
4. Nếu trạng thái báo **Cần đăng nhập IAM**, chạm thẳng vào ô trạng thái (hoặc nút **Tiện ích** ở góc trên bên phải -> **Đăng nhập IAM (1 lần cho tất cả)**) -> bấm **Azure AD** đăng nhập 1 lần -> app tự đóng màn hình đăng nhập và đồng bộ phiên sang tất cả cổng dùng chung IAM (`Inside`, `Partner`, `FOX-ERP`, `Port`, `Vật tư`, `Radius`).

> **Cập nhật đè trực tiếp từ bản v0.10.1 trở đi:**
> Các bản phát hành từ `v0.10.1` trở lên đều được ký bằng khóa Release cố định (`remoteinside`) trên GitHub Actions, nên mọi máy cài về sau chỉ cần tải file `.apk` mới về bấm **Cập nhật (Cài đè)** không cần gỡ bản cũ. *(Riêng máy nào đang cài bản thử `v0.10.0` dạng debug cần gỡ `v0.10.0` một lần duy nhất trước khi cài `v0.10.1`.)*

---

## 2. Bản Userscript 1 chạm + Tự động cập nhật trên MacBook / PC

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

## 3. Mở xem thử giao diện nhanh (không cần VPN)

Bạn có thể bấm mở trực tiếp file **`dist/preview.html`** bằng trình duyệt trên MacBook hoặc điện thoại để xem thử giao diện và bấm thử các nút (chạy dữ liệu mô phỏng).

Hoặc nếu chạy trên máy tính có mở sẵn terminal trong thư mục `Remote inside`:

```bash
npm run preview
```

Sau đó mở trình duyệt vào `http://localhost:4173/preview.html`.

---

## 4. Cách dùng nút "Quét cấu trúc" (bản PC) để ghép nốt Camera / Vật tư / Radius

1. Trên trình duyệt PC đang bật VPN, mở trang gốc của mục cần ghép (ví dụ `fli-mngt.fcam.vn`, `nextgen.fpt.net/resource/recall`, `radius-portal.fpt.net`) và đăng nhập IAM.
2. Bấm nút nổi **Remote Inside** ở góc dưới bên phải -> bấm **Quét cấu trúc** ở thanh trên cùng.
3. Bấm **1b. Quét sâu trang đang mở (mã JS + mục chọn)** (hoặc **2. Bật ghi thao tác mạng** rồi thao tác thử 1 lần) -> **Tải file JSON** gửi lại để ghép tiếp lên cả App Android và PC cùng lúc.

*(Công cụ tự động xóa mật khẩu, cookie, token và che thông tin cá nhân khách hàng thành `[REDACTED]` trước khi tạo báo cáo.)*
