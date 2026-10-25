# EGM — Stage 6: Comprehension

Target: bản nháp `docs/ARCHITECTURE.draft.md:1`–152 trước sửa. Reviewer độc lập `egm_comprehension`, persona `egm-comprehension`, chuẩn `re-implementation-standard` của EGM 0.1.0. Kết quả: 1 Major, 3 Nit, 0 Blocker về khả năng hiểu.

| ID | Mức độ | Phát hiện và bằng chứng | Sửa tài liệu |
| --- | --- | --- | --- |
| C6-01 | Major | Mục 6 dòng 88 không liệt kê “các action được hỗ trợ”; entrypoint.js:545 và handlers 1563–1637 chỉ hỗ trợ năm action qua Outbox | Liệt kê createNote, updateNote, payment, batchPayment, deleteNote; header không tự đưa mọi mutation vào queue |
| C6-02 | Nit | scope chỉ cả bộ lọc và phạm vi R2; bank-profile.mjs:166–184 dùng all/me/UUID, trong khi 93–128 dùng BANK_PROFILE_SCOPE/appScope | Định nghĩa hai khái niệm riêng |
| C6-03 | Nit | Dòng 73 “loại dữ liệu mâu thuẫn” dễ hiểu là tính tiếp tổng từng phần; obligations.js:23–59 đặt invalid và trả cả kết quả unavailable; UI 145–149 hiện — | Nêu rõ model không công bố tổng từng phần khi phát hiện lỗi/mâu thuẫn |
| C6-04 | Nit | Mục 9 dòng 132 nói tên/vai trò nhưng thiếu tên hai limiter; entrypoint.js:453–462 phân biệt chúng | Bảng binding→vai trò, không thêm giá trị riêng |

## Áp dụng chuẩn tái triển khai

Tài liệu chưa đủ để viết lại hệ thống chỉ từ mô tả: thiếu hợp đồng đầy đủ route/RPC, serialization/chữ ký, mặc định, mã lỗi, retry và giới hạn queue. Đây là giới hạn của tổng quan as-built, không tự động là lỗi factual hoặc Blocker. Nên nêu rõ tổng quan không phải đặc tả tái triển khai; không suy diễn GAS/frontend còn thiếu để tuyên bố đạt chuẩn.

## Hồ sơ đọc thực tế

Đã đọc persona, standard và AGENTS của plugin; toàn bộ target, src/worker, build-ui, ba file src/ui; entrypoint, bank-profile, obligations; DEPLOYMENT, RECOVERY, manifest và cloudflare-runtime-stub. Wrapper chỉ đọc phần logic và khai báo/kích thước literal, không audit toàn bộ bundle minify.

Các extension khác trong liên kết thư mục, toàn QR bundle, website, Cloudflare API và số test chưa được reviewer kiểm chứng độc lập. Frontend nền, GAS và source map không có trong nguồn được xem. Không sửa file, chạy test hoặc đưa ra chứng nhận an toàn. Không có thao tác bị từ chối hay pending.
