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

// One pass over the text nodes, shared by every anchored stroke in a redraw.
// Without it each stroke re-read textContent and walked the note from the top.
export function createTextIndex(root) {
  const nodes = [],
    ends = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    text += node.data;
    nodes.push(node);
    ends.push(text.length);
  }
  return { root, text, nodes, ends };
}

// Same answer as position(): the first text node whose end reaches offset.
function indexedPosition(index, offset) {
  const target = Math.max(0, offset);
  let low = 0,
    high = index.nodes.length - 1;
  if (high < 0) return { node: index.root, offset: 0 };
  if (index.ends[high] < target)
    return { node: index.nodes[high], offset: index.nodes[high].length };
  while (low < high) {
    const middle = (low + high) >> 1;
    if (index.ends[middle] >= target) high = middle;
    else low = middle + 1;
  }
  const start = index.ends[low] - index.nodes[low].length;
  return { node: index.nodes[low], offset: target - start };
}

// frame (optional): { index, origin } computed once for a whole redraw.
export function anchorBox(root, board, anchor, frame = null) {
  const index = frame?.index?.root === root ? frame.index : null,
    text = index ? index.text : root.textContent;
  if (!anchor || anchor.end > text.length) return null;
  if(anchor.text&&text.slice(anchor.start,anchor.end)!==anchor.text)return null;
  const a = index ? indexedPosition(index, anchor.start) : position(root, anchor.start),
    b = index ? indexedPosition(index, anchor.end) : position(root, anchor.end),
    range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  const rect = range.getBoundingClientRect(),
    origin = frame?.origin || board.getBoundingClientRect();
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
