# Báo cáo tiến độ Request a Quote

- **Ngày báo cáo:** 21/07/2026

## 1. Features list

### Buyer

| Module | Feature | Status |
|---|---|---|
| Quote Cart | Hiển thị và quản lý sản phẩm | `Done` |
| Quote Cart | Thay đổi quantity, xóa sản phẩm | `Done` |
| Quote Cart | Nhập thông tin và gửi yêu cầu báo giá | `Done` |
| Quote Cart | Validation và empty state | `Done` |
| Quote History | Xem danh sách báo giá | `Done` |
| Quote History | Xem trạng thái báo giá | `Done` |
| Quote Detail | Xem thông tin và sản phẩm | `Done` |
| Quote Detail | Accept/Decline offer | `Done` |
| Quote Detail | Download PDF | `Done` |
| Live Chat | Buyer gửi/nhận message | `Done` |
| Live Chat | Merchant gửi/nhận message | `Done` |
| Live Chat | Sending, failed và retry | `Done` |
| Live Chat | Upload file/image | `Done` |
| Buyer UI | Responsive mobile | `Processing` |

### Merchant Admin

| Module | Feature | Status |
|---|---|---|
| Quote | Danh sách, search, filter và sort | `Done` |
| Quote | Phân trang và export CSV | `Done` |
| Quote | Xem và chỉnh sửa Quote | `Done` |
| Quote | Chỉnh quantity và quote price | `Done` |
| Quote | Send/Revise/Reopen offer | `Done` |
| Quote | Convert sang Draft Order | `Done` |
| Quote | Xóa Quote | `Done` |
| Settings | Customer eligibility | `Done` |
| Settings | Product/Collection eligibility | `Done` |
| Settings | Quote expiration và reminder | `Done` |
| Widget | Icon/Text style | `Done` |
| Widget | Button text và size | `Done` |
| Widget | Desktop/Mobile position | `Done` |
| Widget | Orientation và animation | `Done` |

### PDF

| Module | Feature | Status |
|---|---|---|
| PDF | Merchant download | `Done` |
| PDF | Buyer download | `Done` |
| PDF Template | Preview A4 | `Done` |
| PDF Template | Logo, font và color | `Done` |
| PDF Template | Quote date, due date và date format | `Done` |
| PDF Template | Product image và pricing columns | `Done` |
| PDF | Chia nhiều trang và page number | `Done` |
| PDF | Đồng nhất preview với PDF tải xuống | `Optimizing` |

### Email

| Module | Feature | Status |
|---|---|---|
| Email Template | Chọn template và theme | `Done` |
| Email Template | Branding và logo | `Done` |
| Email Template | Preview | `Done` |
| Email Template | Send test email | `Done` |
| Email tự động | Gửi email theo trạng thái Quote qua SendGrid | `Processing` |
| Email Delivery | Queue và retry backend | `Optimizing` |

### Tổng hợp

| Status | Số lượng |
|---|---:|
| `Done` | 38 |
| `Processing` | 2 |
| `Open` | 0 |
| `Refactoring` | 0 |
| `Optimizing` | 2 |

## 2. New update trong tuần

### Buyer

- Hoàn thành Quote Cart, Quote History và Quote Detail.
- Đã test Buyer/Merchant chat và xác nhận hoạt động.
- Đang làm CSS mobile cho các màn Buyer.

### Merchant Admin

- Hoàn thành các chức năng chính của Email template và pdf template

### PDF

- PDF Template đã hoạt động với dữ liệu Quote thật.
- Merchant và Buyer tải được PDF thật.
- Hỗ trợ nhiều trang A4, due date và page number.
- Tách PDF editor, preview và server logic thành các file riêng.

**Technical:**

- Lưu cấu hình PDF theo từng shop trong database.
- Dùng chung cấu hình logo, màu sắc, font, ngày tháng và trường hiển thị cho preview và PDF tải về.
- Tạo PDF thật bằng `pdf-lib`, tự động chia sản phẩm thành nhiều trang A4.
- Kiểm tra quyền tải PDF riêng cho Merchant và Buyer.
- Tách formatter dùng chung để hỗ trợ SSR và tránh lỗi module `.client.ts`.

### Email

- Hoàn thành Email Template: chọn template/theme, branding, logo và preview.
- Tách email server action và preview renderer khỏi route.
- Email tự động đã gửi được qua SendGrid trong môi trường development.
- Hiện đang test bằng sender/email cá nhân, chưa test bằng email doanh nghiệp của shop.
- Các email test hiện thường bị email client đưa vào Spam/Junk.
- Đang hướng tới production: mỗi shop gửi bằng business email/domain đã xác thực để tăng độ tin cậy và giảm khả năng vào Spam.

**Technical:**

- Lưu Email Template và branding riêng theo từng shop.
- Tách server action, preview renderer và giao diện khỏi route chính.
- Tạo email queue/outbox và cơ chế idempotency để tránh gửi email tự động trùng.
- Tích hợp SendGrid API thông qua biến môi trường, không lưu API key trực tiếp trong source code.
- Hỗ trợ cấu hình sender name và `Reply-To`.
- Chuyển preview renderer sang module dùng chung để hoạt động đúng khi server render.


## 3. Hard core đang gặp

### 3.1. Email tự động qua SendGrid

- **Hiện trạng:** Đã gửi được email tự động nhưng đang dùng email cá nhân và thường bị đưa vào Spam/Junk.
- **Cần làm:** Sử dụng business domain, cấu hình SPF/DKIM/DMARC, xác thực domain trên SendGrid và test Gmail/Outlook.
- **Cần hỗ trợ:** Business domain/email chính thức và quyền cấu hình DNS.
- **Status:** `Processing`

### 3.2. Responsive mobile phía Buyer

- **Hiện trạng:** Quote Cart, Quote History, Quote Detail và Chat đã hoạt động; giao diện mobile chưa hoàn thiện.
- **Khó khăn:** File CSS widget lớn, nhiều media query nên sửa mobile có thể ảnh hưởng desktop.
- **Cần làm:** Hoàn thiện và test lần lượt từng màn, sau đó tách CSS theo module.
- **Status:** `Processing`

### 3.3. PDF Preview và PDF tải về

- **Hiện trạng:** PDF đã có dữ liệu thật, tùy chỉnh giao diện và hỗ trợ nhiều trang.
- **Khó khăn:** Preview dùng HTML/CSS, PDF tải về dùng `pdf-lib` nên font, khoảng cách và bo góc có thể khác nhau.
- **Cần làm:** Dùng chung config và test các trường hợp một trang, nhiều trang, thiếu ảnh và tên sản phẩm dài.
- **Status:** `Optimizing`

### 3.4. Live Chat

- **Hiện trạng:** Buyer và merchant đã gửi, nhận tin nhắn; có polling và chống tạo tin nhắn trùng khi retry.
- **Cần làm:** Kiểm tra thêm mất mạng, retry, nhiều tab, phân quyền, mobile và khả năng chịu tải.
- **Đánh giá:** Chức năng chính đã hoàn thành; chưa xác nhận hoàn toàn production-ready.
- **Status:** `Optimizing`

### 3.5. Môi trường production

- **Hiện trạng:** Project đang chạy development bằng localhost và SQLite.
- **Cần làm trước khi release:** Chuẩn bị HTTPS domain, database production, business email, secrets, backup và migration.
- **Đánh giá:** Chưa ảnh hưởng quá trình development nhưng bắt buộc xử lý trước khi phát hành cho nhiều shop.
- **Status:** `Open`

## 4. Cây feature dựa trên extension tham chiếu

### Cây feature đang theo dõi

```text
Request a Quote
├── Buyer
│   ├── Quote Cart
│   │   ├── Product List
│   │   ├── Quantity/Remove Product
│   │   ├── Customer Information
│   │   ├── Validation
│   │   └── Submit Quote Request
│   ├── Quote History
│   │   ├── Quote List
│   │   ├── Quote Status
│   │   └── Open Quote Detail
│   ├── Quote Detail
│   │   ├── Quote Information
│   │   ├── Product/Pricing
│   │   ├── Accept/Decline
│   │   └── Download PDF
│   └── Live Chat
│       ├── Send/Receive Message
│       ├── Sending/Failed/Retry
│       ├── Upload File
│       └── Read/Unread
└── Merchant Admin
    ├── Quote Management
    │   ├── List/Search/Filter/Sort
    │   ├── Quote Detail
    │   ├── Edit Quantity/Price
    │   ├── Send/Revise/Reopen
    │   ├── Convert Draft Order
    │   └── Export/Delete
    ├── Settings
    │   ├── Customer Eligibility
    │   ├── Product Eligibility
    │   └── Expiration/Reminder
    ├── Widget
    │   ├── Icon/Text Style
    │   ├── Button Text/Size
    │   ├── Desktop/Mobile Position
    │   ├── Orientation
    │   └── Animation
    ├── PDF Template
    │   ├── Preview/Download
    │   ├── Logo/Font/Color
    │   ├── Date/Due Date
    │   ├── Product Image/Pricing
    │   └── Multi-page/Footer
    └── Email
        ├── Template/Theme
        ├── Branding/Logo
        ├── Preview/Test Email
        └── Automatic Emails
```


## 5. Kế hoạch tiếp theo

1. Hoàn thiện CSS mobile phía Buyer.
2. Hoàn thiện email production qua SendGrid: business sender/domain authentication, SPF/DKIM/DMARC và kiểm tra Spam/Junk.
