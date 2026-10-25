# RPA Money — bản khôi phục từ deployment

Kho này lưu **bundle đã triển khai được thu hồi và làm sạch ngày 25/10/2026**. Đây là bản khôi phục một phần, chưa thể build hoặc triển khai lại toàn bộ ứng dụng.

Tài liệu chính: **[Kiến trúc và giới hạn khôi phục](docs/ARCHITECTURE.md)**.

## Đã thu hồi

- [Ba module Worker](recovered/worker/): gateway gọi Google Apps Script, Durable Object `WriteOutbox`, dịch vụ hồ sơ ngân hàng/QR và wrapper giao diện.
- [Mười phần mở rộng frontend](recovered/frontend-extensions/): giải mã trực tiếp từ chuỗi nhúng trong `ui-wrapper.mjs`, gồm QR, công nợ, bộ lọc ngày, âm lịch, tùy chọn trình duyệt và nhãn hiển thị. Bundle QR vẫn là mã đã minify.
- [Manifest kiểm tra SHA-256](recovery-manifest.json), [ghi chép khôi phục](docs/RECOVERY.md), kiểm tra cục bộ và [thông báo thư viện bên thứ ba](THIRD_PARTY_NOTICES.md).

Các file kiểm tra, công cụ và tài liệu được viết mới cho lần khôi phục này; chúng không phải bộ test/build gốc. Không nhập lại export hoặc checkout từ phiên cũ.

## Chưa thu hồi

- HTML, `/js/app.js`, `/css/app.css` và các Static Assets gốc. Tải origin công khai bị proxy môi trường chặn `403`; API đọc đã dùng trả module và cấu hình assets, không trả nội dung Static Assets.
- Các module nguồn trước khi bundle/minify, source map và cấu hình build/dependency lock gốc.
- Dự án Google Apps Script, `appsscript.json`, schema và dữ liệu lưu trữ phía backend. Việc có RPC tới GAS không chứng minh được backend đang dùng Sheets hay cấu trúc bảng cụ thể.

Wrapper frontend cần asset gốc và các biến/hàm của nó; mười phần được giải mã không phải ứng dụng frontend độc lập. Tên đường dẫn `src/...` trong bundle là dấu vết bundler, không có nghĩa đã khôi phục các file nguồn đó.

## Kiểm tra cục bộ

Cần Node.js 24 trở lên và Python 3. Không cần cài package bên ngoài:

```sh
npm run check
npm test
```

`npm run extract` giải mã lại mười phần frontend từ wrapper. Nếu chủ động sửa artifact, phải cập nhật manifest sau khi rà soát lại; `check` chỉ xác minh, không tự ghi đè hash để làm test đạt.

Kiểm tra dùng dữ liệu giả và dịch vụ giả, không gọi production. Không có lệnh deploy hoặc workflow triển khai. Test import shim không mô phỏng Durable Object SQLite/alarms hay trình duyệt thực.

## Phạm vi công khai

Đã loại metadata tài khoản/hạ tầng, tên bucket, deployment binding IDs, giá trị biến môi trường và một scope riêng được hardcode trong dịch vụ R2. Scope này được thay bằng ví dụ; cần chọn và kiểm tra scope của hệ thống riêng trước khi sử dụng. Không lấy secret values, dữ liệu người dùng, hồ sơ ngân hàng, QR thật hoặc log vận hành.

Danh mục BIN/ngân hàng là metadata định tuyến công khai. Fixture `DEMO123` và UUID giả bắt đầu bằng số 0 là dữ liệu giả. Thông tin tác giả trong giấy phép thư viện được giữ để bảo toàn attribution. Kho không tự áp dụng giấy phép chung mới cho mã ứng dụng.
