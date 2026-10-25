# RPA Money — bản khôi phục từ deployment

Kho này lưu **bundle đã triển khai được thu hồi và làm sạch ngày 25/10/2026**. Đây là bản khôi phục một phần, chưa thể build hoặc triển khai lại toàn bộ ứng dụng.

Tài liệu chính: **[Kiến trúc hệ thống](docs/ARCHITECTURE.md)** và **[báo cáo EGM Review](docs/reviews/architecture-2026-10-25/consolidated_review_report.md)**. Kiến trúc phân biệt hệ thống đang chạy, bundle khôi phục và những phần chưa đủ để dựng lại độc lập.

## Đã thu hồi

- [Ba module Worker](recovered/worker/): gateway gọi Google Apps Script, Durable Object `WriteOutbox`, dịch vụ hồ sơ ngân hàng/QR và wrapper giao diện.
- [Mười phần mở rộng frontend](recovered/frontend-extensions/): giải mã trực tiếp từ chuỗi nhúng trong `ui-wrapper.mjs`, gồm QR, công nợ, bộ lọc ngày, âm lịch, tùy chọn trình duyệt và nhãn hiển thị. Bundle QR vẫn là mã đã minify.
- [Manifest kiểm tra SHA-256](recovery-manifest.json), [ghi chép khôi phục](docs/RECOVERY.md), kiểm tra cục bộ và [thông báo thư viện bên thứ ba](THIRD_PARTY_NOTICES.md).

Các file kiểm tra, công cụ và tài liệu được viết mới cho lần khôi phục này; chúng không phải bộ test/build gốc. Không nhập lại export hoặc checkout từ phiên cũ.

## Cập nhật UI số tiền

[Mã UI có thể chỉnh sửa](src/ui/) bổ sung cách hiển thị số tiền cùng đơn vị trên một dòng cho các tab, thẻ tổng, chi tiết khoản chi, công nợ và bảng. CSS giữ cụm tiền không ngắt dòng; phần đo kích thước chỉ giảm font khi thiếu chỗ và trả lại cỡ tự nhiên khi rộng hơn. Các nhãn/tên vẫn được xuống dòng riêng. Giá trị tiền, trạng thái thanh toán và quyền truy cập không thay đổi.

[Worker mới](src/worker.mjs) bọc snapshot đã thu hồi và nối phần UI vào hai response `/js/app.js`, `/css/app.css`. Các snapshot trong `recovered/` giữ nguyên để đối chiếu bằng chứng. `npm run build` tạo wrapper dẫn xuất và module chuỗi UI tại `.build/`; không khôi phục HTML/CSS/JS nền hoặc tạo ra một bản app đầy đủ. `package-lock.json` mới khóa công cụ test của repo, không phải dependency lock gốc đã thu hồi.

Bản sửa đã được triển khai production ngày 25/10/2026; xem [biên bản triển khai](docs/DEPLOYMENT.md). Muốn tích hợp cần dùng entrypoint mới, giữ bộ Static Assets hiện có, cấu hình binding/scope riêng phù hợp và kiểm thử trên môi trường đầy đủ.

## Tải trước thông tin QR

Khi dữ liệu công nợ hợp lệ được render, [host QR mới](src/ui/bank-qr-host.js) tải hồ sơ các chủ nợ song song (tối đa bốn request mỗi đợt), kể cả khi chưa mở “Cần trả”. Request đang chạy được dùng chung; kết quả thành công được giữ trong bộ nhớ tối đa 30 giây, giới hạn 100 hồ sơ. Khi mở “Cần trả”, icon dùng kết quả đã tải; nếu mạng chưa trả về, vẫn cần chờ request đó hoàn tất.

Cache được bỏ khi đổi tài khoản, khoảng ngày, scope hoặc dữ liệu chi tiêu; không lưu vào localStorage. Lỗi không được cache. Khi người dùng bấm icon để mở QR, bundle luôn đọc mới thông tin và số tiền từ server. Quyền đọc phía server vẫn giữ nguyên. Build tạo wrapper dẫn xuất trong `.build/`, thay host và đúng điểm gọi QR-open đã kiểm tra; snapshot gốc giữ nguyên hash. Thay đổi đã được triển khai cùng bản UI ngày 25/10/2026; xem [biên bản triển khai](docs/DEPLOYMENT.md).

## Chưa thu hồi

- HTML, `/js/app.js`, `/css/app.css` và các Static Assets gốc. Tải origin công khai bị proxy môi trường chặn `403`; API đọc đã dùng trả module và cấu hình assets, không trả nội dung Static Assets.
- Các module nguồn trước khi bundle/minify, source map và cấu hình build/dependency lock gốc.
- Dự án Google Apps Script, `appsscript.json`, schema và dữ liệu lưu trữ phía backend. Việc có RPC tới GAS không chứng minh được backend đang dùng Sheets hay cấu trúc bảng cụ thể.

Wrapper frontend cần asset gốc và các biến/hàm của nó; mười phần được giải mã không phải ứng dụng frontend độc lập. Tên đường dẫn `src/...` trong bundle là dấu vết bundler, không có nghĩa đã khôi phục các file nguồn đó.

## Kiểm tra cục bộ

Cần Node.js 24 trở lên và Python 3. Kiểm tra hash và test Worker không cần dependency bên ngoài:

```sh
npm run check
npm test
```

Kiểm tra hiển thị cần Playwright trong devDependencies và Chromium:

```sh
npm ci
npm run test:browser
```

Mặc định dùng `/usr/bin/chromium`; đặt `CHROMIUM_PATH` nếu trình duyệt ở nơi khác. Bài kiểm tra dùng DOM mô phỏng với CSS thật đã thu hồi và UI mới: 1.125 trường hợp trên năm độ rộng 320–1280px và năm tab, số lớn/âm/0, render lại, đổi kích thước, giữ nguyên ô nhập và nút thao tác. Đây không phải kiểm thử các trang production đầy đủ còn thiếu.

`npm run extract` giải mã lại mười phần frontend từ wrapper. Nếu chủ động sửa artifact, phải cập nhật manifest sau khi rà soát lại; `check` chỉ xác minh, không tự ghi đè hash để làm test đạt.

Kiểm tra dùng dữ liệu giả và dịch vụ giả, không gọi production. Không có lệnh deploy hoặc workflow triển khai. Test import shim không mô phỏng Durable Object SQLite/alarms; bài Playwright chạy trên Chromium thực với DOM mô phỏng.

## Phạm vi công khai

Đã loại metadata tài khoản/hạ tầng, tên bucket, deployment binding IDs, giá trị biến môi trường và một scope riêng được hardcode trong dịch vụ R2. Scope này được thay bằng ví dụ; cần chọn và kiểm tra scope của hệ thống riêng trước khi sử dụng. Không lấy secret values, dữ liệu người dùng, hồ sơ ngân hàng, QR thật hoặc log vận hành.

Danh mục BIN/ngân hàng là metadata định tuyến công khai. Fixture `DEMO123` và UUID giả bắt đầu bằng số 0 là dữ liệu giả. Thông tin tác giả trong giấy phép thư viện được giữ để bảo toàn attribution. Kho không tự áp dụng giấy phép chung mới cho mã ứng dụng.
