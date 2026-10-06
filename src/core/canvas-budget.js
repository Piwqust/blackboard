// Bound GPU/bitmap allocation independently of the note's logical dimensions.
export function canvasBackingSize(width, height, dpr = 1) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const ratio = Math.min(Math.max(1, Number(dpr) || 1), 8192 / w, 8192 / h, Math.sqrt(8_000_000 / (w * h)));
  const pixelWidth = Math.max(1, Math.floor(w * ratio));
  const pixelHeight = Math.max(1, Math.floor(h * ratio));
  return { width: pixelWidth, height: pixelHeight, scaleX: pixelWidth / w, scaleY: pixelHeight / h };
}
