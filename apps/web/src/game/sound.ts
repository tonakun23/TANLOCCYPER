// Âm thanh tổng hợp bằng Web Audio, không cần file ngoài.
// - Phát bài (chia bài): loạt tiếng xào nhẹ.
// - Ra lá: tiếng "tách" khi lá chạm bàn.
let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.7;
function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
export function setSoundEnabled(v: boolean) { enabled = v; }
export function setSoundVolume(v: number) { volume = Math.max(0, Math.min(1, v)); }
export function isSoundEnabled() { return enabled; }
function click(freq: number, dur: number, gain: number, delay = 0) {
  const c = ac(); if (!c || !enabled) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator(); const g = c.createGain();
  osc.type = "triangle"; osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain * volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g); g.connect(c.destination);
  osc.start(t); osc.stop(t + dur + 0.02);
}
function noise(dur: number, gain: number, delay = 0) {
  const c = ac(); if (!c || !enabled) return;
  const t = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain(); g.gain.setValueAtTime(gain * volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const filter = c.createBiquadFilter(); filter.type = "highpass"; filter.frequency.value = 1200;
  src.connect(filter); filter.connect(g); g.connect(c.destination);
  src.start(t);
}
export function playDealSound() {
  // Xào bài: 4 tiếng xẹt nhanh liên tiếp.
  for (let i = 0; i < 4; i++) noise(0.09, 0.5, i * 0.09);
  click(900, 0.06, 0.3, 0.4);
}
export function playCardSound() {
  // Lá chạm bàn: tách + xẹt nhẹ.
  noise(0.05, 0.6); click(1400, 0.05, 0.4, 0.01);
}
export function playDrawSound() { noise(0.07, 0.45); click(700, 0.05, 0.25, 0.05); }
