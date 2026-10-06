// One stroked icon set for every list row and command in the app: 24x24,
// 1.5 weight, round caps and joins, so the icons match the drawing toolbar
// glyphs that were already drawn in that style.
const ICONS = {
  text:['M4 5h16M12 5v15M8 20h8'],
  // Chisel-tip highlighter. The last path is the ink line, which the drawing
  // toolbar recolours with the tool's current colour and thickness.
  marker:['M14.9 4.6a1.5 1.5 0 0 1 2.1 0l2.4 2.4a1.5 1.5 0 0 1 0 2.1L11 17.5H7.5V14Z','M12.6 6.9l4.5 4.5','M4 20.5h8'],
  pen:['M12 3 4 18h16z','M12 3v9','M12 12h.01'],
  select:['M4 3v16l4-4 3 6 3-1-3-6h6z'],
  lasso:['M12 4.5c4.4 0 8 2.2 8 5s-3.6 5-8 5-8-2.2-8-5 3.6-5 8-5Z','M7 13.4c-1.1 1-1.2 2.6 0 3.4 1 .7 1.2 2 .4 3.2'],
  eraser:['M3 20.08h18','M10.78 19.97 19.33 11.42c.93-.93.93-2.43 0-3.36l-3.45-3.45c-.93-.93-2.43-.93-3.36 0L3.75 13.38c-1 1-1 2.63 0 3.63l3.03 3.03','M8.07 9.06l6.81 6.81'],
  undo:['M7.05 11.69C5.86 10.5 5.19 9.83 4 8.64 5.19 7.44 5.86 6.77 7.05 5.58','M4 8.64h10.86A5.14 5.14 0 0 1 20 13.78a5.14 5.14 0 0 1-5.14 5.14H6.42'],
  more:['M5.25 12a.75.75 0 1 0 1.5 0 .75.75 0 1 0-1.5 0','M11.25 12a.75.75 0 1 0 1.5 0 .75.75 0 1 0-1.5 0','M17.25 12a.75.75 0 1 0 1.5 0 .75.75 0 1 0-1.5 0'],
  plus:['M12 6.5v11','M6.5 12h11'],
  trash:['M4 6h16','M8 6V3h8v3','M6 6l1 15h10l1-15','M10 10v7M14 10v7'],
  curve:['M3 17c4 0 2-10 7-10s1 10 6 10 5-7 5-7'],
  sliders:['M4 7h16M4 17h16','M8 4v6M16 14v6'],
  pin:['M8 3h8l-1 7 4 4H5l4-4z','M12 14v7'],
  search: [
    'M17.5 11a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
    'M15.7 15.7 20.5 20.5'
  ],
  page: [
    'M6.5 3.5h7l4 4v13h-11z',
    'M13.5 3.5v4h4',
    'M9.5 12.5h5',
    'M9.5 16.5h5'
  ],
  pencil: [
    'M4.5 19.5h3.2l9.6-9.6a2.26 2.26 0 0 0-3.2-3.2L4.5 16.3z',
    'M13.4 7.6l3 3'
  ],
  link: [
    'M10.4 13.6a4 4 0 0 0 5.66 0l2.83-2.83a4 4 0 0 0-5.66-5.66l-1.42 1.42',
    'M13.6 10.4a4 4 0 0 0-5.66 0L5.11 13.23a4 4 0 0 0 5.66 5.66l1.42-1.42'
  ],
  download: [
    'M12 3.5v10.5',
    'M8.2 10.2 12 14l3.8-3.8',
    'M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3'
  ],
  upload: [
    'M12 14V3.5',
    'M8.2 7.3 12 3.5l3.8 3.8',
    'M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3'
  ],
  markdown: [
    'M3.5 16.5v-9l4.25 4.75L12 7.5v9',
    'M17.5 7.5v8.4',
    'M20.5 12.9l-3 3-3-3'
  ],
  history: [
    'M12 7.6V12l3.2 1.9',
    'M4.2 9.6a8.4 8.4 0 1 1-.6 4.3',
    'M3.3 4.8v4.8h4.8'
  ],
  archive: [
    'M4 4.5h16v3.5H4z',
    'M5.6 8v10.5a2 2 0 0 0 2 2h8.8a2 2 0 0 0 2-2V8',
    'M10 12h4'
  ],
  redo: [
    'M16.95 11.7C18.14 10.5 18.81 9.84 20 8.64 18.81 7.45 18.14 6.78 16.95 5.59',
    'M20 8.64H9.14A5.14 5.14 0 0 0 4 13.78a5.14 5.14 0 0 0 5.14 5.14h8.44'
  ],
  brush: [
    'M6.14 19.94a1.5 1.5 0 0 1-1.58-1.16 6.6 6.6 0 0 1 1.02-5.37l5.92-8.05a3.2 3.2 0 0 1 5.18 3.75l-5.92 8.05a6.6 6.6 0 0 1-4.62 2.78Z',
    'M13.46 20h6.18'
  ],
  keyboard: [
    'M3.5 6.5h17a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 16V8a1.5 1.5 0 0 1 1.5-1.5Z',
    'M6.2 10h.01M9.4 10h.01M12.6 10h.01M15.8 10h.01M18.4 10h.01',
    'M8 13.6h8'
  ],
  chevron: ['M9.5 5.25 16.25 12 9.5 18.75']
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createIcon(name, className = '') {
  const paths = ICONS[name];
  if (!paths) return null;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (className) svg.setAttribute('class', className);

  for (const definition of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', definition);
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
  }

  return svg;
}

// Static markup reserves the icon box with a placeholder span carrying the
// same class, so hydrating on load cannot shift a row by a pixel.
export function hydrateIcons(root = document) {
  for (const placeholder of root.querySelectorAll('[data-icon]')) {
    const svg = createIcon(placeholder.dataset.icon, placeholder.className);
    if (svg) placeholder.replaceWith(svg);
  }
}
