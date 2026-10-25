import { useEffect, useState, type ReactNode } from "react";

// Chế độ "desktop": giao diện luôn vẽ ở khung cố định 1280x720, không
// xếp lại theo màn hình. Màn hình nhỏ hơn thì cả khung tự thu nhỏ theo
// tỉ lệ (giống mở web máy tính trên điện thoại), màn hình lớn hơn thì
// phóng to lên cho vừa, vị trí các nút/bài/avatar không đổi.
const W = 1280, H = 720;
export default function ScaleStage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#1b3a1b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: W, height: H, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: "center center", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}
