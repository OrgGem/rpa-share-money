# Ghi chép khôi phục và rà soát export

## Cách lấy bằng chứng

Ngày 25/10/2026, một session Cloud mới clone `OrgGem/rpa-share-money` vào thư mục riêng. Remote main sau fetch chỉ có README ở commit `5173251ad413d6296cfe31dd458cca2e2feeb41f`. Không phục hồi file từ phiên trước và không thay checkout dự án khác trong môi trường.

Kết nối Cloudflare được dùng với các request GET để tra Worker/route, deployment đang phục vụ, version, settings và tải script. Ba phần multipart nhận được là `bank-profile.mjs`, `entrypoint.js`, `ui-wrapper.mjs`; không có source map hoặc Static Assets trong response tải này.

Do connector giới hạn độ dài kết quả, module được đọc theo tên và từng đoạn, không ghép theo thứ tự multipart vốn thay đổi giữa các response. Sau ghép, đối chiếu số code unit UTF-16 và checksum FNV-1a với nội dung gốc tính trong API tool; sau đó tạo SHA-256 trên byte UTF-8. Deployment vẫn là cùng một version 100% traffic khi đối chiếu lại. Các định danh hạ tầng/deployment riêng được giữ ngoài export.

## Kết quả và giới hạn tải assets

- Thu hồi đủ ba module trả về: gateway 88.763 byte, dịch vụ hồ sơ 13.293 byte trước thay scope, wrapper 254.263 byte.
- Giải mã mười literal JS/CSS có tên trong wrapper. File `bank-qr.bundle.js` giữ nguyên phần minify; không tái tạo TypeScript/module gốc hoặc dependency graph gốc.
- Cấu hình có binding ASSETS và quy tắc Worker chạy trước một số đường dẫn. Cấu hình không chứa bytes của HTML, JS hoặc CSS gốc.
- Thao tác GET `https://rpa.gemslab.id.vn/` từ môi trường nhận `403 Forbidden` ở CONNECT tunnel/proxy trước khi đọc được trang. Không kết luận origin hoặc ứng dụng trả lỗi; không thu được HTML hoặc danh sách asset. Không thay route hoặc cấu hình để vượt giới hạn này.
- OpenAPI đọc đã tra không cung cấp endpoint GET tải inventory/nội dung Static Assets cho Worker này. Không tạo upload session, preview, deployment hoặc tài nguyên phụ để lấy asset.
- Không có source Apps Script, schema Sheets hoặc dữ liệu chi tiêu. Chỉ xác minh được hợp đồng RPC từ phía gateway.

## Biến đổi trước khi công khai

`entrypoint.js` và `ui-wrapper.mjs` được giữ nguyên byte từ response module. `bank-profile.mjs` chỉ thay một literal scope môi trường riêng bằng `example-bank-profile-scope-v1`; không làm đẹp hoặc sửa logic. Manifest ghi SHA-256 cho bản công khai sau biến đổi.

Wrapper và hai notice upstream có dòng trắng cuối file từ bản gốc. `.gitattributes` chỉ miễn kiểm tra blank-at-eof cho đúng ba file đó để giữ nguyên byte; không tắt các kiểm tra whitespace khác.

Mười file frontend được tạo bằng `scripts/extract-embedded.py` từ wrapper trong repo. Chúng là bản giải mã literal JSON, không phải nguồn trước bundling. Không bổ sung HTML, asset giả hoặc Apps Script giả để tạo cảm giác khôi phục đầy đủ.

Chỉ đưa vào repo ba module, mười phần giải mã, giấy phép cần thiết, tài liệu, công cụ kiểm tra và fixture giả. Raw Cloudflare API responses, binding values, tài khoản Cloudflare, namespace/bucket IDs, metadata người deploy và file tạm được để ngoài repo. Không đọc bucket R2, database, session hoặc log production.

Rà soát các literal, URL, email, UUID, chuỗi số dài, scope riêng và mẫu credential trong toàn bộ export. Danh mục BIN là metadata ngân hàng công khai; `DEMO123`, UUID bắt đầu bằng số 0 và `example.invalid` là fixture giả. Email tác giả trong giấy phép dijkstrajs là attribution công khai từ upstream, không phải dữ liệu người dùng ứng dụng.

## Kiểm tra có thể lặp lại

```sh
npm run check
npm test
git diff --check
```

Kiểm tra gồm inventory/hashes của 13 artifact, cú pháp JS, giải mã nhất quán, quyền/điều kiện ghi hồ sơ, công nợ theo revision và khoảng ngày, hợp đồng wrapper, API/static routing và payload QR/CRC. Test không gọi mạng. Import shim chỉ cho Node nạp class Worker, không mô phỏng Durable Object runtime.

Không có workflow GitHub Actions trong bản export; không thêm CI/deploy trong lần khôi phục. Trạng thái remote commit, cây file, nội dung tài liệu và CI được đối chiếu sau khi publication. Kiểm tra cục bộ không được trình bày như CI hoặc bài test gốc đã phục hồi.
