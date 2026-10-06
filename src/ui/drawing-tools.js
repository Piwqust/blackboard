// The drawing toolbar is four tools plus undo and "More". Tapping a tool
// picks it; tapping the tool that is already active opens its ink panel
// (size, colour and that tool's own switch). Only one panel is open at a time
// and both hang off the toolbar, so opening them never moves the note.

// Chalk-like colours that stay legible on the dark board and the light themes.
const PALETTE = ["#E5484D", "#F5A524", "#3DBE7A", "#3E8BFF"];
const RECENTS_KEY = "blackboard-text:recent-colors";
const NAMES = {
  pen: "Pen",
  marker: "Marker",
  eraser: "Eraser",
  select: "Select strokes",
};
const TITLES = {
  pen: "Pen (B)",
  marker: "Marker",
  eraser: "Eraser (E)",
  select: "Select strokes",
};

// The pen button covers both the plain brush and the pressure pen.
const toolKey = (tool) => (tool === "brush" || tool === "pen" ? "pen" : tool);
const sameColor = (a, b) =>
  typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();

export function setupDrawingTools({
  getState,
  selectTool,
  setColor,
  setPressure,
  setFollowText,
  setEraseWhole,
  redo,
  removeSelected,
  smoothExisting,
}) {
  const toolbar = document.getElementById("drawingToolbar"),
    ink = document.getElementById("drawInkPanel"),
    menu = document.getElementById("drawingAdvancedPanel"),
    more = document.getElementById("drawingMoreBtn"),
    colors = document.getElementById("drawInkColors"),
    recents = document.getElementById("recentDrawingColors"),
    custom = document.getElementById("drawColorBtn"),
    toolButtons = [...toolbar.querySelectorAll("[data-tool]")];
  let openPanel = null,
    anchor = null;

  // The pen and marker icons end in a line that previews their ink.
  for (const button of toolButtons)
    if (button.dataset.tool === "pen" || button.dataset.tool === "marker")
      button.querySelector("svg path:last-child")?.classList.add("drawing-tool-ink");

  function swatch(color, label) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "drawing-ink-swatch";
    el.style.setProperty("--swatch", color);
    el.setAttribute("aria-label", label);
    el.setAttribute("aria-pressed", "false");
    el.title = label;
    return el;
  }
  const themeSwatch = swatch("var(--text-color)", "Theme colour");
  themeSwatch.classList.add("drawing-ink-theme");
  themeSwatch.addEventListener("click", () =>
    setColor(getState().themeColor, { mode: "theme" }),
  );
  const paletteSwatches = PALETTE.map((color) => {
    const el = swatch(color, "Use drawing colour " + color);
    el.dataset.color = color;
    el.addEventListener("click", () => setColor(color));
    return el;
  });
  custom.before(themeSwatch, ...paletteSwatches);

  function storedRecents() {
    try {
      const value = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
  function renderRecents(themeColor) {
    recents.replaceChildren();
    for (const color of storedRecents()
      .filter(
        (c) =>
          /^#[0-9a-f]{6}$/i.test(c) &&
          !sameColor(c, themeColor) &&
          !PALETTE.some((p) => sameColor(p, c)),
      )
      .slice(0, 6)) {
      const el = swatch(color, "Use drawing colour " + color);
      el.dataset.color = color;
      el.addEventListener("click", () => setColor(color));
      recents.append(el);
    }
    recents.hidden = !recents.childElementCount;
  }
  document.addEventListener("drawing-color-changed", (event) => {
    try {
      localStorage.setItem(
        RECENTS_KEY,
        JSON.stringify(
          [event.detail, ...storedRecents().filter((c) => c !== event.detail)].slice(0, 12),
        ),
      );
    } catch {
      /* Optional preference. */
    }
    refresh();
  });

  function refresh() {
    const state = getState(),
      active = state.enabled ? toolKey(state.tool) : null;
    for (const button of toolButtons) {
      const key = button.dataset.tool,
        isActive = key === active,
        expanded = isActive && openPanel === ink;
      button.title = isActive ? NAMES[key] + " settings" : TITLES[key];
      button.setAttribute("aria-expanded", String(expanded));
      const preview = state[key];
      if (preview) {
        // 1.5 to 4 units in the 24-unit icon: thin lines read as fine nibs.
        const weight = 1.5 + Math.min(1, Math.max(0, (preview.size - 0.08) / 0.92)) * 2.5;
        button.style.setProperty("--tool-ink", preview.color);
        button.style.setProperty("--tool-ink-width", weight.toFixed(2));
      }
    }
    more.setAttribute("aria-expanded", String(openPanel === menu));

    const key = toolKey(state.tool);
    ink.dataset.tool = key;
    ink.setAttribute("aria-label", NAMES[key] + " settings");
    renderRecents(state.themeColor);
    const showColors = key !== "eraser";
    colors.hidden = !showColors;
    if (!showColors) recents.hidden = true;
    let matched = false;
    for (const el of [themeSwatch, ...paletteSwatches, ...recents.children]) {
      const on =
        el === themeSwatch
          ? state.mode === "theme"
          : state.mode !== "theme" && sameColor(el.dataset.color, state.color);
      matched ||= on;
      el.classList.toggle("active", on);
      el.setAttribute("aria-pressed", String(on));
    }
    custom.classList.toggle("active", !matched);
    custom.style.setProperty("--swatch", matched ? "transparent" : state.color);
    document.getElementById("pressureOption").hidden = key !== "pen";
    document.getElementById("eraseWholeOption").hidden = key !== "eraser";
    document.getElementById("deleteSelectedStrokeBtn").hidden = key !== "select";
    document.getElementById("pressureToggle").checked = state.pressure;
    position();
  }

  function position() {
    if (!openPanel) return;
    const bar = toolbar.getBoundingClientRect(),
      target = (anchor || toolbar).getBoundingClientRect(),
      width = openPanel.offsetWidth,
      height = openPanel.offsetHeight,
      gap = 8,
      margin = 12;
    // Centred on its button, but never past the toolbar's right edge, where
    // the page rail begins.
    const right = Math.min(bar.right, innerWidth - margin);
    const left = Math.max(
      margin,
      Math.min(target.left + target.width / 2 - width / 2, right - width),
    );
    const below = bar.bottom + gap;
    const top =
      below + height <= innerHeight - margin
        ? below
        : Math.max(margin, bar.top - height - gap);
    openPanel.style.left = left + "px";
    openPanel.style.top = top + "px";
  }

  function open(panel, from) {
    if (openPanel && openPanel !== panel) openPanel.hidden = true;
    openPanel = panel;
    anchor = from;
    panel.hidden = false;
    refresh();
  }
  function close() {
    if (!openPanel) return;
    openPanel.hidden = true;
    openPanel = null;
    anchor = null;
    refresh();
  }

  for (const button of toolButtons)
    button.addEventListener("click", () => {
      const key = button.dataset.tool,
        state = getState();
      if (state.enabled && toolKey(state.tool) === key) {
        if (openPanel === ink) close();
        else open(ink, button);
        return;
      }
      selectTool(key === "pen" ? (state.pressure ? "pen" : "brush") : key);
      // An open ink panel follows the newly picked tool.
      if (openPanel === ink) anchor = button;
      refresh();
    });
  more.addEventListener("click", () => {
    if (openPanel === menu) close();
    else open(menu, more);
  });

  document.getElementById("redoDrawingBtn").addEventListener("click", redo);
  document.getElementById("smoothExistingDrawingsBtn").addEventListener("click", smoothExisting);
  document.getElementById("deleteSelectedStrokeBtn").addEventListener("click", removeSelected);
  // The confirmation anchors to the toolbar once the menu has closed.
  document.getElementById("clearDrawingsBtn").addEventListener("click", close);
  for (const [id, callback] of [
    ["followTextToggle", setFollowText],
    ["eraseWholeToggle", setEraseWhole],
    ["pressureToggle", setPressure],
  ]) {
    const input = document.getElementById(id);
    input.addEventListener("change", () => callback(input.checked));
  }

  // Starting a stroke or touching anything else dismisses the open panel.
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (
        openPanel &&
        !event.target.closest?.(
          "#drawingToolbar,.drawing-popover,.color-picker-popup,#clearDrawingsConfirm",
        )
      )
        close();
    },
    true,
  );
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !openPanel) return;
    // The colour picker and the clear confirmation sit above the panel.
    if (document.querySelector(".color-picker-popup.visible,#clearDrawingsConfirm:not([hidden])"))
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const returnTo = anchor;
    close();
    returnTo?.focus();
  });
  new ResizeObserver(position).observe(toolbar);
  window.addEventListener("resize", () => requestAnimationFrame(position));

  const cursor = document.createElement("div");
  cursor.id = "drawingCursor";
  cursor.hidden = true;
  cursor.setAttribute("aria-hidden", "true");
  document.body.append(cursor);

  return { refresh, close };
}
