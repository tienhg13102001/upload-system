# uploadfile-api

Express API nhận file upload, lưu vào NAS và trả về URL public của file. Đóng gói bằng Docker để chạy trên Synology/Xpenology (Container Manager).

## API

| Method | Endpoint           | Mô tả                                   |
| ------ | ------------------ | --------------------------------------- |
| GET    | `/health`          | Kiểm tra sống                           |
| POST   | `/upload`          | Upload 1 file, field `file`             |
| POST   | `/upload/multiple` | Upload nhiều file, field `files` (≤20)  |
| GET    | `/files/<tên>`     | Tải file đã upload (public)             |

Tất cả endpoint upload yêu cầu header `x-api-key` (nếu `API_KEY` được đặt).

### Ví dụ

```bash
# Upload
curl -H "x-api-key: <API_KEY>" -F "file=@anh.jpg" https://yumest.synology.me:8080/upload

# Kết quả
{
  "filename": "a1b2...e.jpg",
  "originalName": "anh.jpg",
  "size": 12345,
  "mimeType": "image/jpeg",
  "url": "https://yumest.synology.me:8080/files/a1b2...e.jpg"
}
```

Từ ứng dụng khác (vd ExpressJS gọi sang), chỉ cần POST multipart/form-data với field `file` kèm header `x-api-key`, rồi lấy `url` trong response.

## Biến môi trường

| Biến              | Mặc định            | Ý nghĩa                                              |
| ----------------- | ------------------- | --------------------------------------------------- |
| `PORT`            | `3000`              | Port lắng nghe trong container                       |
| `UPLOAD_DIR`      | `./uploads`         | Thư mục lưu file (mount volume vào đây)              |
| `PUBLIC_BASE_URL` | tự suy ra từ request| URL gốc để dựng link, vd `https://yumest.synology.me:8080` |
| `API_KEY`         | (trống)             | Khóa bảo vệ upload. Để trống = endpoint mở (chỉ test)|
| `MAX_FILE_MB`     | `50`                | Giới hạn dung lượng mỗi file (MB)                    |

## Chạy local

```bash
npm install
cp .env.example .env   # rồi sửa giá trị
API_KEY=test123 npm start
```

## Deploy lên Synology / Xpenology (Container Manager)

1. Tạo shared folder để lưu file, ví dụ `/volume1/docker/uploadfile/uploads`.
2. Copy toàn bộ thư mục project này lên NAS (File Station hoặc git).
3. Trong `docker-compose.yml`, sửa:
   - `ports`: `"8080:3000"` → đổi `8080` thành port bạn muốn mở.
   - `PUBLIC_BASE_URL` → trỏ đúng domain + port (vd `https://yumest.synology.me:8080`).
   - `API_KEY` → chuỗi bí mật của bạn.
   - `volumes` → `/volume1/docker/uploadfile/uploads:/data/uploads`.
4. Container Manager → Project → Create → chọn thư mục chứa `docker-compose.yml` → Build & Run.

> Lưu ý port: Synology DSM đang dùng 5000/5001. Chọn port khác (vd 8080) và mở trong
> Control Panel → Security → Firewall nếu có bật firewall. Nếu muốn dùng HTTPS với domain
> `yumest.synology.me`, đặt Reverse Proxy trong Control Panel → Login Portal → Advanced
> trỏ về `localhost:8080`, khi đó `PUBLIC_BASE_URL` để là domain không kèm port.
