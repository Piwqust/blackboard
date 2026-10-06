import { renderStroke, strokeBounds } from "../core/drawing-renderer.js";
import { canvasBackingSize } from "../core/canvas-budget.js";
import { sanitizeStoredContent } from "../core/sanitize-html.js";
import { anchorBox } from "./text-anchors.js";

function base64(bytes) {
  let result = "";
  for (let i = 0; i < bytes.length; i += 16384)
    result += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(result);
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
function filename(page) {
  return (page.title || "Blackboard note")
    .replace(/[\\/:*?"<>|]/g, "_")
    .slice(0, 80);
}
const fontFiles = [
  ["Inter Tight", "InterTight-Variable.ttf", "truetype"],
  ["Inter", "InterVariable.woff2", "woff2"],
  ["BoardGrotesque Sans", "BoardGrotesqueSans-Regular.otf", "opentype"],
];

export async function preparePageExport(
  page,
  settings,
  { boardWidth = 1200, paddingX = 48 } = {},
) {
  const width = Math.max(240, Math.min(2400, Math.round(boardWidth)));
  const surface = document.createElement("div");
  surface.style.cssText =
    "position:fixed;left:-100000px;top:0;pointer-events:none;";
  surface.setAttribute("aria-hidden", "true");
  const note = document.createElement("div");
  note.className = "export-note-content";
  note.style.cssText =
    "box-sizing:border-box;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:6;margin:0;";
  Object.assign(note.style, {
    width: Math.min(width, settings.maxWidth || width) + "px",
    padding: "48px " + paddingX + "px 48px",
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize + "px",
    lineHeight: String(settings.lineHeight),
    letterSpacing: settings.letterSpacing + "em",
    color: settings.textColor,
    backgroundColor: settings.backgroundColor,
  });
  note.innerHTML = sanitizeStoredContent(page.content);
  surface.append(note);
  document.body.append(surface);
  try {
    await document.fonts.ready;
    const options = (stroke) => ({
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      paddingX,
      paddingY: 48,
      ...(stroke.anchor
        ? { anchorBox: anchorBox(note, note, stroke.anchor) }
        : {}),
    });
    let height = Math.max(1, Math.ceil(note.getBoundingClientRect().height));
    for (const stroke of page.drawings || [])
      height = Math.max(
        height,
        Math.ceil((strokeBounds(stroke, options(stroke))?.bottom || 0) + 48),
      );
    let fonts = "*{margin:0;padding:0;box-sizing:border-box}";
    const selected = fontFiles.find(([family]) =>
      settings.fontFamily.includes(family),
    );
    if (selected) {
      const [family, file, format] = selected,
        response = await fetch(new URL("../../fonts/" + file, import.meta.url));
      if (!response.ok)
        throw new Error("The note font could not be loaded for export.");
      fonts +=
        '@font-face{font-family:"' +
        family +
        '";src:url(data:font/' +
        (format === "woff2" ? "woff2" : "ttf") +
        ";base64," +
        base64(new Uint8Array(await response.arrayBuffer())) +
        ') format("' +
        format +
        '");font-weight:100 900;}';
    }
    const noteHTML = new XMLSerializer().serializeToString(note);
    async function tile(top, tileHeight) {
      const backing = canvasBackingSize(width, tileHeight, 2),
        canvas = document.createElement("canvas");
      canvas.width = backing.width;
      canvas.height = backing.height;
      const context = canvas.getContext("2d");
      context.setTransform(backing.scaleX, 0, 0, backing.scaleY, 0, 0);
      context.fillStyle = settings.backgroundColor;
      context.fillRect(0, 0, width, tileHeight);
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        width +
        '" height="' +
        tileHeight +
        '"><style>' +
        fonts +
        '</style><foreignObject x="0" y="' +
        -top +
        '" width="' +
        width +
        '" height="' +
        height +
        '">' +
        noteHTML +
        "</foreignObject></svg>";
      const image = new Image();
      image.src =
        "data:image/svg+xml;base64," + base64(new TextEncoder().encode(svg));
      await image.decode();
      context.drawImage(image, 0, 0, width, tileHeight);
      const drawingCanvas = document.createElement("canvas");
      drawingCanvas.width = canvas.width;
      drawingCanvas.height = canvas.height;
      const drawingContext = drawingCanvas.getContext("2d");
      drawingContext.setTransform(backing.scaleX, 0, 0, backing.scaleY, 0, 0);
      drawingContext.translate(0, -top);
      for (const stroke of page.drawings || []) {
        const drawingOptions = options(stroke),
          bounds = strokeBounds(stroke, drawingOptions);
        if (bounds && bounds.bottom >= top && bounds.top <= top + tileHeight)
          renderStroke(drawingContext, stroke, drawingOptions);
      }
      context.drawImage(drawingCanvas, 0, 0, width, tileHeight);
      return canvas;
    }
    return {
      width,
      height,
      tile,
      release: () => surface.remove(),
      safeBreak(target) {
        const walker = document.createTreeWalker(note, NodeFilter.SHOW_TEXT),
          origin = note.getBoundingClientRect().top;
        let node = walker.nextNode(),
          end = target;
        while (node) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            const top = rect.top - origin,
              bottom = rect.bottom - origin;
            if (top < end && bottom > end)
              end = Math.max(1, Math.floor(top - 1));
          }
          node = walker.nextNode();
        }
        return end;
      },
    };
  } catch (error) {
    surface.remove();
    throw error;
  }
}

function concatenate(parts) {
  const size = parts.reduce((n, p) => n + p.length, 0),
    out = new Uint8Array(size);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
export function imagePagesPdf(images) {
  const encoder = new TextEncoder(),
    encode = (text) => encoder.encode(text),
    objects = [];
  const count = images.length;
  objects.push(encode("<< /Type /Catalog /Pages 2 0 R >>"));
  objects.push(
    encode(
      "<< /Type /Pages /Count " +
        count +
        " /Kids [" +
        images.map((_, i) => 3 + i * 3 + " 0 R").join(" ") +
        "] >>",
    ),
  );
  images.forEach((image, i) => {
    const pageId = 3 + i * 3,
      contentId = pageId + 1,
      imageId = pageId + 2,
      displayHeight = (555.28 * image.height) / image.width;
    objects.push(
      encode(
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 " +
          imageId +
          " 0 R >> >> /Contents " +
          contentId +
          " 0 R >>",
      ),
    );
    const command =
      "q 555.28 0 0 " +
      displayHeight.toFixed(3) +
      " 20 " +
      (821.89 - displayHeight).toFixed(3) +
      " cm /Im0 Do Q";
    objects.push(
      encode(
        "<< /Length " +
          encode(command).length +
          " >>\nstream\n" +
          command +
          "\nendstream",
      ),
    );
    objects.push(
      concatenate([
        encode(
          "<< /Type /XObject /Subtype /Image /Width " +
            image.width +
            " /Height " +
            image.height +
            " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
            image.bytes.length +
            " >>\nstream\n",
        ),
        image.bytes,
        encode("\nendstream"),
      ]),
    );
  });
  const parts = [encode("%PDF-1.4\n")],
    offsets = [0];
  let length = parts[0].length;
  objects.forEach((object, i) => {
    offsets.push(length);
    const part = concatenate([
      encode(i + 1 + " 0 obj\n"),
      object,
      encode("\nendobj\n"),
    ]);
    parts.push(part);
    length += part.length;
  });
  const xref = length;
  parts.push(
    encode(
      "xref\n0 " +
        offsets.length +
        "\n0000000000 65535 f \n" +
        offsets
          .slice(1)
          .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
          .join("") +
        "trailer\n<< /Size " +
        offsets.length +
        " /Root 1 0 R >>\nstartxref\n" +
        xref +
        "\n%%EOF\n",
    ),
  );
  return new Blob(parts, { type: "application/pdf" });
}

export async function exportPageFile(page, settings, format, layout) {
  const prepared = await preparePageExport(page, settings, layout);
  try {
    if (format === "png") {
      if (
        prepared.height > 8192 ||
        prepared.width * prepared.height > 8_000_000
      )
        throw new Error(
          "This page is too tall for one sharp PNG. Export PDF to keep the whole page at full quality.",
        );
      const canvas = await prepared.tile(0, prepared.height),
        blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
      if (!blob) throw new Error("The image could not be exported.");
      download(blob, filename(page) + ".png");
    } else {
      const tileHeight = Math.floor((prepared.width * 801.89) / 555.28),
        images = [];
      if (Math.ceil(prepared.height / tileHeight) > 200)
        throw new Error(
          "This page exceeds the 200-page PDF export limit. Split it into smaller notes.",
        );
      for (let top = 0; top < prepared.height; ) {
        const target = Math.min(prepared.height, top + tileHeight),
          end =
            target === prepared.height
              ? target
              : Math.max(top + 1, prepared.safeBreak(target));
        const canvas = await prepared.tile(top, end - top),
          blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.95),
          );
        if (!blob) throw new Error("A PDF page could not be exported.");
        images.push({
          width: canvas.width,
          height: canvas.height,
          bytes: new Uint8Array(await blob.arrayBuffer()),
        });
        top = end;
      }
      download(imagePagesPdf(images), filename(page) + ".pdf");
    }
  } finally {
    prepared.release();
  }
}
