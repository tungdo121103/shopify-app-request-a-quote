# Email delivery — Development và Production

## Kiến trúc

Quote domain không gọi trực tiếp SMTP, AWS SES hoặc SendGrid. Tất cả email đi qua một interface chung:

```text
Quote event
  → QuoteEmailDelivery outbox
  → email worker
  → EmailProvider factory
  ├── smtp      → MailHog hoặc SMTP server
  ├── ses       → AWS SES SDK
  └── sendgrid  → SendGrid HTTP API
```

Provider được chọn bằng biến `EMAIL_PROVIDER`.

## Development với MailHog

Docker Desktop phải đang chạy. Tại thư mục project:

```bash
npm run email:dev
```

- SMTP: `127.0.0.1:1025`
- MailHog UI: <http://localhost:8025>

Cấu hình `.env`:

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM_ADDRESS=no-reply@request-a-quote.local
EMAIL_FROM_NAME=Request a Quote (Local)
EMAIL_REPLY_TO=
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
```

MailHog không gửi email ra Internet. Mở UI trên cổng `8025` để kiểm tra subject, HTML, logo, link và dữ liệu quote.

```bash
npm run email:dev:down
```

## Production với AWS SES

```env
EMAIL_PROVIDER=ses
EMAIL_FROM_ADDRESS=quotes@your-business-domain.com
EMAIL_FROM_NAME=Your Business Name
EMAIL_REPLY_TO=support@your-business-domain.com
AWS_REGION=ap-southeast-1
```

AWS SDK tự đọc credential từ credential provider chain. Khi chạy trên AWS, ưu tiên IAM role. Chỉ cấu hình access key nếu môi trường host không hỗ trợ IAM role.

Trước khi gửi production:

1. Verify domain identity trong đúng AWS SES region.
2. Thêm các DNS record DKIM do SES cung cấp.
3. Cấu hình SPF và DMARC cho domain gửi.
4. Xin đưa SES account ra khỏi sandbox.
5. Cấp IAM permission tối thiểu `ses:SendEmail`.
6. Theo dõi bounce, complaint và sender reputation.

## SendGrid fallback

```env
EMAIL_PROVIDER=sendgrid
EMAIL_FROM_ADDRESS=quotes@verified-domain.com
EMAIL_FROM_NAME=Your Business Name
EMAIL_REPLY_TO=support@verified-domain.com
SENDGRID_API_KEY=...
```

Các biến `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME` và `SENDGRID_REPLY_TO` cũ vẫn được đọc để tương thích. Cấu hình mới nên dùng `EMAIL_FROM_*` dùng chung.

## Email queue

`QUOTE_EMAIL_SEND_IMMEDIATELY=true` xử lý một delivery ngay sau khi queue. Nếu dùng worker/scheduler riêng, đặt thành `false`.

Outbox giữ nguyên idempotency, retry tối đa 5 lần, trạng thái delivery, `providerMessageId` và `lastError`.
