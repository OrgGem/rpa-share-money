# EGM — Stage 5: Initial Zoom Out

Target: `docs/ARCHITECTURE.draft.md`, bản nháp 152 dòng trước sửa. Reviewer độc lập: `egm_initial_zoom`, persona `egm-zoom-out`, chuẩn `zoom-out-standard` của EGM 0.1.0. Kết quả trả về: 1 Major, 0 Blocker. Reviewer chỉ đọc, không sửa file hoặc runtime.

## Z5-01 — Major — Phạm vi lỗi của hàng đợi dùng chung

Vị trí: sơ đồ thành phần và mục 6, các dòng 88–103; bảng rủi ro dòng 147–150. Tài liệu mô tả trạng thái operation nhưng thiếu phạm vi dùng chung theo backend, có thể khiến người đọc hiểu retry độc lập cho từng user.

Bằng chứng: `recovered/worker/entrypoint.js:577` chọn `getByName("ledger:" + env.GAS_API_URL)`; các dòng 709–711 chọn operation retryable đầu tiên theo seq và dừng nếu chưa đến hạn/đang processing; các dòng 727–730 đặt retry cho lỗi tạm thời rồi dừng; các dòng 735–736 tiếp tục lập alarm từ tác vụ đầu hàng.

Đề nghị: trong cùng namespace WRITE_OUTBOX, request cùng GAS_API_URL dùng chung một Durable Object. Tác vụ retryable đầu hàng có thể giữ các tác vụ phía sau, kể cả actor khác. Tác vụ uncertain đã dừng tự retry được bỏ khỏi lựa chọn tự động. Bổ sung rủi ro và thử lỗi kéo dài trong môi trường riêng; chưa đề xuất chia hàng đợi khi thiếu số liệu.

## Đối chiếu đơn giản hóa

Không thấy đề xuất utility mới trùng chức năng đã có. `scripts/build-ui.mjs:8`–18 tái sử dụng wrapper/bundle và thay đúng các điểm ghép; `src/worker.mjs:12` chuyển tiếp qua wrapper. Đề xuất đo tải trước khi đổi cache phù hợp tiêu chuẩn.

## Hồ sơ đọc thực tế của reviewer

Đã đọc toàn bộ persona/standard; target và docs ARCHITECTURE, DEPLOYMENT, RECOVERY; README, manifest, notices, package.json; src/worker và ba file src/ui; build-ui, check-export, extract-embedded; tests/bank-prefetch; hai module entrypoint/bank-profile; chín extension không minify. Wrapper được đọc phần điều phối và đối chiếu cả mười literal với extension; QR bundle chỉ đọc phần tích hợp/application cuối file, không audit thuật toán thư viện.

Không có lỗi truy cập file đã mở. Chưa có frontend nền/GAS/schema hoặc bằng chứng API production gốc trong reading list. Không chạy test/build/truy cập production. Rủi ro hàng đợi suy ra từ mã, chưa được xác nhận bằng thử tải. Không kết luận an toàn toàn hệ thống.
