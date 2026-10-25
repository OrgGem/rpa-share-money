# Báo cáo EGM Review — kiến trúc RPA Money

Trạng thái: hoàn tất chuỗi review và sửa tài liệu. Đã chạy các vòng 5–9 với chín reviewer ở ngữ cảnh mới, không truyền hội thoại. Đây là review tổng quan hệ thống hiện hữu; không chứng nhận an toàn runtime hoặc full implementation readiness.

## Kết quả chính

[ARCHITECTURE.md](../../ARCHITECTURE.md) đã được viết lại theo mã hiện có: thành phần, dữ liệu, ranh giới quyền, luồng đọc/ghi/QR, UI tiền, build/deploy và giới hạn khôi phục. Tài liệu phân biệt rõ mã có thể chỉnh sửa, bundle khôi phục và triển khai dựa trên production đang tồn tại.

17 finding tài liệu thô được gộp thành **14 nhóm sửa**, gồm 6 Major và 8 Nit sau gộp; không có Blocker tài liệu được báo cáo. Tất cả 14 nhóm đã được xử lý trong văn bản. [Ma trận xử lý](goldfish_review_report.md) lưu ID nguồn, mức độ và sửa cụ thể. Không có finding bị contest; không đồng nhất việc sửa mô tả với khắc phục rủi ro runtime.

Vòng 8 đã kiểm tra lại 10 nhóm sửa đầu và không tìm thấy thiếu sót tài liệu mới. Vòng 9 có thêm bốn Nit, đã được orchestrator đối chiếu nguồn và bổ sung; không chạy lại toàn bộ swarm sau bốn sửa nhỏ này. Các báo cáo giữ số dòng của đúng bản reviewer đã đọc, nên số dòng có thể khác bản cuối.

## Các vòng và bằng chứng hoàn thành

| Vòng | Reviewer độc lập | Kết quả và artifact |
| --- | --- | --- |
| 5 — Initial Zoom Out | egm_initial_zoom | 1 Major; [zoom_out_report.md](zoom_out_report.md) |
| 6 — Comprehension | egm_comprehension | 1 Major, 3 Nit; [comprehension_report.md](comprehension_report.md) |
| 7 — Design / Structure / Style | egm_design_critic, egm_structure, egm_style | 5 Major, 3 Nit thô; [critic_report.md](critic_report.md), [structural_report.md](structural_report.md) |
| 8 — Intermediate Zoom Out | egm_intermediate_zoom | Xác nhận sửa ở mức tài liệu, 0 finding mới; [intermediate_zoom_out_report.md](intermediate_zoom_out_report.md) |
| 9 — Readiness / Codebase / Style | egm_readiness, egm_codebase_details, egm_readiness_style | 4 Nit tài liệu, 3 điều kiện hệ thống Major còn mở; [implementation_readiness_report.md](implementation_readiness_report.md) |

Các thông báo kết thúc native từ chín reviewer đã được nhận trước khi tổng hợp. Báo cáo vòng lưu phạm vi đọc và giới hạn do reviewer báo cáo; orchestrator không coi lời gọi spawn hoặc bản tổng hợp tự viết là bằng chứng một review đã hoàn thành. Công cụ giám sát không cung cấp cho orchestrator toàn bộ trace đọc file của mọi reviewer để kiểm chứng tự động từng lần đọc.

## Những điểm kiến trúc đã được làm rõ

- Cùng backend GAS dùng chung một WriteOutbox; tác vụ đầu hàng chờ retry có thể trì hoãn actor khác. Có giới hạn backlog và thời hạn lưu operation terminal; không cam kết exactly-once đầu cuối.
- Lease 5 phút bảo vệ việc nhận tác vụ, revoke không xóa operation đã nhận. Quyền thực thi cuối cùng phụ thuộc GAS, chưa có nguồn xác minh; logout không tự đồng nghĩa hủy mọi ghi đang chờ.
- Kiểm tra C chủ nợ có thể tạo khoảng 2C RPC GAS và đọc R2. Giới hạn bốn worker chỉ cho từng đợt nền; mở panel có thể tạo thêm request ngoài giới hạn này.
- Cache hồ sơ được tái sử dụng khi tuổi dưới 30 giây, không có timer tự xóa đúng hạn. Mở QR đọc mới; scope bộ lọc và scope lưu R2 là hai khái niệm riêng.
- Dữ liệu công nợ invalid khiến model không công bố tổng từng phần. HTTP 202 xác nhận nhận vào queue, không xác nhận GAS đã ghi sổ hay ngân hàng đã chuyển tiền.
- Bổ sung vai trò binding, chính sách limiter, tín hiệu log/header có sẵn và giới hạn của test shim/Chromium mock.

## Điều kiện còn mở

| ID | Mức độ | Điều kiện | Bằng chứng cần có để đóng |
| --- | --- | --- | --- |
| R9-01 | Major | Chưa dựng lại độc lập vì thiếu frontend nền và GAS/build gốc | Nguồn hợp lệ, cấu hình riêng và lần dựng môi trường mới chạy đầy đủ bằng dữ liệu giả |
| R9-02 | Major | Chưa kiểm chứng runtime đầu cuối: SQLite/alarm, GAS/idempotency, quyền khi có tác vụ chờ và frontend thật | Test tích hợp phù hợp, kể cả timeout/retry/logout/đổi quyền; không chỉ mock |
| R9-03 | Major | Chưa xác minh khả năng vận hành/phục hồi | Kế hoạch và diễn tập backup/restore, RTO/RPO, cảnh báo và trách nhiệm vận hành |

Những điều kiện này đã được công khai trong kiến trúc; không sửa code hoặc tuyên bố đóng chúng trong lần viết tài liệu.

## Đầu vào, phương pháp và giới hạn

Áp dụng [EGM Review 0.1.0](https://github.com/google/elephant-goldfish-model/blob/3d0b34821ce88ad328b0c9bf0e06d7eb5f1cd669/skills/egm_review/SKILL.md), chế độ tổng hợp theo lựa chọn người dùng. Dùng fork_turns none và reading list rõ ràng cho từng reviewer. Các phiên không nhận hội thoại nhưng vẫn dùng chung filesystem; đây không phải cách ly hệ thống tập tin.

Bản nháp trước sửa tại [input_architecture.md](input_architecture.md); đường dẫn liên kết đã chuẩn hóa khi lưu, số dòng giữ nguyên. SHA-256 đầu vào trước chuẩn hóa nằm trong [goldfish_review_report.md](goldfish_review_report.md). Bản cuối là tài liệu chính, không còn một bản draft cạnh tranh ở thư mục docs.

FeatureRange là toàn bộ tổng quan. **DetailedRange=N/A**: không có implementation plan riêng. Vòng 9 đã đánh giá mô tả build/deploy/phục hồi và điều kiện còn thiếu, không áp Zero-Decision Rule như cổng đạt/rớt cho tổng quan này và không chứng nhận full strict implementation readiness. Các đề xuất mục 11 cần thiết kế riêng trước khi giao triển khai.

Review không audit toàn bộ thư viện QR minify và không làm xuất hiện nguồn GAS/frontend nền còn thiếu. Các reviewer không tự gọi production hay chạy test; phạm vi đọc/đối chiếu được ghi riêng trong từng báo cáo. Orchestrator kiểm tra xuất bản tài liệu và đọc lại Cloudflare API để xác nhận deployment vẫn là bản đã triển khai; không gọi API thay đổi production.

## Kiểm tra kết quả viết tài liệu

Orchestrator chạy npm run check: 13 hash artifact khôi phục, cú pháp, giải mã literal và dò mẫu export đều đạt. Kiểm tra Markdown xác nhận code fence đóng và liên kết cục bộ tồn tại trong README, kiến trúc và chín artifact review. Git diff xác nhận src, recovered, scripts, tests, package/lock và manifest không thay đổi; chỉ sửa README/tài liệu. Không chạy lại các bài runtime/browser vì không sửa mã; con số 14 test và 1.125 trường hợp là kết quả đã ghi nhận cho bản mã hiện có, được reviewers đối chiếu phạm vi từ nguồn.

Cloudflare Deployments API được đọc lại trong phiên review: vẫn cùng deployment đã công bố ngày 25/10/2026, 100% traffic, cùng etag và lớp WriteOutbox. Không upload/deploy hoặc đổi settings trong phiên này. Việc đọc API không thay thế smoke test qua website đang bị proxy môi trường chặn ở lần kiểm tra trước.
