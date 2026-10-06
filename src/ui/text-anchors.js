function position(root, offset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode(),
    remaining = Math.max(0, offset),
    last;
  while (node) {
    if (remaining <= node.length) return { node, offset: remaining };
    remaining -= node.length;
    last = node;
    node = walker.nextNode();
  }
  return { node: last || root, offset: last?.length || 0 };
}

export function anchorBox(root, board, anchor) {
  if (!anchor || anchor.end > root.textContent.length) return null;
  if(anchor.text&&root.textContent.slice(anchor.start,anchor.end)!==anchor.text)return null;
  const a = position(root, anchor.start),
    b = position(root, anchor.end),
    range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  const rect = range.getBoundingClientRect(),
    origin = board.getBoundingClientRect();
  return rect.width && rect.height
    ? {
        x: rect.x - origin.x,
        y: rect.y - origin.y,
        width: rect.width,
        height: rect.height,
      }
    : null;
}

export function captureTextAnchor(root, board, event) {
  const canvas = board.querySelector("#drawingLayer"),
    previous = canvas?.style.pointerEvents;
  // The input canvas sits over the text; exclude it from caret hit testing.
  if (canvas) canvas.style.pointerEvents = "none";
  let caret, range;
  try {
    caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    range = caret
      ? null
      : document.caretRangeFromPoint?.(event.clientX, event.clientY);
  } finally {
    if (canvas) canvas.style.pointerEvents = previous;
  }
  const node = caret?.offsetNode || range?.startContainer,
    offset = caret?.offset ?? range?.startOffset;
  if (!node || !root.contains(node) || node.nodeType !== Node.TEXT_NODE)
    return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode(),
    start = offset;
  while (current && current !== node) {
    start += current.length;
    current = walker.nextNode();
  }
  const text = root.textContent;
  if (/\s/u.test(text[start] || "")) start = Math.max(0, start - 1);
  let end = start;
  while (start > 0 && !/\s/u.test(text[start - 1])) start--;
  while (end < text.length && !/\s/u.test(text[end])) end++;
  if (end <= start) return null;
  const anchor = { start, end, text: text.slice(start, end) },
    box = anchorBox(root, board, anchor);
  if (!box) return null;
  // A caret API returns the nearest word even in empty space. Only attach a
  // deliberate annotation near that word, never a distant free sketch.
  const x = event.clientX - board.getBoundingClientRect().x,
    y = event.clientY - board.getBoundingClientRect().y;
  if (
    x < box.x - 20 ||
    x > box.x + box.width + 20 ||
    y < box.y - 20 ||
    y > box.y + box.height + 36
  )
    return null;
  return { ...anchor, box };
}

export function reconcileAnchor(anchor, previous, next) {
  let prefix = 0;
  while (
    prefix < previous.length &&
    prefix < next.length &&
    previous[prefix] === next[prefix]
  )
    prefix++;
  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    previous.at(-1 - suffix) === next.at(-1 - suffix)
  )
    suffix++;
  const oldEnd = previous.length - suffix,
    delta = next.length - previous.length;
  if (oldEnd <= anchor.start)
    return { ...anchor, start: anchor.start + delta, end: anchor.end + delta };
  if (prefix >= anchor.end) return anchor;
  return null;
}
