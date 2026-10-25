# Tổng quan game Tấn Online và luật chơi

## 1. Giới thiệu game

Tấn Online là trò chơi bài chiến thuật nhiều người chơi trực tuyến, phát triển
trên nền tảng Web, chơi trực tiếp trên trình duyệt máy tính hoặc điện thoại mà
không cần cài đặt ứng dụng. Giao diện mang phong cách game bài truyền thống:
tông đỏ đô, vàng kim, hiệu ứng chia bài và hoạt ảnh tương tác.

Game dựa trên luật bài Tấn truyền thống của Việt Nam, dùng bộ bài Tây 52 lá.
Mỗi bàn 2–4 người, mỗi người chia 8 lá ban đầu. Người chơi lần lượt tấn, đỡ,
thêm bài, chuyển tấn (nếu phòng cho phép) và bốc bài. Mục tiêu là đánh hết bài
trên tay. Khi bộ bài bốc đã hết, người cuối cùng còn bài là người thua.

Chế độ chơi: Chơi ngay (ghép bàn tự động), Chơi với bạn (tạo phòng riêng, chia
sẻ mã phòng), Phòng công khai, và Chơi với máy ở giai đoạn mở rộng.

## 2. Luật chơi

### 2.1 Bộ bài và số người
- 52 lá, không Joker. Hạng: 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A.
- 2–4 người/bàn, mỗi người 8 lá.
- Lật 1 lá từ nọc để xác định chất chủ (Cơ, Rô, Chuồn, Bích). Lá đó vẫn nằm trong nọc.

### 2.2 Chất chủ
Chất chủ mạnh hơn các chất khác. Ví dụ chủ là ♥: lá ♥ bất kỳ đỡ được lá không
phải ♥ kể cả khi hạng thấp hơn; nhưng lá tấn là ♥ thì chỉ lá ♥ lớn hơn mới đỡ được.

### 2.3 Tấn
Người tấn đánh 1 lá xuống bàn. Sau đó, người được phép tấn chỉ được thêm lá
cùng hạng với lá đã xuất hiện trên bàn. Số quân tấn không vượt số lá người đỡ
có khi đợt bắt đầu, tối đa 6 lá.

### 2.4 Đỡ
- Cùng chất, hạng lớn hơn. Ví dụ: 8♠ đỡ bằng J♠; 10♦ đỡ bằng K♦.
- Dùng chất chủ. Ví dụ chủ ♥: A♠ đỡ bằng 2♥; K♣ đỡ bằng 7♥; J♥ chỉ đỡ bằng Q♥/K♥/A♥.
- Không có bài phù hợp hoặc không muốn đỡ → chọn nhận bài.

### 2.5 Thêm bài
Chỉ thêm lá có hạng đã xuất hiện trên bàn. Ví dụ tấn 8♠, đỡ bằng J♠ → được
thêm các lá 8 hoặc J, không được thêm hạng chưa xuất hiện.

### 2.6 Chuyển tấn
Nếu phòng bật: người đỡ chưa đỡ lá nào, đánh lá cùng hạng với lá tấn để chuyển
sang người kế tiếp còn chơi. Người mới phải đỡ tất cả các lá, với điều kiện đủ bài.

### 2.7 Nhận bài
Không đỡ hết → nhận toàn bộ bài trên bàn (cả lá đã tấn và đã đỡ). Đợt kết thúc
sau bước thêm bài cho phép. Người nhận mất quyền tấn ở lượt kế tiếp.

### 2.8 Bốc bài
Sau mỗi đợt, bốc tối đa 8 lá theo thứ tự: tấn chính → người thêm bài → người đỡ.
Nọc hết thì chỉ bốc số còn lại; hết nọc thì đánh bằng bài trên tay.

### 2.9 Kết thúc ván
Hết nọc, người hết bài lần lượt hoàn thành. Người cuối cùng còn bài là người thua.
Trường hợp nhiều người hết bài cùng lúc áp dụng quy định đã cấu hình trước ván.

## 3. Nguyên tắc online (bắt buộc khi làm server)

- Server quyết định mọi nước đi hợp lệ. Client chỉ gửi yêu cầu.
- Không gửi bài kín của người khác xuống client — chỉ gửi `publicView` + `privateHand` của chính mình.
- Mỗi hành động có `actionId` chống xử lý trùng và `expectedVersion` chống state cũ.
- Mất mạng: giữ chỗ, cho kết nối lại trong thời gian quy định; hết giờ thì áp
  dụng hành động mặc định hợp lệ (đỡ hết giờ → nhận bài; tấn hết giờ → kết thúc đợt nếu hợp lệ).
- Xu chỉ là điểm thưởng trong game, không nạp/rút/đổi tiền thật ở bản đầu.
