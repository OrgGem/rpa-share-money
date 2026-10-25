# Triển khai production ngày 25/10/2026

Cloudflare xác nhận bản triển khai lúc 12:45:26 UTC đang phục vụ 100% traffic của `https://rpa.gemslab.id.vn`. Mã thay đổi lấy từ commit `8c69077f1c45d3da6c79d29609d00adf2a15840c`: hiển thị số tiền liền đơn vị, co font theo không gian và tải trước hồ sơ chủ nợ cho icon QR.

## Cách giữ hệ thống hiện có

- Tải lại module từ Worker production và kiểm tra checksum khớp baseline trước khi cập nhật.
- Giữ nguyên module gateway và dịch vụ hồ sơ ngân hàng của production, bao gồm scope riêng đang chạy. Không dùng scope ví dụ trong bản public để thay scope thật.
- Thay host QR theo nguồn đã kiểm thử và điểm gọi mở QR bằng yêu cầu fresh; thêm hai module hiển thị tiền. Entry point mới là `money-layout-worker.mjs`.
- Upload bằng `keep_assets: true`, giữ cấu hình routing/headers assets và kế thừa toàn bộ binding bằng chế độ strict. Không upload lại HTML/frontend assets, không thay secret values, bucket, namespace hoặc migration.

Sau triển khai, đọc lại từ Cloudflare xác nhận đủ năm module đúng checksum, binding và cấu hình assets khớp trước triển khai, migration Durable Object giữ nguyên và route hostname vẫn trỏ cùng Worker.

Đây là bản cập nhật dựa trên deployment đang có, không chứng minh repo public đã trở thành bản backup hoặc build hoàn chỉnh. Assets gốc và Apps Script vẫn chưa được thu hồi vào repo.

## Kiểm tra và giới hạn

14 test Node đạt; kiểm tra Chromium đã xác nhận bundle QR thực dùng kết quả tải trước cho icon và gọi mới khi mở QR. Bộ kiểm tra UI 1.125 trường hợp trên DOM mô phỏng cũng đạt. Các snapshot khôi phục trong repo giữ nguyên hash.

Request HTTPS từ môi trường thực thi tới website bị CONNECT proxy trả `403` trước khi tới origin. Vì vậy chưa xác nhận được giao diện, đăng nhập hoặc nghiệp vụ end-to-end qua URL production từ môi trường này. Trạng thái phục vụ được xác minh bằng Cloudflare Deployments API; không trình bày kiểm tra mô phỏng như kiểm tra website thật.
