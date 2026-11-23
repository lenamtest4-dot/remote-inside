# Remote Inside (v0.8.2)

Công cụ gom nhanh **5 trang nội bộ FPT** về một màn hình gọn nhẹ, tối ưu thao tác 1 tay trên **điện thoại Android** và **MacBook** khi đi hiện trường.

- **Inside** (`inside.fpt.net`) — *Đã ghép đủ 5 lệnh*: Tra thông tin HĐ, Reset MAC Modem/Box (+ Lịch sử), Kill Session (IP từng dòng), Clear OSP (Clear Serial tự đọc OLT/Port)
- **Port** (`port.fpt.net` / `mvcport.fpt.net`) — *Đã ghép đủ 3 lệnh FTTH NEW*: Xem Port hiện tại, Lịch sử Port, Cấp/Đổi Port & Thu hồi Port
- **Camera** (`fli-mngt.fcam.vn`) — Kiểm tra lỗi, Khởi động lại Camera
- **Vật tư** (`nextgen.fpt.net/resource/recall`) — Tra cứu & cập nhật vật tư thu hồi
- **Radius** (`radius-portal.fpt.net`) — Bỏ IPNAT, Bỏ IPv6

> **An toàn thông tin:** Remote Inside không lưu mật khẩu hay mã đăng nhập. Mọi thao tác đều chạy trực tiếp qua VPN công ty và phiên đăng nhập IAM chính chủ trên trình duyệt của bạn.

---

## 1. Mở xem thử giao diện ngay (không cần VPN)

Bạn có thể bấm mở trực tiếp file **`dist/preview.html`** bằng trình duyệt trên MacBook hoặc điện thoại để kiểm tra trước giao diện và bấm thử các nút (đang chạy dữ liệu mô phỏng).

Hoặc nếu chạy trên máy tính có mở sẵn terminal trong thư mục `Remote inside`:

```bash
npm run preview
```

Sau đó mở trình duyệt vào `http://localhost:4173/preview.html`.

---

## 2. Cài đặt để chạy kèm VPN & IAM

Cài bộ chạy Userscript từ file **`dist/remote-inside.user.js`**:

### Trên MacBook (Chrome / Brave / Edge)
1. Cài tiện ích **Tampermonkey** từ Chrome Web Store.
2. Bấm vào biểu tượng Tampermonkey -> **Create a new script...** (Tạo script mới).
3. Xóa hết phần chữ mặc định bên trong, mở file `dist/remote-inside.user.js`, copy toàn bộ nội dung dán vào và bấm **File -> Save** (hoặc `Cmd + S`).

### Trên điện thoại Android
1. Cài **Firefox** hoặc **Microsoft Edge** trên Google Play (hai trình duyệt này hỗ trợ tiện ích mở rộng trên điện thoại).
2. Cài thêm tiện ích **Tampermonkey** (hoặc **Violentmonkey**) ngay trong phần Tiện ích của trình duyệt.
3. Tạo script mới rồi dán toàn bộ nội dung file `dist/remote-inside.user.js` và lưu lại.
4. Khi bật VPN mở `inside.fpt.net` (hoặc bất kỳ trang nào trong 5 trang trên), góc dưới bên phải sẽ hiện nút nổi màu cam **Remote Inside** để bạn mở bảng điều khiển.

---

## 3. Cách dùng nút "Quét cấu trúc" để ghép nối chạy thật cho `inside.fpt.net`

Vì 5 trang nằm trong mạng nội bộ FPT, để mình nối đúng 100% các nút **Tra thông tin HĐ, Reset MAC, Kill Session, Clear OSP** vào API thật của công ty, bạn làm 4 bước sau khi đang bật VPN:

1. Mở trang **`https://inside.fpt.net`** và đăng nhập IAM như bình thường.
2. Bấm nút nổi **Remote Inside** ở góc dưới bên phải -> bấm **Quét cấu trúc** ở thanh trên cùng.
3. Bấm **1. Chụp nhanh giao diện trang hiện tại**, sau đó bấm **2. Bật ghi thao tác mạng** (bảng sẽ tự thu gọn thành nút đỏ nhỏ ở góc dưới để bạn thao tác trên `inside.fpt.net` không bị vướng).
4. Trên trang `inside.fpt.net`, tra thử 1 Mã HĐ bất kỳ -> bấm nút đỏ **Đang ghi mẫu (...) — Bấm để dừng** -> bấm **Sao chép báo cáo gửi AI** (hoặc **Tải file JSON**) và gửi lại vào cuộc trò chuyện này.

*(Công cụ tự động xóa mật khẩu, cookie, token và che thông tin cá nhân khách hàng thành `[REDACTED]` trước khi tạo báo cáo.)*
