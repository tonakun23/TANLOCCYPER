import { useEffect, useState, type ReactNode } from "react";
import { RotateCw } from "lucide-react";

// Điện thoại cầm dọc thì chặn bằng cổng xoay ngang: game chỉ chơi ngang, full màn hình.
// - Android Chrome: nút bấm sẽ xin full màn hình + khóa xoay ngang, máy tự xoay luôn.
// - iOS không cho khóa xoay bằng code, nên nút bấm không xoay được thì hiện dòng nhắc xoay tay.
// - Máy tính / máy đã xoay ngang thì không hiện cổng này.
export default function RotateGate({ children }: { children: ReactNode }) {
  const [portraitMobile, setPortraitMobile] = useState(false);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    const update = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setPortraitMobile(coarse && window.innerHeight > window.innerWidth);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("orientationchange", update); };
  }, []);
  const rotate = async () => {
    setTried(true);
    try { await document.documentElement.requestFullscreen?.(); } catch { /* bỏ qua */ }
    try {
      const o = screen.orientation as unknown as { lock?: (v: string) => Promise<void> };
      await o.lock?.("landscape");
    } catch { /* iOS / trình duyệt không cho khóa xoay: nhắc xoay tay bên dưới */ }
  };
  return (
    <>
      {children}
      {portraitMobile && (
        <div className="fixed inset-0 z-[100] bg-red-950 text-white flex flex-col items-center justify-center gap-4 p-6 text-center">
          <RotateCw size={64} className="text-yellow-400" />
          <h2 className="text-2xl font-black">Xoay ngang điện thoại để chơi</h2>
          <p className="text-white/80 max-w-sm">Game Tấn chơi ngang, full màn hình. Xoay ngang điện thoại là vào ván ngay, không còn khoảng trống 2 bên.</p>
          <button className="bg-yellow-400 text-black font-black px-8 py-3 rounded-full text-lg" onClick={rotate}>Xoay ngang &amp; Full màn hình</button>
          {tried && <p className="text-yellow-200 text-sm">Nếu máy chưa tự xoay, vui lòng xoay ngang điện thoại bằng tay (iPhone không cho app tự khóa xoay).</p>}
        </div>
      )}
    </>
  );
}
