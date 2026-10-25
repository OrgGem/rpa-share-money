# EGM — Stage 9: Implementation Readiness / Codebase Details / Style

Target: `docs/ARCHITECTURE.md`, bản 184 dòng sau vòng sửa đầu; xem toàn file, tập trung mục 9–11. Ba reviewer mới, không kế thừa hội thoại: egm_readiness, egm_codebase_details, egm_readiness_style. Persona tương ứng implementation_readiness, codebase_details, style; cùng tham chiếu implementation-readiness-standard của EGM 0.1.0.

## Phạm vi và kết luận readiness

DetailedRange=N/A: không có implementation plan riêng. Cả ba reviewer không chứng nhận full strict implementation readiness, cũng không dùng Zero-Decision Rule để tự kết luận một tổng quan as-built đạt/rớt như kế hoạch triển khai. Vòng này kiểm tra độ chính xác của các mô tả build/deploy/phục hồi và nêu điều kiện còn thiếu.

Readiness và Style không tìm thấy lỗi mô tả mới cần sửa. Codebase Details phát hiện bốn Nit, không có Blocker/Major về sai lệch văn bản.

## Finding tài liệu

| ID | Mức độ | Phát hiện và bằng chứng | Sửa được đề nghị |
| --- | --- | --- | --- |
| B9-01 | Nit | entrypoint.js:540,626–629,706: operation terminal dọn theo updated_at sau 7 ngày khi alarm chạy; ID được nhớ trong bảng operations | Nêu thời gian lưu và giới hạn dedup cục bộ, không gọi là xóa đúng hạn; dedup GAS vẫn chưa rõ |
| B9-02 | Nit | entrypoint.js:449,454–473,488–502,531–532: staging/production yêu cầu hai limiter và IP hợp lệ; cấu hình lỗi 502, quá hạn mức 429 | Nêu chính sách từ chối khi điều kiện bảo vệ thiếu, môi trường khác có thể bỏ qua limiter thiếu |
| B9-03 | Nit | entrypoint.js:939–960,693–695 có header/timing/log sự kiện | Chỉ ra X-RPA-Write-Queue, X-RPA-Cache, Server-Timing, api_request và write_queue; phân biệt tín hiệu có sẵn với cảnh báo/SLO chưa xác minh |
| B9-04 | Nit | package.json và cloudflare-runtime-stub.mjs:4–7 chỉ thay import bằng class rỗng | Nêu rõ shim không mô phỏng SQLite/alarm; dẫn các harness Chromium |

## Điều kiện hệ thống còn mở, không phải lỗi tài liệu cần che đi

| ID | Mức độ | Điều kiện và bằng chứng | Trạng thái |
| --- | --- | --- | --- |
| R9-01 | Major | Thiếu Static Assets nền, GAS và build gốc; mục 9–11, README, manifest, DEPLOYMENT | Chưa thể dựng lại độc lập; chỉ đóng khi có nguồn hợp lệ và bằng chứng dựng môi trường mới |
| R9-02 | Major | Shim không có SQLite/alarm thật, browser QR mock fetch; mục 10–11 và các harness | Chưa kiểm chứng quyền thực thi, idempotency, logout khi pending hoặc frontend/GAS đầu cuối |
| R9-03 | Major | Mục 9–11 và RECOVERY chưa xác minh backup/restore, RTO/RPO/cảnh báo | Chưa chứng nhận readiness vận hành/phục hồi; cần thiết kế và diễn tập riêng |

Không bắt buộc sửa văn bản để giả vờ đóng R9-01..03: tài liệu đã ghi rõ chúng. Không tự bổ sung schema/backend hoặc khẳng định kiểm thử production đã đạt.

## Hồ sơ đọc thực tế và giới hạn

- Readiness đọc đầy đủ target, persona/standard, README, package, build-ui, worker, DEPLOYMENT, RECOVERY, manifest, shim, check-export, hai browser harness, ba file test Node, ba src/ui và báo cáo tổng hợp đang hoàn tất. Gateway/profile/wrapper đọc các đoạn đối chiếu.
- Codebase Details đọc đầy đủ target, persona/standard, README, DEPLOYMENT, RECOVERY, package, manifest, worker/build-ui, ba src/ui, toàn gateway/profile/obligations, shim, ba test Node, hai browser harness và check-export. Wrapper đọc logic ngoài literal; QR bundle chỉ đoạn tích hợp liên quan.
- Style đọc đầy đủ target, persona/standard, DEPLOYMENT, RECOVERY, README, build-ui, worker, package, manifest, báo cáo tổng hợp, check-export, hai browser harness, ba test Node, shim và host QR. Đối chiếu có 14 test và 1.125 trường hợp bố trí (9 mẫu × 5 giá trị × 5 chiều rộng × 5 tab), không tự chạy lại.

Không reviewer nào sửa file, chạy test/build hoặc truy cập production. Không audit hết thư viện minify, không xác minh GAS, assets nền, dữ liệu thật hay khả năng restore. Không có thao tác bị chặn/pending; đây không phải chứng nhận an toàn runtime. Orchestrator sẽ kiểm tra sửa tài liệu, liên kết và export riêng.
