"use client";

// Utilities that make MindAR image targets actually trackable. MindAR (like
// every corner/feature tracker) needs: high contrast, lots of sharp edges,
// little blank space, ~1000px+ resolution. Product-style photos (subject on a
// plain background) have almost none of that, so they silently fail to lock.
// This module grades images before compile, boosts weak ones with contrast
// stretching, and — like printed AR posters — wraps each target in a
// high-frequency checkerboard frame that carries detection features regardless
// of the photo content. `buildArCard` additionally produces a printable
// 4:3 "test card" (the Snapchat-code equivalent) that is guaranteed to track.

export interface TargetAnalysis {
  /** 0..1 edge-energy score. 0 = blank, ~1 = dense texture. */
  score: number;
  label: "poor" | "ok" | "strong";
  width: number;
  height: number;
}

const MAX_TRACK_WIDTH = 1400;
const FRAME_RATIO = 0.07;

// Load a remote/static image with CORS permission so the MindAR compiler can
// read its pixels.
export function loadTargetImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

// Edge-energy analysis: downsample to 96x96 grayscale and measure the RMS of
// local intensity differences. Mirrors what ImageMagick's Sobel stddev shows:
// bottle=0.30, mouse=0.24, a checkerboard pattern ≈0.5+, a blank wall ≈0.02.
export function analyzeImage(img: HTMLImageElement): TargetAnalysis {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { score: 0, label: "poor", width: 0, height: 0 };
  ctx.drawImage(img, 0, 0, 96, 96);
  const d = ctx.getImageData(0, 0, 96, 96);
  const n = 96;
  let sum = 0;
  let count = 0;
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const i = (y * n + x) * 4;
      const g = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
      const gi = (y * n + x + 1) * 4;
      const gj = ((y + 1) * n + x) * 4;
      const gr =
        0.299 * d.data[gi] + 0.587 * d.data[gi + 1] + 0.114 * d.data[gi + 2];
      const gb =
        0.299 * d.data[gj] + 0.587 * d.data[gj + 1] + 0.114 * d.data[gj + 2];
      const dx = gr - g;
      const dy = gb - g;
      sum += dx * dx + dy * dy;
      count += 1;
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, count));
  // Heuristic scale: RMS of 0..~0.9 in 0..255 units, so score = rms / 90.
  const score = Math.min(1, rms / 90);
  const label: TargetAnalysis["label"] =
    score < 0.15 ? "poor" : score < 0.35 ? "ok" : "strong";
  return { score, label, width: img.naturalWidth, height: img.naturalHeight };
}

// Contrast stretch: clip the histogram at 1%/99% and remap each channel, so a
// dull photo becomes full-range. Then cap width so the compiler works with a
// ~1400px input (plenty for tracking, fast to compile).
function stretchAndResize(img: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(1, MAX_TRACK_WIDTH / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return c;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  const data = d.data;

  const lo = new Uint8ClampedArray(3).fill(255);
  const hi = new Uint8ClampedArray(3).fill(0);
  const hist: number[][] = [new Float32Array(256), new Float32Array(256), new Float32Array(256)];
  for (let i = 0; i < data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const v = data[i + ch];
      hist[ch][v] += 1;
      if (v < lo[ch]) lo[ch] = v;
      if (v > hi[ch]) hi[ch] = v;
    }
  }
  const pixels = data.length / 4;
  for (let ch = 0; ch < 3; ch++) {
    const clip = pixels * 0.01;
    let acc = 0;
    let lowIdx = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[ch][v];
      if (acc >= clip) {
        lowIdx = v;
        break;
      }
    }
    acc = 0;
    let highIdx = 255;
    for (let v = 255; v >= 0; v--) {
      acc += hist[ch][v];
      if (acc >= clip) {
        highIdx = v;
        break;
      }
    }
    lo[ch] = lowIdx;
    hi[ch] = Math.max(lowIdx + 1, highIdx);
  }

  for (let i = 0; i < data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const v = data[i + ch];
      const t = Math.min(1, Math.max(0, (v - lo[ch]) / (hi[ch] - lo[ch])));
      data[i + ch] = Math.round(t * 255);
    }
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

// Final tracking target: stretched image + optional checkerboard frame that
// guarantees edge features right up to the border (see module doc).
export function enhanceForTracking(
  img: HTMLImageElement,
  opts?: { frame?: boolean }
): HTMLCanvasElement {
  const base = stretchAndResize(img);
  const w = base.width;
  const h = base.height;
  const frame = opts?.frame ?? true;
  if (!frame) return base;

  const pad = Math.max(48, Math.round(Math.min(w, h) * FRAME_RATIO));
  const cell = Math.max(10, Math.round(pad / 3));
  const c = document.createElement("canvas");
  c.width = w + pad * 2;
  c.height = h + pad * 2;
  const ctx = c.getContext("2d");
  if (!ctx) return base;

  for (let y = 0; y < c.height; y += cell) {
    for (let x = 0; x < c.width; x += cell) {
      ctx.fillStyle = ((x / cell) + (y / cell)) % 2 === 0 ? "#0c0c0c" : "#f5f5f5";
      ctx.fillRect(x, y, cell, cell);
    }
  }
  ctx.fillStyle = "#0c0c0c";
  ctx.fillRect(pad - 3, pad - 3, w + 6, h + 6);
  ctx.drawImage(base, pad, pad);
  return c;
}

export function canvasToImageEl(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode enhanced target"));
    img.src = canvas.toDataURL("image/jpeg", 0.9);
  });
}

// Download helper for admin-generated cards.
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Printable 4:3 AR card (1800x1350): thin black frame + checker band + the
// enhanced target + a bold label. Display the printed card in front of the
// camera and it will lock — same idea as Snapchat codes.
export async function buildArCard(
  img: HTMLImageElement,
  name: string
): Promise<Blob> {
  const target = enhanceForTracking(img, { frame: true });
  const W = 1800;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no canvas context");

  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#0c0c0c";
  ctx.lineWidth = 14;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  const bandH = 96;
  const bandY = 120;
  const cell = 32;
  for (let y = bandY; y < bandY + bandH; y += cell) {
    for (let x = 130; x < W - 130; x += cell) {
      ctx.fillStyle = ((x - 130) / cell + (y - bandY) / cell) % 2 === 0 ? "#0c0c0c" : "#f5f5f5";
      ctx.fillRect(x, y, cell, cell);
    }
  }

  const scale = Math.min((W - 360) / target.width, (H - 600) / target.height);
  const tw = Math.round(target.width * scale);
  const th = Math.round(target.height * scale);
  const tx = Math.round((W - tw) / 2);
  const ty = bandY + bandH + 36;
  ctx.fillStyle = "#0c0c0c";
  ctx.fillRect(tx - 10, ty - 10, tw + 20, th + 20);
  ctx.drawImage(target, tx, ty, tw, th);

  ctx.fillStyle = "#0c0c0c";
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name.slice(0, 40), W / 2, H - 150);

  return await new Promise<Blob>((resolve, reject) => {
    c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("card export failed"))), "image/png");
  });
}