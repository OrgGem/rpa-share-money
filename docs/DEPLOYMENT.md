# Triển khai production ngày 25/10/2026

## Bản hiện hành: màu card tổng lúc 17:09:25 UTC

Cloudflare xác nhận phiên bản `b779508a-9ba8-4b8e-87f2-9fa4c0a6a110` phục vụ 100% traffic. Mã sửa tại commit [65f1068](https://github.com/OrgGem/rpa-share-money/commit/65f1068e246ba4a6fb9dbfe060c96b96e9b77231): card “Đã thanh toán” và “Tổng phần được chia” dùng nền trắng, chữ đen trên các tab chi tiêu. Nhận diện theo nhãn và giá trị tiền; không đổi màu nút, khoản chi hoặc modal.

Đã thay literal presentationLabels và module CSS overlay bằng đúng bản build đã kiểm tra. Năm module sau upload khớp checksum dự kiến; gateway, hồ sơ ngân hàng, entrypoint ngoài, binding/settings, Static Assets, migration và route giữ nguyên. Kiểm tra đạt 14 test Node, 1.125 trường hợp bố cục tiền, QR và 17 trường hợp bộ lọc/card có kiểm tra màu computed style của card, nhãn và số tiền trong Chromium. Giới hạn kiểm tra website qua proxy bên dưới vẫn áp dụng.

## Bản sửa card tổng lúc 16:59:46 UTC

Cloudflare xác nhận phiên bản `91590338-8a6b-4df7-943a-0f371e304b89` phục vụ 100% traffic của `https://rpa.gemslab.id.vn`. Mã sửa tại commit [4a83c25](https://github.com/OrgGem/rpa-share-money/commit/4a83c257d29c81eb41bd17c9b872b2b50568e281).

Lỗi trước sửa: khi chọn “Chi tiêu của tôi”, phần trình bày xóa nhãn “Chi tiêu cá nhân” trên tab Khoản chi/Báo cáo nhưng chỉ nhận diện để bỏ cả card trên tab cá nhân. Bản sửa mở rộng cùng quy tắc nhận diện sang hai tab còn lại, loại card tổng thừa thay vì để số tiền không nhãn.

Đã tải lại mã production, đối chiếu baseline và chỉ thay literal presentationLabels trong ui-wrapper.mjs. Bốn module còn lại giữ nguyên; năm module sau upload được tải lại và xác minh checksum. Binding/settings, cấu hình assets, route và migration WriteOutbox được đối chiếu trước/sau và giữ nguyên. Upload dùng keep_assets và kế thừa binding strict; không dùng scope ví dụ từ snapshot public.

Kiểm tra đạt: 14 test Node, 1.125 trường hợp bố cục tiền, kiểm tra QR và 17 trường hợp Chromium về card/bộ lọc, gồm đổi tab, đổi scope, số tiền 0/âm/lớn và bảo vệ các tổng/nội dung/nút còn lại. Hash 13 snapshot khôi phục giữ nguyên. Đây là kiểm tra trên DOM và dịch vụ mô phỏng; request trực tiếp đến website sau triển khai vẫn bị CONNECT proxy trả 403 trước origin, nên chưa xác minh giao diện bằng tài khoản thật trong môi trường này.

## Bản UI và QR ban đầu lúc 12:45:26 UTC

Bản triển khai đầu lấy thay đổi từ commit `8c69077f1c45d3da6c79d29609d00adf2a15840c`: hiển thị số tiền liền đơn vị, co font theo không gian và tải trước hồ sơ chủ nợ cho icon QR. Bản sửa card tổng phía trên kế thừa các thay đổi này.

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
