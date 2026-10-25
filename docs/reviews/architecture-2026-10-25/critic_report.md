# EGM — Stage 7: Critic Review

Target: bản nháp 152 dòng trước sửa. Ba reviewer được chạy độc lập, không kế thừa hội thoại: egm_design_critic (design_critic.md + feature-spec-standard), egm_structure (structural.md + feature-spec-standard), egm_style (style.md). Plugin EGM 0.1.0. Tổng kết phát hiện thô: 5 Major, 3 Nit, 0 Blocker; có các finding trùng với vòng trước. Chi tiết cấu trúc tại [structural_report.md](structural_report.md).

## Design Critic

### D7-01 — Major — Hàng đợi có miền lỗi chung

Mục 6, dòng 88–103 và bảng rủi ro. queueStub chọn một DO theo GAS_API_URL, alarm lấy operation đầu theo seq và có thể dừng chờ retry, trì hoãn actor khác. Giới hạn: 200 tác vụ chưa kết thúc, 30 mỗi actor, delay đầu 10 giây, backoff tối đa một giờ. Bổ sung topology, giới hạn, chặn đầu hàng và thử lỗi kéo dài; chưa đề xuất chia queue khi thiếu số liệu.

Nguồn: entrypoint.js:537–542, 577–580, 631–649, 699–737.

### D7-02 — Major — Cơ chế tăng tải GAS chưa cụ thể

Mục 7 dòng 111–116 và mục 11. Mỗi đọc chủ nợ thành công đi qua GAS me, GAS data và lọc notes, không dùng cache bootstrap. Một lượt đọc C chủ nợ có thể tạo khoảng 2C RPC, cộng đọc R2. Bundle decoratePayGroups dùng Promise.allSettled cho tất cả groups, nên thao tác mở panel có thể khởi động request ngoài bốn worker nền. Nêu nguồn tải này thay vì chỉ nói chung chung tăng tải.

Nguồn: bank-profile.mjs:187–205; entrypoint.js:1131; src/ui/bank-qr-host.js:38; decoratePayGroups trong bank-qr.bundle.js.

### D7-03 — Major — Lease không đồng nghĩa quyền thực thi hoặc hủy

Dòng 60 và 101–103. Lease 5 phút dùng khi nhận ghi; lúc lease còn hạn có thể nhận tác vụ mà không gọi lại me. revoke chỉ xóa lease, không xóa operation. Alarm dùng token đã lưu gửi applyQueuedMutation mà không kiểm tra lease trước. Logout/thu hồi lease không đồng nghĩa hủy tác vụ; GAS quyết định quyền ở thời điểm thực thi nhưng chưa có nguồn để kiểm chứng. Tài liệu cần phân biệt ba ranh giới này và bổ sung tình huống kiểm tra.

Nguồn: entrypoint.js:602–624, 716–719, 1140–1162, 1454–1476.

Design reviewer đọc target, DEPLOYMENT, RECOVERY, manifest, package; worker/build-ui và ba src/ui; ba module recovered/worker; cả mười extension, với vendor QR chỉ kiểm tra có mục tiêu; persona/standard. Không gọi production, chạy test, đọc dữ liệu thật hoặc sửa file. Không có wrangler.jsonc ở gốc repo; frontend nền/GAS vẫn thiếu. Không áp dụng template alternatives của đề xuất tính năng mới như yêu cầu bắt buộc cho tổng quan as-built.

## Style

| ID | Mức độ | Vị trí và phát hiện | Đề nghị |
| --- | --- | --- | --- |
| T7-01 | Major | Dòng 73: “loại dữ liệu mâu thuẫn” có thể hiểu thành tính tổng từ dữ liệu còn lại | Nêu toàn kết quả unavailable, tổng null khi model phát hiện invalid |
| T7-02 | Major | Dòng 82, 107, 109, 130, 132: scope là hai khái niệm | Tách bộ lọc all/me/UUID khỏi BANK_PROFILE_SCOPE/appScope và scope hardcode |
| T7-03 | Nit | Dòng 101: “tiền đã được ghi” lẫn ghi sổ với chuyển tiền | HTTP 202 chỉ xác nhận nhận vào queue, chưa xác nhận GAS áp dụng vào sổ |
| T7-04 | Nit | Thuật ngữ xuất hiện trước giải nghĩa: GAS/RPC/actor/wrapper/DO/lease/exactly-once/strict/RTO/RPO/SLO | Chú giải ngắn, giữ tên mã |
| T7-05 | Nit | Dòng 113: TTL 30 giây dễ hiểu thành tự xóa đúng hạn | Tuổi cache được kiểm tra khi đọc; mục cũ có thể còn trong Map tới khi đọc/thay context/đẩy khỏi giới hạn |

Style reviewer đọc đầy đủ target, persona, README, DEPLOYMENT, RECOVERY, worker, build-ui, ba src/ui, bank-profile, obligations, package và manifest; đối chiếu các đoạn liên quan của gateway, wrapper, test Node và hai script Chromium. Không audit hết vendor QR, không chạy test/build/API production, không sửa file. Không có thao tác bị chặn. Đây không phải chứng nhận an toàn runtime.
