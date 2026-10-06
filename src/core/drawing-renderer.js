import {
  getNormalizedFontSize,
  getBrushSizeInPixels,
  getStrokeReferenceFontSize,
} from "./drawing-geometry.js";

export function strokePoints(
  stroke,
  {
    fontSize = 40,
    lineHeight = 1.6,
    paddingX = 0,
    paddingY = 0,
    anchorBox,
    scale = 1,
  } = {},
) {
  const ratio =
    getNormalizedFontSize(fontSize) /
    getStrokeReferenceFontSize(stroke, fontSize);
  const originX = stroke.referencePaddingX ?? paddingX;
  const originY = stroke.referencePaddingY ?? (paddingY ? 48 : 0);
  const yRatio =
    ratio *
    (stroke.referenceLineHeight ? lineHeight / stroke.referenceLineHeight : 1);
  const referenceBox = stroke.anchor?.box;
  if (anchorBox && referenceBox) {
    const xScale =
      referenceBox.width > 0 ? anchorBox.width / referenceBox.width : ratio;
    const yScale =
      referenceBox.height > 0 ? anchorBox.height / referenceBox.height : ratio;
    return stroke.points.map((point) => ({
      ...point,
      x: (anchorBox.x + (point.x - referenceBox.x) * xScale) * scale,
      y: (anchorBox.y + (point.y - referenceBox.y) * yScale) * scale,
    }));
  }
  return (stroke.points || []).map((point) => ({
    ...point,
    x: (paddingX + (point.x - originX) * ratio) * scale,
    y: (paddingY + (point.y - originY) * yRatio) * scale,
  }));
}

export function strokeBounds(stroke, options = {}) {
  const points = strokePoints(stroke, options);
  const radius =
    getBrushSizeInPixels(
      stroke.width,
      options.fontSize ?? 40,
      options.scale ?? 1,
    ) /
      2 +
    2;
  if (!points.length) return null;
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const point of points) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }
  return {
    left: left - radius,
    top: top - radius,
    right: right + radius,
    bottom: bottom + radius,
  };
}

function isCorner(a, b, c) {
  const ux = b.x - a.x,
    uy = b.y - a.y,
    vx = c.x - b.x,
    vy = c.y - b.y;
  const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  return length > 0 && (ux * vx + uy * vy) / length < 0.35;
}

export function traceStroke(context, points, smooth, continuePath = false) {
  const first = points[0];
  if (!first) return;
  if (continuePath) context.lineTo(first.x, first.y);
  else context.moveTo(first.x, first.y);
  if (
    points.every(
      (point) =>
        Math.hypot(point.x - points[0].x, point.y - points[0].y) < 0.01,
    )
  ) {
    context.lineTo(first.x + 0.01, first.y + 0.01);
    return;
  }
  if (!smooth || points.length < 3) {
    for (const p of points.slice(1)) context.lineTo(p.x, p.y);
    return;
  }
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i],
      next = points[i + 1];
    if (isCorner(points[i - 1], p, next)) context.lineTo(p.x, p.y);
    else
      context.quadraticCurveTo(
        p.x,
        p.y,
        (p.x + next.x) / 2,
        (p.y + next.y) / 2,
      );
  }
  const last = points.at(-1);
  context.lineTo(last.x, last.y);
}

function paintPressure(context, points, width) {
  if (
    points.every(
      (point) =>
        Math.hypot(point.x - points[0].x, point.y - points[0].y) < 0.01,
    )
  ) {
    const pressure = points.reduce(
      (maximum, point) => Math.max(maximum, point.pressure ?? 0.5),
      0,
    );
    context.arc(
      points[0].x,
      points[0].y,
      (width * (0.2 + 0.8 * Math.sqrt(Math.max(0, Math.min(1, pressure))))) / 2,
      0,
      Math.PI * 2,
    );
    context.fill();
    return;
  }
  const left = [],
    right = [],
    radii = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      prev = points[Math.max(0, i - 1)],
      next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x,
      dy = next.y - prev.y,
      length = Math.hypot(dx, dy) || 1;
    const pressure =
      ((prev.pressure ?? 0.5) + (p.pressure ?? 0.5) + (next.pressure ?? 0.5)) /
      3;
    const r =
      (width * (0.2 + 0.8 * Math.sqrt(Math.max(0, Math.min(1, pressure))))) / 2;
    radii.push(r);
    left.push({ x: p.x - (dy / length) * r, y: p.y + (dx / length) * r });
    right.push({ x: p.x + (dy / length) * r, y: p.y - (dx / length) * r });
  }
  traceStroke(context, left, true);
  traceStroke(context, right.reverse(), true, true);
  context.closePath();
  for (const index of [0, points.length - 1]) {
    const point = points[index],
      r = radii[index];
    context.moveTo(point.x + r, point.y);
    context.arc(point.x, point.y, r, 0, Math.PI * 2, true);
  }
  context.fill();
}

export function renderStroke(context, stroke, options = {}) {
  if (!context || !stroke?.points?.length) return;
  const points = strokePoints(stroke, options);
  context.save();
  context.globalCompositeOperation =
    stroke.tool === "eraser" ? "destination-out" : "source-over";
  context.globalAlpha = stroke.tool === "marker" ? (stroke.opacity ?? 0.25) : 1;
  context.strokeStyle = context.fillStyle = stroke.color || "#DDDAD2";
  context.lineWidth = getBrushSizeInPixels(
    stroke.width,
    options.fontSize ?? 40,
    options.scale ?? 1,
  );
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  if (stroke.tool === "pen") paintPressure(context, points, context.lineWidth);
  else {
    traceStroke(context, points, stroke.renderer === "smooth-v1");
    context.stroke();
  }
  context.restore();
}

export function hitStroke(stroke, point, options = {}, tolerance = 8) {
  if (stroke.tool === "eraser") return false;
  const points = strokePoints(stroke, options);
  const radius =
    getBrushSizeInPixels(stroke.width, options.fontSize ?? 40) / 2 + tolerance;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[i + 1] || a,
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = dx * dx + dy * dy;
    const t = length
      ? Math.max(
          0,
          Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length),
        )
      : 0;
    if (Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) <= radius)
      return true;
  }
  return false;
}

export function moveStroke(stroke, dx, dy, options = {}) {
  const points = strokePoints(stroke, options).map((p) => ({
    ...p,
    x: p.x + dx,
    y: p.y + dy,
  }));
  return {
    ...stroke,
    points,
    anchor: undefined,
    referenceFontSize: options.fontSize ?? 40,
    referenceLineHeight: options.lineHeight ?? 1.6,
    referencePaddingX: options.paddingX ?? 0,
    referencePaddingY: options.paddingY ?? 0,
  };
}
