# Bảng biến thể luật Tấn — giả định và cấu hình VN_8_V1

Luật Tấn Việt Nam không có một bản duy nhất. Bảng dưới ghi rõ: biến thể nào
khác nhau, VN_8_V1 chọn gì, và cấu hình nào cho phép đổi mà không sửa code
luật. Không tự khẳng định một biến thể là luật duy nhất.

| # | Điểm khác nhau giữa các biến thể | Mặc định VN_8_V1 (đã chốt) | Cấu hình |
|---|----------------------------------|-----------------------------|----------|
| V1 | Số lá chia ban đầu | 8 lá | `handSize: 8` |
| V2 | Số người/bàn | 2–4, ưu tiên 4 | `playerCount: 2..4` |
| V3 | Cách chọn người tấn đầu | Người giữ lá chủ nhỏ nhất; nếu không ai có chủ thì người đầu tiên | cố định ở v1, ghi log khi rơi vào nhánh “không ai có chủ” |
| V4 | Ai được thêm bài | Người tấn chính + mọi người chơi khác trừ người đỡ | `allowAddFromAllNonDefenders: true` |
| V5 | Giới hạn quân tấn/đợt | min(số lá người đỡ có khi đợt bắt đầu, 6) | `maxAttackCards: 6` |
| V6 | Chuyển tấn | Bật, chỉ khi người đỡ chưa đỡ lá nào, lá chuyển cùng hạng lá tấn, người mới đủ bài | `allowTransfer: true` (bật/tắt theo phòng) |
| V7 | Thêm bài sau khi người đỡ tuyên bố nhận | V1: KHÔNG — nhận là thu bàn ngay. Giai đoạn bổ sung sau nhận là tính năng mở rộng, phải thiết kế state ADDING_AFTER_TAKE riêng trước khi bật | `allowAddAfterTake: false` (mặc định, chưa implement) |
| V8 | Thứ tự bốc bài | Tấn chính -> người thêm bài theo ghế -> người đỡ cuối (khi đỡ thành công). Khi nhận bài: tấn chính + người thêm bài bốc, người đỡ KHÔNG bốc (vừa nhận cả bàn) | cố định ở v1 |
| V9 | Lượt tấn sau khi nhận bài | Người sau người đỡ tấn tiếp (người nhận mất quyền tấn lượt kế) | cố định ở v1 |
| V10 | Người hết bài giữa đợt | Chưa tính hoàn thành cho tới khi đợt giải quyết xong (finish/take) và nọc đã hết; nếu nọc còn thì họ đã được bốc bù | cố định ở v1 |
| V11 | Nhiều người hết bài cùng đợt | Tất cả đều ghi vào finishOrder theo thứ tự ghế, người cuối cùng còn bài là người thua; nếu cùng hết sạch thì loser = null và cần quy định hòa ở tầng kết quả (chưa xảy ra trong test hiện tại, ghi rõ là edge case mở) | ghi log, chưa có test hòa |
| V12 | Timeout | 30s/lượt. Đỡ hết giờ -> nhận bài. Tấn/thêm hết giờ -> pass nếu đã có ít nhất 1 lá tấn hợp lệ, nếu chưa có lá nào thì tự đánh lá thấp nhất (chính sách bot demo; server thật phải cấu hình AFK policy trước khi bật) | `turnTimeoutSeconds: 30` |
| V13 | Mất kết nối / rời phòng | Giữ chỗ 60s để reconnect; quá hạn thì áp dụng AFK/forfeit, không treo phòng | `reconnectSeconds: 60` (tầng game-server, chưa implement) |

## Ví dụ kiểm chứng (chủ ♥)
- 8♠ đỡ bằng 10♠: hợp lệ. A♠ đỡ bằng 2♥: hợp lệ (chủ đỡ lá không chủ).
- J♥ đỡ bằng Q♥: hợp lệ. J♥ đỡ bằng 8♥: KHÔNG hợp lệ.
- Tấn 8♠, đỡ bằng J♠ -> được thêm 8 hoặc J, không được thêm hạng khác.
- Tấn 9♣, người đỡ có 9♦, chưa đỡ lá nào -> chuyển sang người kế tiếp,
  người mới phải đỡ cả 9♣ và 9♦.
