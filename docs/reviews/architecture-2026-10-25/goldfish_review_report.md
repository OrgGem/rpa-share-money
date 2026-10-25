# Goldfish Annotated Review Report

Status: resolved for the documentation repairs listed below. Runtime risks remain open; this is not runtime certification.

Target trước sửa: `docs/ARCHITECTURE.draft.md`, 1–152. Bản lưu tại [input_architecture.md](input_architecture.md), giữ số dòng và chỉ chuẩn hóa đường dẫn liên kết khi chuyển vị trí. SHA-256 bản đầu vào trước chuẩn hóa: `1295242952c8e562ac2b444366b537ad6178a3b3a331471d546178e324f52c93`. Bản sửa chính: [ARCHITECTURE.md](../../ARCHITECTURE.md).

Người dùng đã chọn chạy liền mạch và yêu cầu viết lại kiến trúc. Các sửa dưới đây chỉ sửa tài liệu trong phạm vi đó, không sửa runtime. Không có finding bị contest ở vòng này; các mô tả đúng được giữ và giới hạn của chuẩn tái triển khai được ghi riêng.

## Ma trận xử lý và truy vết

| Action | Finding nguồn | Mức gộp | Đánh giá | Sửa đã áp dụng |
| --- | --- | --- | --- | --- |
| A01 | Z5-01, D7-01 | Major | PROPOSE FIX | Mục 6 ghi DO chung theo GAS_API_URL, thứ tự ledger, chặn đầu hàng, giới hạn 200/30 và thời gian chờ; mục 11 giữ việc thử tải mở |
| A02 | C6-01 | Major | PROPOSE FIX | Mục 6 liệt kê đúng năm action Outbox, header không áp dụng mọi mutation |
| A03 | C6-02, T7-02 | Major | PROPOSE FIX | Bảng thuật ngữ phân biệt scope bộ lọc và scope lưu hồ sơ; mô tả production giữ BANK_PROFILE_SCOPE và literal tương ứng |
| A04 | C6-03, T7-01 | Major | PROPOSE FIX | Mục 4 nói toàn kết quả unavailable, tổng null và UI — khi model phát hiện invalid |
| A05 | C6-04 | Nit | PROPOSE FIX | Mục 9 có bảng tên binding và vai trò hai limiter |
| A06 | T7-03 | Nit | PROPOSE FIX | HTTP 202 là nhận yêu cầu vào queue, chưa xác nhận GAS áp dụng vào sổ |
| A07 | T7-04 | Nit | PROPOSE FIX | Thêm thuật ngữ GAS/RPC/actor/wrapper/DO/lease/exactly-once/strict/RTO/RPO/SLO |
| A08 | T7-05 | Nit | PROPOSE FIX | Tuổi cache được kiểm tra lúc đọc; không có timer tự xóa đúng 30 giây |
| A09 | D7-02 | Major | PROPOSE FIX | Mục 7 ghi me+data cho mỗi chủ nợ, ước lượng 2C RPC, decorator có thể tạo request ngoài giới hạn đợt nền |
| A10 | D7-03 | Major | PROPOSE FIX | Mục 6 phân biệt lease 5 phút để nhận ghi, revoke không xóa operation, quyền tại lúc thực thi phụ thuộc GAS; thêm tình huống cần kiểm chứng |
| A11 | B9-01 | Nit | PROPOSE FIX | Mục 6 nêu dọn terminal sau 7 ngày khi alarm chạy và giới hạn nhớ ID cục bộ |
| A12 | B9-02 | Nit | PROPOSE FIX | Mục 9 nêu yêu cầu hai limiter/IP, lỗi cấu hình 502 và vượt hạn mức 429 |
| A13 | B9-03 | Nit | PROPOSE FIX | Mục 9 nêu header/timing/log hiện có, không đồng nhất với cảnh báo/SLO |
| A14 | B9-04 | Nit | PROPOSE FIX | Mục 10 nêu class shim rỗng, không kiểm tra SQLite/alarm, kèm link hai harness |

Mỗi sửa được đối chiếu lại với nguồn do reviewer dẫn: gateway/Outbox, bank-profile, obligations và host QR. Các nhóm Major ở đây là thiếu sót mô tả có thể sửa bằng tài liệu; không có nghĩa các rủi ro vận hành tương ứng đã được khắc phục bằng code.

## Chuẩn áp dụng và phần không tuyên bố đạt

Tổng quan hệ thống hiện hữu không phải feature spec hoặc implementation plan mới. Không bắt buộc thêm lựa chọn hạ tầng, schema, phương án migration hoặc task list giả để lấp nguồn GAS/frontend còn thiếu. Mở đầu đã nêu rõ tài liệu không đủ để tái triển khai chỉ bằng mô tả. Việc thiếu implementation plan sẽ được ghi thành giới hạn của vòng readiness, không dùng để chứng nhận đã sẵn sàng dựng lại hệ thống.
