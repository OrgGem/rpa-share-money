# EGM — Stage 8: Intermediate Zoom Out

Target: `docs/ARCHITECTURE.md`, 184 dòng sau sửa. Reviewer mới `egm_intermediate_zoom`, persona zoom_out, chuẩn zoom-out-standard, EGM 0.1.0. FeatureRange toàn file; DetailedRange N/A. Kết quả thực tế: 0 Blocker, 0 Major, 0 Nit mới; không tạo ID Z8 giả khi không có finding.

## Kiểm tra sửa trước đó

| Finding nguồn | Đối chiếu bản sửa |
| --- | --- |
| Z5-01, D7-01 | Dòng 118/179 mô tả queue chung, chặn đầu hàng và giới hạn 200/30; khớp entrypoint.js:537–545,577–579,631–649,699–737 |
| C6-01 | Dòng 103 liệt kê năm action và đường ghi trực tiếp; khớp entrypoint.js:545,1140–1183,1563–1637 |
| D7-03 | Dòng 120/178 phân biệt lease, revoke và quyền GAS khi thực thi; khớp entrypoint.js:602–624,716–719,1140–1162,1454–1476 |
| D7-02 | Dòng 132–137 nêu 2C RPC và decorator ngoài giới hạn đợt nền; khớp host QR:19–46,82–87, bank-profile.mjs:187–205 và bundle |
| C6-02, T7-02 | Dòng 20–21,128,151 tách hai scope; khớp bank-profile.mjs:93–130,166–184 |
| C6-03, T7-01 | Dòng 88 nêu toàn kết quả unavailable/null và UI —; khớp obligations.js:14–65,145–149 |
| C6-04, T7-03, T7-04, T7-05 | Bảng binding, nghĩa 202, thuật ngữ và tuổi cache đã có, khớp các đoạn nguồn đối chiếu |

Không thấy đề xuất utility/hạ tầng mới thiếu căn cứ. Backlog giữ hướng kiểm chứng và đo trước khi thay kiến trúc. Build tái sử dụng wrapper/bundle qua build-ui:8–18 và src/worker:12.

## Tồn dư và phạm vi đọc

Rủi ro runtime GAS/idempotency, quyền thực thi, queue chung, RPC và marker vẫn mở nhưng không còn là thiếu mô tả ở vòng này.

Reviewer đọc persona/standard; toàn target, năm báo cáo trước và báo cáo tổng hợp đang hoàn tất; README, DEPLOYMENT, RECOVERY, manifest, package; worker/build-ui, ba src/ui, toàn bank-profile và obligations. Gateway đọc các đoạn limiter/queue/cache/lease/logout/mutation; wrapper đọc phần điều phối/metadata, bundle QR đọc phần tích hợp có mục tiêu.

Không sửa file, chạy build/test, gọi production hoặc tự xác minh API Cloudflare. Chưa có nguồn frontend/GAS/schema. Không có thao tác bị từ chối hoặc pending; không chứng nhận runtime hoặc tái triển khai đầy đủ.
