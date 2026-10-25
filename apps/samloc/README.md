# Sâm Lốc Cyper — Trang chủ

Màn hình Home của game Sâm Lốc Cyper, dựng theo ảnh mẫu của Tony.

- Chỉ 1 file `index.html` (HTML/CSS thuần, không ảnh ngoài, không build step).
- Chỉ dùng cho điện thoại xoay ngang: cầm dọc sẽ hiện nhắc xoay máy.
- Kích thước ăn theo chiều cao màn hình (vh) + `clamp()` để không tràn trên máy nhỏ.
- Các nút hiện chỉ hiện thông báo demo (CHƠI NGAY, CHƠI VỚI BẠN, CHỌN BÀN, SPIN...).
  Logic vào bàn / tài khoản / xu thật là bước tiếp theo, chưa nối vào đây.

## Deploy

Vercel: import repo này, Root Directory để trống (mặc định), Framework = Other,
không cần Build Command — Vercel serve thẳng `index.html` dạng static site.
