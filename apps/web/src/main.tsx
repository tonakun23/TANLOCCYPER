import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import RotateGate from "./components/RotateGate";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(<RotateGate><App /></RotateGate>);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* PWA SW là tùy chọn, app vẫn chạy không cần nó */ });
  });
}
