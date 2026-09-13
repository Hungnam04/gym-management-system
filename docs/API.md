# Gym TN API

Base URL khi phát triển: `http://127.0.0.1:5000/api`.

JSON UTF-8. Cookie giữ phiên đăng nhập. Gọi `GET /auth/session` để lấy `csrf_token`, rồi gửi `X-CSRF-Token` trong mọi `POST`, `PUT`, `PATCH`, `DELETE`. Token đổi sau đăng nhập/đăng ký/đăng xuất; lấy token mới từ response. Frontend đã xử lý quy trình này trong `api.js`.

Lỗi chuẩn: `{ "error": "Thông báo tiếng Việt", "code": null }` với HTTP `400` (dữ liệu), `401` (chưa đăng nhập), `403` (quyền/CSRF/gói tập), `404` (không tồn tại), `409` (xung đột nghiệp vụ), `413` (quá 128 KB), `429` (thao tác quá nhanh), `500` (lỗi nội bộ). Lỗi CSRF có `code: "csrf_expired"`; frontend lấy lại phiên và thử lại tối đa một lần vì request này chưa thực hiện thay đổi dữ liệu. Một số lỗi HTTP chung không có trường `code`.

## Công khai và xác thực

| Method | Endpoint | Nội dung |
| --- | --- | --- |
| GET | `/health` | `{status, service}` |
| GET | `/auth/session` | `{user, csrf_token, demo_payments}` |
| POST | `/auth/register` | `{name, email, password, phone?}`; `201`, tự đăng nhập |
| POST | `/auth/login` | `{email, password}`; `{user, csrf_token}` |
| POST | `/auth/admin-login` | `{email, password}`; chỉ chấp nhận admin, không tạo phiên admin nếu tài khoản không đúng vai trò |
| POST | `/auth/logout` | Hủy phiên hiện tại, trả CSRF mới |
| GET | `/plans` | `{plans: []}`, chỉ gói active, features là mảng |
| GET | `/trainers` | `{trainers: []}`, chỉ HLV active |
| GET | `/classes` | `{classes: []}`, lớp tương lai chưa hủy, kèm `booked`, `my_status` |
| GET | `/posts` | `{posts: []}`, danh sách bài đã xuất bản |
| GET | `/posts/:id` | `{post: {content, ...}}` |
| POST | `/contacts` | `{name, email, phone?, topic, message}`; lưu yêu cầu |

## Hội viên

| Method | Endpoint | Nội dung |
| --- | --- | --- |
| GET | `/me/dashboard` | `{memberships, orders, bookings, progress, workouts}` của chính tài khoản |
| PUT | `/me` | `{name, phone}` |
| PUT | `/me/password` | `{current_password, new_password}` |
| POST | `/orders` | `{plan_id: number, payment_method: "cash" hoặc "demo"}`; `{order}`, HTTP 201 |
| POST | `/orders/:id/pay-demo` | Chỉ đơn pending, đúng chủ, method demo và DEMO_PAYMENTS=true |
| POST | `/orders/:id/cancel` | Chỉ đơn pending của chính mình |
| POST | `/bookings` | `{class_id: number}`; kiểm tra gói, thời gian, sức chứa, lịch trùng |
| POST | `/bookings/:id/cancel` | Hủy lượt đặt của mình trước giờ bắt đầu |
| POST | `/me/progress` | `{recorded_on: "YYYY-MM-DD", weight: number, height: number, note?: string}`; upsert theo ngày |
| DELETE | `/me/progress/:id` | Xóa chỉ số của mình |
| POST | `/me/workouts` | `{title, recorded_on: "YYYY-MM-DD", duration_minutes: number, note?: string}` |
| DELETE | `/me/workouts/:id` | Xóa nhật ký của mình |

Ví dụ tạo đơn:

```json
{"plan_id": 1, "payment_method": "cash"}
```

Ví dụ ghi chỉ số (thay ngày bằng ngày hiện tại hoặc quá khứ):

```json
{"recorded_on": "2026-09-08", "weight": 65.5, "height": 170, "note": "Buổi sáng"}
```

## Quản trị

Tất cả endpoint `/admin/*` kiểm tra quyền admin từ cơ sở dữ liệu ở mỗi request.

| Method | Endpoint | Nội dung |
| --- | --- | --- |
| GET | `/admin/overview` | `{stats, revenue, recent_orders}` |
| GET | `/admin/:resource` | `{items: []}`; resource = users/plans/trainers/classes/bookings/orders/posts/contacts |
| POST | `/admin/users` | Tạo tài khoản: `{name,email,phone?,password,role,active?,trainer_id?}` |
| POST | `/admin/:resource` | Tạo plans/trainers/classes/posts |
| PUT | `/admin/:resource/:id` | Cập nhật đầy đủ các trường của plans/trainers/classes/posts |
| DELETE | `/admin/:resource/:id` | Ẩn plans/trainers/posts hoặc hủy classes, giữ lịch sử |
| PATCH | `/admin/users/:id` | Cập nhật các trường `name,email,phone,role,active,trainer_id,password`; trường không gửi được giữ nguyên. Mật khẩu trống không đổi mật khẩu. Không được sửa chính tài khoản đang đăng nhập ở endpoint này |
| POST | `/admin/orders/:id/confirm` | Xác nhận đơn pending, kích hoạt gói |
| PATCH | `/admin/bookings/:id` | `{status: "attended" hoặc "confirmed"}`, chỉ khi lớp đã bắt đầu |
| PATCH | `/admin/contacts/:id` | `{status: "new" hoặc "contacted" hoặc "closed"}` |

Vai trò tài khoản: `admin`, `member`, `trainer`. `trainer_id` bắt buộc khi tạo hoặc chuyển sang tài khoản HLV và phải trỏ tới hồ sơ chưa gắn tài khoản khác. Mỗi hồ sơ HLV có tối đa một tài khoản. Bỏ vai trò trainer sẽ gỡ liên kết tài khoản khỏi hồ sơ, giữ nguyên hồ sơ/lớp. Mỗi lần admin cập nhật tài khoản, các phiên cũ của tài khoản đó bị vô hiệu hóa. Dùng `/me` và `/me/password` để cập nhật chính tài khoản đang đăng nhập.

Danh sách `/admin/users` có thêm `trainer_id`, `trainer_name`, `membership_ends_at`. `/admin/trainers` có thêm `user_id`, `account_email`, `account_active`; các trường liên kết và email đăng nhập không xuất hiện trong API HLV công khai.

Ví dụ tạo tài khoản HLV:

```json
{"name":"Trần Quốc Huy","email":"huy@gymtn.vn","phone":"0901234567","password":"mat_khau_khoi_tao_cua_ban","role":"trainer","active":1,"trainer_id":1}
```

## Huấn luyện viên

Đăng nhập qua `/auth/login`. Các API dưới chỉ chấp nhận người dùng có vai trò trainer và hồ sơ được liên kết.

| Method | Endpoint | Nội dung |
| --- | --- | --- |
| GET | `/trainer/dashboard` | `{profile,classes,bookings}` chỉ trong các lớp được phân công; danh sách hội viên kèm họ tên, email, điện thoại |
| PATCH | `/trainer/bookings/:id` | `{status:"confirmed" hoặc "attended"}`; chỉ lớp của mình, đã bắt đầu và chưa hủy |

HLV dùng `/me` và `/me/password` để cập nhật tài khoản của mình; không được gọi API quản trị.

### Payload gói tập

```json
{
  "name": "Khởi động",
  "tagline": "Bắt đầu một thói quen tốt.",
  "price": 399000,
  "duration_days": 30,
  "features": ["Tập không giới hạn", "Đặt lớp nhóm"],
  "popular": 0,
  "active": 1
}
```

### Payload huấn luyện viên

```json
{
  "name": "Trần Quốc Huy",
  "specialty": "Strength & Conditioning",
  "bio": "Giới thiệu kinh nghiệm và phong cách hướng dẫn.",
  "experience": 6,
  "image": "/images/strength.jpg",
  "active": 1
}
```

### Payload lớp tập

`starts_at` phải ở tương lai. Nếu không có timezone, backend hiểu là UTC+7. Frontend gửi rõ `+07:00`.

```json
{
  "title": "Strength Foundation",
  "category": "Strength",
  "trainer_id": 1,
  "starts_at": "2026-12-20T17:00:00+07:00",
  "duration_minutes": 60,
  "capacity": 12,
  "room": "Weight Zone",
  "level": "Người mới",
  "description": "Có mặt trước 10 phút để chuẩn bị."
}
```

### Payload bài viết

```json
{
  "title": "Buổi đầu đến gym: bắt đầu từ đâu?",
  "category": "Tập luyện",
  "excerpt": "Gợi ý để bắt đầu buổi tập đầu tiên.",
  "content": "Đoạn nội dung thứ nhất.\n\nĐoạn nội dung tiếp theo.",
  "image": "/images/gym.jpg",
  "published": 1
}
```

Các danh sách API hiện trả toàn bộ bản ghi; phân trang/tìm kiếm quản trị được thực hiện ở frontend. Khi có lượng dữ liệu lớn cần bổ sung phân trang và truy vấn lọc tại server.
