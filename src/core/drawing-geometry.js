// Pure stroke math shared by the editor's canvas and the published-note
// reader. Everything here takes explicit arguments; the editor keeps thin
// wrappers that fill in its DOM-derived defaults. Keeping one copy is what
// stops a published note from rendering its drawings differently than the
// editor that made it.
export const MIN_DRAW_SIZE = 0.08;
export const MAX_DRAW_SIZE = 1.4;
export const DEFAULT_DRAW_SIZE = 4 / 18;
export const DEFAULT_FONT_SIZE = 40;

export function getNormalizedFontSize(fontSize, fallback = DEFAULT_FONT_SIZE) {
  const parsedFontSize = Number(fontSize);
  return Number.isFinite(parsedFontSize) && parsedFontSize > 0 ? parsedFontSize : fallback;
}

export function clampBrushSize(size, fallback = DEFAULT_DRAW_SIZE) {
  const parsedSize = Number(size);

  if (!Number.isFinite(parsedSize)) {
    return fallback;
  }

  return Math.min(MAX_DRAW_SIZE, Math.max(MIN_DRAW_SIZE, parsedSize));
}

export function normalizeStoredPoint(point = {}) {
  const x = Number(point?.x);
  const y = Number(point?.y);

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0
  };
}

export function getStrokeReferenceFontSize(stroke = {}, fallbackFontSize = DEFAULT_FONT_SIZE) {
  return getNormalizedFontSize(stroke.referenceFontSize ?? stroke.fontSize ?? fallbackFontSize, fallbackFontSize);
}

// Strokes are stored in the board pixels of the session that drew them, tagged
// with the font size in use at the time. `scale` is an extra multiplier the
// reader uses when the viewing board is narrower than the published one.
export function convertPointToCanvasPixels(point, referenceFontSize, fontSize, scale = 1) {
  const normalizedReferenceFontSize = getNormalizedFontSize(referenceFontSize);
  const normalizedFontSize = getNormalizedFontSize(fontSize);
  const normalizedPoint = normalizeStoredPoint(point);
  const normalizedScale = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
  const scaleFactor = (normalizedFontSize / normalizedReferenceFontSize) * normalizedScale;

  return {
    x: normalizedPoint.x * scaleFactor,
    y: normalizedPoint.y * scaleFactor
  };
}

export function getBrushSizeInPixels(size, fontSize, scale = 1) {
  const normalizedScale = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
  return Math.max(1, clampBrushSize(size) * getNormalizedFontSize(fontSize) * normalizedScale);
}

// Draws one stored stroke onto a 2D context whose transform is already set for
// device pixel ratio. Used by the reader; the editor has its own incremental
// path because it paints while the pointer is still moving.
export function paintStroke(context, stroke, { fontSize = DEFAULT_FONT_SIZE, scale = 1 } = {}) {
  if (!context || !stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) return;

  const referenceFontSize = getStrokeReferenceFontSize(stroke, fontSize);
  const points = stroke.points.map(point => convertPointToCanvasPixels(point, referenceFontSize, fontSize, scale));
  const [startPoint, ...tailPoints] = points;
  const isEraserStroke = stroke.tool === 'eraser';

  context.save();
  context.globalCompositeOperation = isEraserStroke ? 'destination-out' : 'source-over';
  context.strokeStyle = isEraserStroke ? '#000000' : (stroke.color || '#000000');
  context.lineWidth = getBrushSizeInPixels(stroke.width, fontSize, scale);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(startPoint.x, startPoint.y);

  if (tailPoints.length === 0) {
    // Single-point stroke — nudge a hair so a dot renders.
    context.lineTo(startPoint.x + 0.01, startPoint.y + 0.01);
  } else {
    tailPoints.forEach(point => context.lineTo(point.x, point.y));
  }

  context.stroke();
  context.restore();
}
