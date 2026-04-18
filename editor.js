// Theme presets
const THEMES = {
  lavender: {
    name: 'Lavender',
    textColor: '#6D68B3',
    backgroundColor: '#ECEDE7',
    selectionColor: '#6D68B3'
  },
  midnight: {
    name: 'Midnight',
    textColor: '#E8E6E3',
    backgroundColor: '#1A1A2E',
    selectionColor: '#E8E6E3'
  },
  sepia: {
    name: 'Sepia',
    textColor: '#5C4033',
    backgroundColor: '#F4ECD8',
    selectionColor: '#5C4033'
  },
  forest: {
    name: 'Forest',
    textColor: '#2D5A27',
    backgroundColor: '#F0F5E9',
    selectionColor: '#2D5A27'
  },
  ocean: {
    name: 'Ocean',
    textColor: '#1E5162',
    backgroundColor: '#E8F4F8',
    selectionColor: '#1E5162'
  },
  rose: {
    name: 'Rosé',
    textColor: '#8E4A5C',
    backgroundColor: '#FDF2F4',
    selectionColor: '#8E4A5C'
  },
  charcoal: {
    name: 'Charcoal',
    textColor: '#D4D4D4',
    backgroundColor: '#2D2D2D',
    selectionColor: '#D4D4D4'
  },
  paper: {
    name: 'Paper',
    textColor: '#333333',
    backgroundColor: '#FFFFFF',
    selectionColor: '#333333'
  }
};

// Default settings
const DEFAULT_SETTINGS = {
  fontFamily: 'Georgia, serif',
  fontSize: 18,
  lineHeight: 1.8,
  letterSpacing: 0,
  maxWidth: 800,
  drawSize: 4,
  drawColor: '#6D68B3',
  drawColorMode: 'theme',
  textColor: '#6D68B3',
  backgroundColor: '#ECEDE7',
  selectionColor: '#6D68B3',
  currentTheme: 'lavender'
};

// Static emoji collection for pages
const PAGE_EMOJIS = [
  '📝', '✏️', '📖', '📚', '📓', '📒',
  '⭐', '✨', '🌙', '☀️', '🌈', '🔥',
  '❤️', '🧡', '💛', '💚', '💙', '💜',
  '🌸', '🌻', '🍀', '🌿', '🌱', '🦋',
  '🐱', '🐶', '🐰', '🦊', '🐻', '🐼',
  '☕', '🍵', '🧁', '🍪', '🎂', '🍩',
  '🎉', '🎁', '🎈', '🏆', '🎨', '🎵',
  '🚀', '✈️', '💡', '💎', '🔮', '💻'
];

const DEFAULT_PAGE_EMOJI = '📝';

// DOM Elements
const board = document.getElementById('board');
const editorShell = document.getElementById('editorShell');
const editor = document.getElementById('editor');
const drawingLayer = document.getElementById('drawingLayer');
const drawingToolbar = document.getElementById('drawingToolbar');
const drawToggleBtn = document.getElementById('drawToggleBtn');
const eraseToggleBtn = document.getElementById('eraseToggleBtn');
const drawColorBtn = document.getElementById('drawColorBtn');
const drawColorPreview = document.getElementById('drawColorPreview');
const undoDrawingBtn = document.getElementById('undoDrawingBtn');
const clearDrawingsBtn = document.getElementById('clearDrawingsBtn');
const settingsToggleBtn = document.getElementById('settingsToggleBtn');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const controlsContainer = document.querySelector('.controls-container');
const saveIndicator = document.getElementById('saveIndicator');
const pageTabsList = document.getElementById('pageTabsList');
const addPageBtn = document.getElementById('addPageBtn');
const emojiPicker = document.getElementById('emojiPicker');
const emojiGrid = document.getElementById('emojiGrid');
const emojiPickerClear = document.getElementById('emojiPickerClear');
const emojiPickerDelete = document.getElementById('emojiPickerDelete');
const deletePageConfirm = document.getElementById('deletePageConfirm');
const cancelDeletePageBtn = document.getElementById('cancelDeletePageBtn');
const confirmDeletePageBtn = document.getElementById('confirmDeletePageBtn');
const themeGrid = document.getElementById('themeGrid');

// Setting controls
const controls = {
  fontFamily: document.getElementById('fontFamily'),
  fontSize: document.getElementById('fontSize'),
  lineHeight: document.getElementById('lineHeight'),
  letterSpacing: document.getElementById('letterSpacing'),
  maxWidth: document.getElementById('maxWidth'),
  drawColor: document.getElementById('drawColor'),
  textColor: document.getElementById('textColor'),
  backgroundColor: document.getElementById('backgroundColor'),
  selectionColor: document.getElementById('selectionColor')
};

const drawSizeButtons = Array.from(document.querySelectorAll('[data-draw-size]'));

// Hex input controls
const hexInputs = {
  textColor: document.getElementById('textColorHex'),
  backgroundColor: document.getElementById('backgroundColorHex'),
  selectionColor: document.getElementById('selectionColorHex')
};

// Color picker elements
const colorPickerPopup = document.getElementById('colorPickerPopup');
const colorPickerTitle = document.getElementById('colorPickerTitle');
const colorPickerArea = document.getElementById('colorPickerArea');
const colorPickerCursor = document.getElementById('colorPickerCursor');
const colorPickerHue = document.getElementById('colorPickerHue');
const colorPickerHexInput = document.getElementById('colorPickerHexInput');
const colorPickerPreviewCurrent = document.getElementById('colorPickerPreviewCurrent');
const colorPickerPreviewNew = document.getElementById('colorPickerPreviewNew');
const colorPickerSwatches = document.getElementById('colorPickerSwatches');

// Color picker state (using HSB/HSV instead of HSL for 2D picker)
const colorPickerState = {
  isOpen: false,
  activeColorKey: null,
  hue: 0,
  sat: 100,
  brightness: 100,
  originalColor: '#FF0000',
  isDragging: false
};

// Preset swatch colors
const PRESET_COLORS = [
  '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF', '#FF0000', '#FF6600',
  '#FFCC00', '#99CC00', '#00CC66', '#00CCCC', '#0066CC', '#6633CC', '#CC33CC', '#CC3366'
];

// Color conversion utilities
function hsbToHex(h, s, b) {
  s /= 100;
  b /= 100;
  const k = (n) => (n + h / 60) % 6;
  const f = (n) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  const r = Math.round(255 * f(5));
  const g = Math.round(255 * f(3));
  const bl = Math.round(255 * f(1));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`.toUpperCase();
}

function hexToHsb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  
  return { h: Math.round(h), s: Math.round(s), b: Math.round(v) };
}

function normalizeHex(hex) {
  if (typeof hex !== 'string') {
    return '#000000';
  }

  let value = hex.trim();
  if (!value.startsWith('#')) {
    value = `#${value}`;
  }

  if (/^#([A-Fa-f0-9]{3})$/.test(value)) {
    value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }

  return /^#([A-Fa-f0-9]{6})$/.test(value) ? value.toUpperCase() : '#000000';
}

function hexToRgb(hex) {
  const normalizedHex = normalizeHex(hex);

  return {
    r: parseInt(normalizedHex.slice(1, 3), 16),
    g: parseInt(normalizedHex.slice(3, 5), 16),
    b: parseInt(normalizedHex.slice(5, 7), 16)
  };
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Keep HSL functions for backwards compatibility
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Initialize preset swatches
function initColorPickerSwatches() {
  if (!colorPickerSwatches) return;
  colorPickerSwatches.innerHTML = '';
  
  PRESET_COLORS.forEach(color => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-picker-swatch';
    swatch.style.backgroundColor = color;
    swatch.addEventListener('click', () => {
      const hsb = hexToHsb(color);
      colorPickerState.hue = hsb.h;
      colorPickerState.sat = hsb.s;
      colorPickerState.brightness = hsb.b;
      if (colorPickerHue) colorPickerHue.value = hsb.h;
      updateColorPickerDisplay();
    });
    colorPickerSwatches.appendChild(swatch);
  });
}

// Color picker functions
function openColorPicker(colorKey, triggerElement) {
  const labels = { textColor: 'Text Color', backgroundColor: 'Background', selectionColor: 'Selection', drawColor: 'Brush Color' };

  if (colorKey === 'drawColor') {
    setSettingsPanelOpen(false);
  } else {
    closeDeletePageConfirm();
  }

  colorPickerState.activeColorKey = colorKey;
  colorPickerState.isOpen = true;
  
  // Set title
  if (colorPickerTitle) colorPickerTitle.textContent = labels[colorKey] || 'Color';
  
  // Get current color and convert to HSB
  const currentHex = controls[colorKey].value;
  colorPickerState.originalColor = currentHex;
  const hsb = hexToHsb(currentHex);
  colorPickerState.hue = hsb.h;
  colorPickerState.sat = hsb.s;
  colorPickerState.brightness = hsb.b;
  
  // Update hue slider
  if (colorPickerHue) colorPickerHue.value = hsb.h;
  
  // Set current preview
  if (colorPickerPreviewCurrent) colorPickerPreviewCurrent.style.backgroundColor = currentHex;
  
  // Update displays
  updateColorPickerDisplay();
  
  // Position popup near trigger
  const rect = triggerElement.getBoundingClientRect();
  const popupWidth = 220;
  const popupHeight = 340;
  
  let left;
  let top;

  if (colorKey === 'drawColor') {
    left = rect.left + (rect.width / 2) - (popupWidth / 2);
    top = rect.bottom + 12;

    if (left < 12) left = 12;
    if (left + popupWidth > window.innerWidth - 12) {
      left = window.innerWidth - popupWidth - 12;
    }

    if (top + popupHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - popupHeight - 12);
    }
  } else {
    left = rect.left - popupWidth - 12;
    top = rect.top - 50;

    // Keep within viewport
    if (left < 12) left = rect.right + 12;
    if (top < 12) top = 12;
    if (top + popupHeight > window.innerHeight - 12) {
      top = window.innerHeight - popupHeight - 12;
    }
  }
  
  colorPickerPopup.style.left = left + 'px';
  colorPickerPopup.style.top = top + 'px';
  colorPickerPopup.classList.add('visible');
}

function closeColorPicker() {
  colorPickerState.isOpen = false;
  colorPickerState.isDragging = false;
  colorPickerState.activeColorKey = null;
  colorPickerPopup.classList.remove('visible');
}

function updateColorPickerDisplay() {
  const { hue, sat, brightness } = colorPickerState;
  const hex = hsbToHex(hue, sat, brightness);
  
  // Update color area background (hue)
  if (colorPickerArea) {
    colorPickerArea.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
  }
  
  // Update cursor position (sat = x, brightness = inverted y)
  if (colorPickerCursor && colorPickerArea) {
    const x = (sat / 100) * 100;
    const y = ((100 - brightness) / 100) * 100;
    colorPickerCursor.style.left = x + '%';
    colorPickerCursor.style.top = y + '%';
    colorPickerCursor.style.backgroundColor = hex;
  }
  
  // Update new preview
  if (colorPickerPreviewNew) colorPickerPreviewNew.style.backgroundColor = hex;
  
  // Update hex input
  if (colorPickerHexInput) colorPickerHexInput.value = hex;
  
  // Live update the color
  applyColorLive();
}

function applyColorLive() {
  if (!colorPickerState.activeColorKey) return;
  
  const hex = hsbToHex(colorPickerState.hue, colorPickerState.sat, colorPickerState.brightness);
  const colorKey = colorPickerState.activeColorKey;
  
  // Update the native color input and hex input
  controls[colorKey].value = hex;
  if (hexInputs[colorKey]) hexInputs[colorKey].value = hex;
  
  if (colorKey === 'drawColor') {
    setBrushColor(hex, { persist: true, mode: 'custom' });
  } else {
    // Apply settings live
    handleColorChange();
  }
}

// Handle 2D area interaction
function handleAreaInteraction(e) {
  if (!colorPickerArea) return;
  
  const rect = colorPickerArea.getBoundingClientRect();
  let x = (e.clientX - rect.left) / rect.width;
  let y = (e.clientY - rect.top) / rect.height;
  
  // Clamp values
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));
  
  colorPickerState.sat = Math.round(x * 100);
  colorPickerState.brightness = Math.round((1 - y) * 100);
  
  updateColorPickerDisplay();
}

// Color area mouse events
if (colorPickerArea) {
  colorPickerArea.addEventListener('mousedown', (e) => {
    colorPickerState.isDragging = true;
    handleAreaInteraction(e);
  });
  
  document.addEventListener('mousemove', (e) => {
    if (colorPickerState.isDragging) {
      handleAreaInteraction(e);
    }
  });
  
  document.addEventListener('mouseup', () => {
    colorPickerState.isDragging = false;
  });
}

// Hue slider
if (colorPickerHue) {
  colorPickerHue.addEventListener('input', () => {
    colorPickerState.hue = parseInt(colorPickerHue.value);
    updateColorPickerDisplay();
  });
}

// Hex input
if (colorPickerHexInput) {
  colorPickerHexInput.addEventListener('input', () => {
    let val = colorPickerHexInput.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#([A-Fa-f0-9]{6})$/.test(val)) {
      const hsb = hexToHsb(val);
      colorPickerState.hue = hsb.h;
      colorPickerState.sat = hsb.s;
      colorPickerState.brightness = hsb.b;
      if (colorPickerHue) colorPickerHue.value = hsb.h;
      updateColorPickerDisplay();
    }
  });
}

document.getElementById('colorPickerClose')?.addEventListener('click', closeColorPicker);

// Initialize swatches
initColorPickerSwatches();

// Click on color swatch to open picker
document.querySelectorAll('.color-control').forEach(control => {
  const colorType = control.dataset.colorType;
  if (!colorType) return;
  
  const colorInput = control.querySelector('input[type="color"]');
  if (colorInput) {
    colorInput.addEventListener('click', (e) => {
      e.preventDefault();
      openColorPicker(colorType, colorInput);
    });
  }
});

if (drawColorBtn) {
  drawColorBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openColorPicker('drawColor', drawColorBtn);
  });
}

// Close picker when clicking outside
document.addEventListener('click', (e) => {
  if (colorPickerState.isOpen) {
    if (!e.target.closest('.color-picker-popup') && !e.target.closest('.color-control input[type="color"]') && !e.target.closest('#drawColorBtn')) {
      closeColorPicker();
    }
  }
});

// Close color picker when settings panel hides (mouse leaves controls container)
// But not if mouse is moving to the color picker popup
document.querySelector('.controls-container')?.addEventListener('mouseleave', (e) => {
  // Check if mouse is moving to the color picker popup
  const relatedTarget = e.relatedTarget;
  const isMovingToColorPicker = relatedTarget && (
    relatedTarget.closest('.color-picker-popup') ||
    relatedTarget.classList?.contains('color-picker-popup')
  );
  
  if (!isMovingToColorPicker) {
    if (colorPickerState.isOpen) {
      closeColorPicker();
    }
    if (fontDropdownOpen) {
      closeFontDropdown();
    }
  }
});

// Also close color picker when mouse leaves the popup itself (if not going back to controls)
document.querySelector('.color-picker-popup')?.addEventListener('mouseleave', (e) => {
  const relatedTarget = e.relatedTarget;
  const isMovingToControls = relatedTarget && (relatedTarget.closest('.controls-container') || relatedTarget.closest('#drawColorBtn'));
  
  if (!isMovingToControls && !colorPickerState.isDragging) {
    closeColorPicker();
  }
});

// Font dropdown elements
const fontDropdownWrapper = document.getElementById('fontDropdownWrapper');
const fontDropdownTrigger = document.getElementById('fontDropdownTrigger');
const fontDropdownMenu = document.getElementById('fontDropdownMenu');
const fontDropdownPreview = document.getElementById('fontDropdownPreview');

// Font definitions for custom dropdown
const FONT_GROUPS = [
  {
    label: 'System Fonts',
    fonts: [
      { value: 'Georgia, serif', name: 'Georgia' },
      { value: "'Times New Roman', serif", name: 'Times New Roman' },
      { value: 'Arial, sans-serif', name: 'Arial' },
      { value: "'Helvetica Neue', sans-serif", name: 'Helvetica' },
      { value: "'Courier New', monospace", name: 'Courier New' },
      { value: "'Segoe UI', sans-serif", name: 'Segoe UI' },
      { value: 'system-ui, sans-serif', name: 'System UI' }
    ]
  },
  {
    label: 'Unica 77 Cyr',
    fonts: [
      { value: "'Unica 77 Cyr', sans-serif", name: 'Unica 77 Cyr' }
    ]
  },
  {
    label: 'Inter',
    fonts: [
      { value: "'Inter', sans-serif", name: 'Inter' },
      { value: "'Inter Tight', sans-serif", name: 'Inter Tight' }
    ]
  },
  {
    label: 'PP Right Grotesk',
    fonts: [
      { value: "'PP Right Grotesk Tight', sans-serif", name: 'PP Right Grotesk Tight' },
      { value: "'PP Right Grotesk', sans-serif", name: 'PP Right Grotesk' },
      { value: "'PP Right Grotesk Wide', sans-serif", name: 'PP Right Grotesk Wide' },
      { value: "'PP Right Text Compact', sans-serif", name: 'PP Right Text Compact' },
      { value: "'PP Right Text', sans-serif", name: 'PP Right Text' },
      { value: "'PP Right Text Wide', sans-serif", name: 'PP Right Text Wide' }
    ]
  }
];

let fontDropdownOpen = false;

function initFontDropdown() {
  if (!fontDropdownMenu) return;
  
  fontDropdownMenu.innerHTML = '';
  
  FONT_GROUPS.forEach(group => {
    const groupEl = document.createElement('div');
    groupEl.className = 'font-dropdown-group';
    
    const labelEl = document.createElement('div');
    labelEl.className = 'font-dropdown-group-label';
    labelEl.textContent = group.label;
    groupEl.appendChild(labelEl);
    
    group.fonts.forEach(font => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'font-dropdown-option';
      option.dataset.value = font.value;
      
      const nameEl = document.createElement('span');
      nameEl.className = 'font-dropdown-option-name';
      nameEl.textContent = font.name;
      nameEl.style.fontFamily = font.value;
      
      option.appendChild(nameEl);
      
      option.addEventListener('click', () => selectFont(font.value, font.name));
      
      groupEl.appendChild(option);
    });
    
    fontDropdownMenu.appendChild(groupEl);
  });
  
  updateFontDropdownSelection();
}

function toggleFontDropdown() {
  fontDropdownOpen = !fontDropdownOpen;
  fontDropdownTrigger.classList.toggle('open', fontDropdownOpen);
  fontDropdownMenu.classList.toggle('visible', fontDropdownOpen);
  
  if (fontDropdownOpen) {
    updateFontDropdownSelection();
  }
}

function closeFontDropdown() {
  fontDropdownOpen = false;
  fontDropdownTrigger?.classList.remove('open');
  fontDropdownMenu?.classList.remove('visible');
}

function selectFont(value, name) {
  controls.fontFamily.value = value;
  fontDropdownPreview.textContent = name;
  fontDropdownPreview.style.fontFamily = value;
  handleSettingChange();
  closeFontDropdown();
  updateFontDropdownSelection();
}

function updateFontDropdownSelection() {
  if (!fontDropdownMenu) return;
  
  const currentValue = controls.fontFamily.value;
  fontDropdownMenu.querySelectorAll('.font-dropdown-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.value === currentValue);
  });
  
  // Update trigger preview
  let currentName = 'Georgia';
  FONT_GROUPS.forEach(group => {
    group.fonts.forEach(font => {
      if (font.value === currentValue) {
        currentName = font.name;
      }
    });
  });
  if (fontDropdownPreview) {
    fontDropdownPreview.textContent = currentName;
    fontDropdownPreview.style.fontFamily = currentValue;
  }
}

// Font dropdown event listeners
fontDropdownTrigger?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleFontDropdown();
});

document.addEventListener('click', (e) => {
  if (fontDropdownOpen && !e.target.closest('.font-dropdown-wrapper')) {
    closeFontDropdown();
  }
});

// Current theme state
let currentTheme = 'lavender';

// Value displays
const valueDisplays = {
  fontSize: document.getElementById('fontSizeValue'),
  lineHeight: document.getElementById('lineHeightValue'),
  letterSpacing: document.getElementById('letterSpacingValue'),
  maxWidth: document.getElementById('maxWidthValue')
};

// Page state
let pages = [];
let currentPageId = null;
let editingPageId = null;
let hoverResetTimeout = null;
let scrollRestoreTimeout = null;

// Overlay/menu state
const uiState = {
  settingsOpen: false,
  deleteConfirmOpen: false
};

// Drawing state
const drawingContext = drawingLayer ? drawingLayer.getContext('2d') : null;
const drawingState = {
  enabled: false,
  isDrawing: false,
  currentStroke: null,
  currentTool: 'brush',
  currentBrushSize: DEFAULT_SETTINGS.drawSize,
  currentBrushColorMode: DEFAULT_SETTINGS.drawColorMode,
  syncFrame: null
};

function normalizePage(page = {}) {
  const parsedScrollTop = Number(page.scrollTop);

  return {
    id: page.id || generateId(),
    emoji: typeof page.emoji === 'string' ? page.emoji : DEFAULT_PAGE_EMOJI,
    content: typeof page.content === 'string' ? page.content : '',
    drawings: Array.isArray(page.drawings) ? page.drawings : [],
    scrollTop: Number.isFinite(parsedScrollTop) && parsedScrollTop > 0 ? parsedScrollTop : 0
  };
}

function getCurrentPage() {
  return pages.find(page => page.id === currentPageId) || null;
}

function getPageById(pageId) {
  return pages.find(page => page.id === pageId) || null;
}

function getPageDisplayEmoji(page) {
  if (!page || typeof page.emoji !== 'string' || page.emoji.length === 0) {
    return DEFAULT_PAGE_EMOJI;
  }

  return page.emoji;
}

function getPageTabButton(pageId = editingPageId) {
  if (!pageTabsList || !pageId) {
    return null;
  }

  return pageTabsList.querySelector(`.page-tab[data-page-id="${pageId}"]`);
}

function getViewportScrollTop() {
  return Math.max(window.scrollY || window.pageYOffset || 0, 0);
}

function getMaxViewportScrollTop() {
  const documentHeight = Math.max(
    document.documentElement?.scrollHeight || 0,
    document.body?.scrollHeight || 0,
    board?.scrollHeight || 0
  );

  return Math.max(documentHeight - window.innerHeight, 0);
}

function syncCurrentPageScrollPosition() {
  const page = getCurrentPage();
  if (!page) {
    return;
  }

  page.scrollTop = getViewportScrollTop();
}

function restorePageScrollPosition(scrollTop = 0) {
  const targetScrollTop = Math.max(0, Number(scrollTop) || 0);
  const applyScroll = () => {
    const clampedScrollTop = Math.min(targetScrollTop, getMaxViewportScrollTop());
    window.scrollTo(0, clampedScrollTop);

    if (Math.abs(getViewportScrollTop() - clampedScrollTop) > 1) {
      window.scrollTo(0, clampedScrollTop);
    }
  };

  if (scrollRestoreTimeout) {
    clearTimeout(scrollRestoreTimeout);
  }

  requestAnimationFrame(() => {
    applyScroll();
    requestAnimationFrame(() => {
      applyScroll();
    });
  });

  scrollRestoreTimeout = setTimeout(() => {
    applyScroll();
    scrollRestoreTimeout = null;
  }, 120);
}

function suppressHoverEffects() {
  document.body.classList.add('is-scrolling');

  if (hoverResetTimeout) {
    clearTimeout(hoverResetTimeout);
  }

  hoverResetTimeout = setTimeout(() => {
    document.body.classList.remove('is-scrolling');
    hoverResetTimeout = null;
  }, 140);
}

function handleScrollActivity({ repositionEmojiPicker = false, persistPageScroll = false } = {}) {
  suppressHoverEffects();

  if (repositionEmojiPicker && emojiPicker?.classList.contains('visible')) {
    positionEmojiPicker(editingPageId);
  }

  if (persistPageScroll) {
    syncCurrentPageScrollPosition();
    persistPagesState();
  }
}

function syncSelectionColorControl(color = controls.textColor?.value || DEFAULT_SETTINGS.textColor) {
  const normalizedColor = normalizeHex(color);

  if (controls.selectionColor) {
    controls.selectionColor.value = normalizedColor;
  }

  if (hexInputs.selectionColor) {
    hexInputs.selectionColor.value = normalizedColor;
  }

  return normalizedColor;
}

function getCurrentBrushColor() {
  return controls.drawColor?.value || controls.textColor?.value || DEFAULT_SETTINGS.textColor;
}

function updateDrawColorPreview() {
  if (drawColorPreview) {
    drawColorPreview.style.backgroundColor = getCurrentBrushColor();
  }
}

function setBrushColor(color, { persist = true, mode = 'custom' } = {}) {
  if (!controls.drawColor || !color) {
    return;
  }

  controls.drawColor.value = color;
  drawingState.currentBrushColorMode = mode;
  updateDrawColorPreview();
  redrawDrawings();

  if (persist) {
    saveSettings(getCurrentSettings());
  }
}

function updateBrushSizeButtons() {
  drawSizeButtons.forEach(button => {
    const size = Number(button.dataset.drawSize);
    button.classList.toggle('active', Math.abs(size - drawingState.currentBrushSize) < 0.01);
  });
}

function setBrushSize(size, persist = true) {
  const parsedSize = Number(size);
  if (!Number.isFinite(parsedSize)) {
    return;
  }

  drawingState.currentBrushSize = parsedSize;
  updateBrushSizeButtons();

  if (persist) {
    saveSettings(getCurrentSettings());
  }
}

function updateDrawingToolButtons() {
  const isBrushActive = drawingState.enabled && drawingState.currentTool === 'brush';
  const isEraserActive = drawingState.enabled && drawingState.currentTool === 'eraser';

  if (drawToggleBtn) {
    drawToggleBtn.classList.toggle('active', isBrushActive);
    drawToggleBtn.setAttribute('aria-pressed', String(isBrushActive));
  }

  if (eraseToggleBtn) {
    eraseToggleBtn.classList.toggle('active', isEraserActive);
    eraseToggleBtn.setAttribute('aria-pressed', String(isEraserActive));
  }

  if (drawingToolbar) {
    drawingToolbar.classList.toggle('eraser-active', isEraserActive);
  }

  document.body.classList.toggle('eraser-mode', isEraserActive);
}

function setDrawingTool(tool) {
  drawingState.currentTool = tool === 'eraser' ? 'eraser' : 'brush';
  updateDrawingToolButtons();
}

function toggleDrawingTool(tool) {
  const nextTool = tool === 'eraser' ? 'eraser' : 'brush';

  if (drawingState.enabled && drawingState.currentTool === nextTool) {
    setDrawMode(false);
    return;
  }

  setDrawingTool(nextTool);
  setDrawMode(true);
}

function setDrawMode(enabled) {
  drawingState.enabled = Boolean(enabled);
  document.body.classList.toggle('drawing-mode', drawingState.enabled);
  if (drawingToolbar) {
    drawingToolbar.classList.toggle('active', drawingState.enabled);
  }
  updateDrawingToolButtons();

  if (drawingState.enabled) {
    editor.blur();
  } else {
    editor.focus();
  }
}

function scheduleDrawingLayerSync() {
  if (drawingState.syncFrame) {
    cancelAnimationFrame(drawingState.syncFrame);
  }

  drawingState.syncFrame = requestAnimationFrame(() => {
    drawingState.syncFrame = null;
    syncDrawingLayerSize();
  });
}

function getBoardSize() {
  if (!board) {
    return { width: 1, height: 1 };
  }

  return {
    width: Math.max(1, Math.round(board.clientWidth)),
    height: Math.max(1, Math.round(Math.max(board.scrollHeight, board.clientHeight, board.offsetHeight)))
  };
}

function clearDrawingSurface() {
  if (!drawingContext || !drawingLayer) return;

  drawingContext.save();
  drawingContext.setTransform(1, 0, 0, 1, 0, 0);
  drawingContext.clearRect(0, 0, drawingLayer.width, drawingLayer.height);
  drawingContext.restore();
}

function drawStroke(stroke) {
  if (!drawingContext || !stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) {
    return;
  }

  const isEraserStroke = stroke.tool === 'eraser';

  drawingContext.save();
  drawingContext.globalCompositeOperation = isEraserStroke ? 'destination-out' : 'source-over';
  drawingContext.strokeStyle = isEraserStroke ? '#000000' : (stroke.color || getCurrentBrushColor());
  drawingContext.lineWidth = Math.max(1, Number(stroke.width) || DEFAULT_SETTINGS.drawSize);
  drawingContext.lineCap = 'round';
  drawingContext.lineJoin = 'round';
  drawingContext.beginPath();
  drawingContext.moveTo(stroke.points[0].x, stroke.points[0].y);

  if (stroke.points.length === 1) {
    drawingContext.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y + 0.01);
  } else {
    stroke.points.slice(1).forEach(point => drawingContext.lineTo(point.x, point.y));
  }

  drawingContext.stroke();
  drawingContext.restore();
}

function redrawDrawings() {
  clearDrawingSurface();

  const page = getCurrentPage();
  if (!page || !Array.isArray(page.drawings) || page.drawings.length === 0) {
    return;
  }

  page.drawings.forEach(stroke => drawStroke(stroke));
}

function syncDrawingLayerSize() {
  if (!drawingLayer || !drawingContext || !board) return;

  const { width, height } = getBoardSize();
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.round(width * dpr));
  const targetHeight = Math.max(1, Math.round(height * dpr));

  if (drawingLayer.width !== targetWidth || drawingLayer.height !== targetHeight) {
    drawingLayer.width = targetWidth;
    drawingLayer.height = targetHeight;
    drawingLayer.style.width = `${width}px`;
    drawingLayer.style.height = `${height}px`;
    drawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  redrawDrawings();
}

function getRelativePoint(event) {
  if (!board) {
    return { x: 0, y: 0 };
  }

  const rect = board.getBoundingClientRect();
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const x = Math.min(Math.max(event.clientX - rect.left, 0), width);
  const y = Math.min(Math.max(event.clientY - rect.top, 0), height);

  return { x, y };
}

function beginStroke(event) {
  if (!drawingState.enabled || event.button !== 0) return;

  const page = getCurrentPage();
  if (!page) return;

  event.preventDefault();

  const stroke = {
    id: generateId(),
    tool: drawingState.currentTool,
    color: drawingState.currentTool === 'eraser' ? null : getCurrentBrushColor(),
    width: drawingState.currentBrushSize,
    points: [getRelativePoint(event)]
  };

  page.drawings.push(stroke);
  drawingState.isDrawing = true;
  drawingState.currentStroke = stroke;

  if (drawingLayer.setPointerCapture) {
    drawingLayer.setPointerCapture(event.pointerId);
  }

  redrawDrawings();
}

function extendStroke(event) {
  if (!drawingState.enabled || !drawingState.isDrawing || !drawingState.currentStroke) return;

  event.preventDefault();
  const point = getRelativePoint(event);
  const points = drawingState.currentStroke.points;
  const lastPoint = points[points.length - 1];

  if (!lastPoint || lastPoint.x !== point.x || lastPoint.y !== point.y) {
    points.push(point);
    redrawDrawings();
  }
}

function finishStroke(event) {
  if (!drawingState.isDrawing || !drawingState.currentStroke) return;

  if (event) {
    event.preventDefault();
    if (drawingLayer.releasePointerCapture) {
      try {
        drawingLayer.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore release errors when pointer capture is already cleared.
      }
    }
  }

  if (drawingState.currentStroke.points.length === 1) {
    drawingState.currentStroke.points.push({ ...drawingState.currentStroke.points[0] });
  }

  drawingState.isDrawing = false;
  drawingState.currentStroke = null;
  redrawDrawings();
  saveContent();
}

function undoLastStroke() {
  const page = getCurrentPage();
  if (!page || !Array.isArray(page.drawings) || page.drawings.length === 0) {
    return false;
  }

  page.drawings.pop();
  redrawDrawings();
  saveContent();
  return true;
}

function clearCurrentPageDrawings() {
  const page = getCurrentPage();
  if (!page || !Array.isArray(page.drawings) || page.drawings.length === 0) {
    return;
  }

  if (!window.confirm('Clear all drawings from this page?')) {
    return;
  }

  page.drawings = [];
  redrawDrawings();
  saveContent();
}

function setSettingsPanelOpen(isOpen) {
  uiState.settingsOpen = Boolean(isOpen);

  if (controlsContainer) {
    controlsContainer.classList.toggle('open', uiState.settingsOpen);
  }

  if (settingsToggleBtn) {
    settingsToggleBtn.setAttribute('aria-expanded', String(uiState.settingsOpen));
    settingsToggleBtn.setAttribute('aria-label', uiState.settingsOpen ? 'Close settings' : 'Open settings');
  }

  if (!uiState.settingsOpen) {
    if (fontDropdownOpen) {
      closeFontDropdown();
    }
    if (colorPickerState.isOpen) {
      closeColorPicker();
    }
  } else {
    if (uiState.deleteConfirmOpen) {
      closeDeletePageConfirm();
    }
  }
}

function closeDeletePageConfirm({ restoreFocus = false } = {}) {
  uiState.deleteConfirmOpen = false;

  if (deletePageConfirm) {
    deletePageConfirm.classList.remove('visible');
    deletePageConfirm.hidden = true;
  }

  if (emojiPickerDelete) {
    emojiPickerDelete.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      emojiPickerDelete.focus();
    }
  }

  if (emojiPicker?.classList.contains('visible') && editingPageId) {
    positionEmojiPicker(editingPageId);
  }
}

function openDeletePageConfirm() {
  if (!deletePageConfirm || !emojiPickerDelete || pages.length <= 1) {
    return;
  }

  uiState.deleteConfirmOpen = true;
  deletePageConfirm.hidden = false;
  deletePageConfirm.classList.add('visible');
  emojiPickerDelete.setAttribute('aria-expanded', 'true');
  positionEmojiPicker(editingPageId);
}

function positionEmojiPicker(pageId = editingPageId) {
  if (!emojiPicker || !pageId) {
    return;
  }

  const anchor = pageTabsList?.querySelector(`.page-tab[data-page-id="${pageId}"]`);
  if (!anchor) {
    return;
  }

  const anchorRect = anchor.getBoundingClientRect();
  const pickerWidth = Math.min(emojiPicker.offsetWidth || 280, window.innerWidth - 24);
  const pickerHeight = Math.min(emojiPicker.offsetHeight || 280, window.innerHeight - 24);
  const viewportPadding = 12;
  const gutter = 10;

  let left = anchorRect.left - pickerWidth - gutter;
  if (left < viewportPadding) {
    left = anchorRect.right + gutter;
  }
  if (left + pickerWidth > window.innerWidth - viewportPadding) {
    left = window.innerWidth - pickerWidth - viewportPadding;
  }

  let top = anchorRect.top + (anchorRect.height - pickerHeight) / 2;
  if (top < viewportPadding) {
    top = viewportPadding;
  }
  if (top + pickerHeight > window.innerHeight - viewportPadding) {
    top = window.innerHeight - pickerHeight - viewportPadding;
  }

  emojiPicker.style.left = `${Math.max(viewportPadding, left)}px`;
  emojiPicker.style.top = `${Math.max(viewportPadding, top)}px`;
}

function getShortcutTarget(event) {
  if (event.target instanceof HTMLElement) {
    return event.target;
  }

  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function isTextEditingShortcutTarget(event) {
  const target = getShortcutTarget(event);
  if (!target) {
    return false;
  }

  if (target.closest('input, textarea, select')) {
    return true;
  }

  return target === editor || target.closest('#editor') || target.isContentEditable;
}

function isFormFieldShortcutTarget(event) {
  const target = getShortcutTarget(event);
  return Boolean(target?.closest('input, textarea, select'));
}

function isUndoShortcut(event) {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'z';
}

function shouldHandleGlobalShortcut(event) {
  if (event.defaultPrevented) {
    return false;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  if (target === editor || target === drawingLayer || target === document.body) {
    return true;
  }

  if (target.isContentEditable) {
    return target === editor;
  }

  return !target.closest('input, textarea, select, button');
}

function shouldHandleDrawingShortcut(event) {
  if (event.defaultPrevented) {
    return false;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  if (target.isContentEditable && target !== editor) {
    return false;
  }

  return !target.closest('input, textarea, select');
}

function shouldHandleBrushToggleShortcut(event) {
  if (event.defaultPrevented) {
    return false;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  if (target.isContentEditable && target !== editor) {
    return false;
  }

  return !target.closest('input, textarea, select');
}

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const persistPagesState = debounce(async () => {
  try {
    await chrome.storage.local.set({ pages, currentPageId });
  } catch (error) {
    console.error('Error saving page state:', error);
  }
}, 200);

async function persistPagesStateImmediately() {
  try {
    await chrome.storage.local.set({ pages, currentPageId });
  } catch (error) {
    console.error('Error saving page state immediately:', error);
  }
}

// Apply settings to CSS custom properties
function applySettings(settings) {
  const root = document.documentElement;
  const selectionColor = normalizeHex(settings.textColor || settings.selectionColor || DEFAULT_SETTINGS.textColor);
  root.style.setProperty('--font-family', settings.fontFamily);
  root.style.setProperty('--font-size', settings.fontSize + 'px');
  root.style.setProperty('--line-height', settings.lineHeight);
  root.style.setProperty('--letter-spacing', settings.letterSpacing + 'em');
  root.style.setProperty('--max-width', settings.maxWidth + 'px');
  root.style.setProperty('--text-color', settings.textColor);
  root.style.setProperty('--bg-color', settings.backgroundColor);
  root.style.setProperty('--selection-color', selectionColor);
  root.style.setProperty('--ui-surface', hexToRgba(settings.backgroundColor, 0.56));
  root.style.setProperty('--ui-surface-strong', hexToRgba(settings.backgroundColor, 0.72));
  root.style.setProperty('--ui-surface-soft', hexToRgba(settings.backgroundColor, 0.44));
  root.style.setProperty('--ui-section-surface', hexToRgba(settings.backgroundColor, 0.34));
  root.style.setProperty('--ui-border', hexToRgba(settings.textColor, 0.12));
  root.style.setProperty('--ui-border-strong', hexToRgba(settings.textColor, 0.2));
  root.style.setProperty('--ui-text', hexToRgba(settings.textColor, 0.88));
  root.style.setProperty('--ui-text-muted', hexToRgba(settings.textColor, 0.6));
  root.style.setProperty('--ui-hover', hexToRgba(settings.textColor, 0.08));
  root.style.setProperty('--ui-hover-strong', hexToRgba(settings.textColor, 0.14));
  root.style.setProperty('--ui-track', hexToRgba(settings.textColor, 0.12));
  root.style.setProperty('--ui-shadow-soft', '0 18px 42px rgba(15, 23, 42, 0.06)');
  root.style.setProperty('--ui-shadow-subtle', '0 10px 24px rgba(15, 23, 42, 0.04)');
}

// Update control values in UI
function updateControlValues(settings) {
  const selectionColor = normalizeHex(settings.textColor || settings.selectionColor || DEFAULT_SETTINGS.textColor);

  controls.fontFamily.value = settings.fontFamily;
  controls.fontSize.value = settings.fontSize;
  controls.lineHeight.value = settings.lineHeight;
  controls.letterSpacing.value = settings.letterSpacing;
  controls.maxWidth.value = settings.maxWidth;
  controls.drawColor.value = settings.drawColor || settings.textColor || DEFAULT_SETTINGS.drawColor;
  controls.textColor.value = settings.textColor;
  controls.backgroundColor.value = settings.backgroundColor;
  controls.selectionColor.value = selectionColor;
  drawingState.currentBrushSize = settings.drawSize ?? DEFAULT_SETTINGS.drawSize;
  drawingState.currentBrushColorMode = settings.drawColorMode || DEFAULT_SETTINGS.drawColorMode;
  updateBrushSizeButtons();
  updateDrawingToolButtons();
  updateDrawColorPreview();
  
  // Update hex inputs
  if (hexInputs.textColor) hexInputs.textColor.value = settings.textColor;
  if (hexInputs.backgroundColor) hexInputs.backgroundColor.value = settings.backgroundColor;
  if (hexInputs.selectionColor) hexInputs.selectionColor.value = selectionColor;
  
  // Update value displays
  valueDisplays.fontSize.textContent = settings.fontSize + 'px';
  valueDisplays.lineHeight.textContent = settings.lineHeight;
  valueDisplays.letterSpacing.textContent = settings.letterSpacing + 'em';
  valueDisplays.maxWidth.textContent = settings.maxWidth + 'px';
  
  // Update font dropdown preview
  if (typeof updateFontDropdownSelection === 'function') {
    updateFontDropdownSelection();
  }
}

// Save note content
async function saveContent() {
  if (!currentPageId) return;
  
  try {
    syncCurrentPageScrollPosition();

    const content = editor.innerHTML;
    const pageIndex = pages.findIndex(p => p.id === currentPageId);
    if (pageIndex === -1) {
      console.warn('Current page not found in pages array');
      return;
    }
    pages[pageIndex].content = content;
    pages[pageIndex].drawings = Array.isArray(pages[pageIndex].drawings) ? pages[pageIndex].drawings : [];
    await chrome.storage.local.set({ 
      pages: pages,
      lastSaved: Date.now()
    });
    showSaveIndicator();
    updateWordCount();
  } catch (error) {
    console.error('Error saving content:', error);
  }
}

// Debounced save
const debouncedSave = debounce(saveContent, 1000);

// Show save indicator briefly
function showSaveIndicator() {
  saveIndicator.classList.add('visible');
  setTimeout(() => {
    saveIndicator.classList.remove('visible');
  }, 1500);
}

// Save settings
async function saveSettings(settings) {
  try {
    await chrome.storage.sync.set({ settings });
    // Mark that user has set a theme (for dark mode detection)
    document.documentElement.setAttribute('data-theme-set', 'true');
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Load saved data
async function loadSavedData() {
  try {
    // Load pages
    const localData = await chrome.storage.local.get(['pages', 'currentPageId', 'noteContent']);
    const syncData = await chrome.storage.sync.get(['settings']);
    
    // Migration: convert old single-note format to pages
    if (!localData.pages && localData.noteContent) {
      pages = [normalizePage({
        id: generateId(),
        emoji: DEFAULT_PAGE_EMOJI,
        content: localData.noteContent
      })];
      currentPageId = pages[0].id;
      await chrome.storage.local.set({ pages, currentPageId });
      await chrome.storage.local.remove(['noteContent']);
    } else if (localData.pages && localData.pages.length > 0) {
      pages = localData.pages.map(normalizePage);
      currentPageId = localData.currentPageId || pages[0].id;
    } else {
      // Create default page
      pages = [normalizePage({
        id: generateId(),
        emoji: DEFAULT_PAGE_EMOJI,
        content: ''
      })];
      currentPageId = pages[0].id;
      await chrome.storage.local.set({ pages, currentPageId });
    }
    
    const settings = { ...DEFAULT_SETTINGS, ...syncData.settings };
    settings.selectionColor = normalizeHex(settings.textColor || DEFAULT_SETTINGS.textColor);
    
    // Set current theme
    currentTheme = settings.currentTheme || 'lavender';
    
    applySettings(settings);
    updateControlValues(settings);
    
    // Initialize theme grid
    initThemeGrid();
    updateThemeGridSelection();

    renderPageTabs();
    loadPageContent(currentPageId);
  } catch (error) {
    console.error('Error loading saved data:', error);
    applySettings(DEFAULT_SETTINGS);
    updateControlValues(DEFAULT_SETTINGS);
    initThemeGrid();
  }
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Load page content
function loadPageContent(pageId) {
  const page = pages.find(p => p.id === pageId);
  if (page) {
    editor.innerHTML = page.content;
    currentPageId = pageId;
    chrome.storage.local.set({ currentPageId });
    renderPageTabs();
    updateWordCount();
    scheduleDrawingLayerSync();
    restorePageScrollPosition(page.scrollTop);
  }
}

// Render page tabs
function renderPageTabs() {
  pageTabsList.innerHTML = '';
  
  pages.forEach((page, index) => {
    const tab = document.createElement('button');
    const isActive = page.id === currentPageId;
    const emoji = getPageDisplayEmoji(page);

    tab.className = 'page-tab' + (isActive ? ' active' : '');
    tab.type = 'button';
    tab.title = isActive
      ? 'Current page. Click to change emoji. Drag to reorder.'
      : 'Click to switch pages. Drag to reorder.';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
    tab.setAttribute('draggable', 'true');
    tab.setAttribute('aria-label', isActive
      ? `Current page ${index + 1}. Click to change the emoji.`
      : `Open page ${index + 1}.`);
    tab.dataset.pageId = page.id;
    tab.dataset.pageIndex = index;
    
    // Create emoji element
    const span = document.createElement('span');
    span.className = 'page-tab-emoji';
    span.textContent = emoji;
    tab.appendChild(span);
    
    // Drag events for reordering
    tab.addEventListener('dragstart', handleDragStart);
    tab.addEventListener('dragover', handleDragOver);
    tab.addEventListener('drop', handleDrop);
    tab.addEventListener('dragend', handleDragEnd);
    
    // Single click to switch page
    tab.addEventListener('click', (e) => {
      e.preventDefault();

      if (page.id === currentPageId) {
        openEmojiPicker(page.id);
        return;
      }

      closeEmojiPicker();
      syncCurrentPageScrollPosition();
      saveContent();
      loadPageContent(page.id);
    });
    
    pageTabsList.appendChild(tab);
  });
  
  updateWordCount();
}

// Drag and drop state
let draggedPageId = null;

function handleDragStart(e) {
  draggedPageId = e.target.dataset.pageId;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const tab = e.target.closest('.page-tab');
  if (tab && tab.dataset.pageId !== draggedPageId) {
    tab.classList.add('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  const tab = e.target.closest('.page-tab');
  if (!tab || !draggedPageId) return;
  
  const targetId = tab.dataset.pageId;
  if (targetId === draggedPageId) return;
  
  const draggedIndex = pages.findIndex(p => p.id === draggedPageId);
  const targetIndex = pages.findIndex(p => p.id === targetId);
  
  if (draggedIndex === -1 || targetIndex === -1) return;
  
  // Reorder pages array
  const [draggedPage] = pages.splice(draggedIndex, 1);
  pages.splice(targetIndex, 0, draggedPage);
  
  chrome.storage.local.set({ pages });
  renderPageTabs();
}

function handleDragEnd(e) {
  draggedPageId = null;
  document.querySelectorAll('.page-tab').forEach(tab => {
    tab.classList.remove('dragging', 'drag-over');
  });
}

// Add new page
function addNewPage() {
  // Get a random unused emoji, or any if all used
  const usedEmojis = pages.map(p => p.emoji);
  const unusedEmojis = PAGE_EMOJIS.filter(e => !usedEmojis.includes(e));
  const emoji = unusedEmojis.length > 0 
    ? unusedEmojis[Math.floor(Math.random() * unusedEmojis.length)]
    : PAGE_EMOJIS[Math.floor(Math.random() * PAGE_EMOJIS.length)];
  
  syncCurrentPageScrollPosition();
  saveContent();
  
  const newPage = {
    id: generateId(),
    emoji: emoji,
    content: '',
    drawings: [],
    scrollTop: 0
  };
  
  pages.push(newPage);
  currentPageId = newPage.id;
  editor.innerHTML = '';
  redrawDrawings();
  
  chrome.storage.local.set({ pages, currentPageId });
  renderPageTabs();
  scheduleDrawingLayerSync();
  restorePageScrollPosition(0);
  editor.focus();
}

// Delete page
function deletePage(pageId) {
  if (pages.length <= 1) return;
  
  const pageIndex = pages.findIndex(p => p.id === pageId);
  if (pageIndex === -1) return;
  
  pages.splice(pageIndex, 1);
  
  if (currentPageId === pageId) {
    currentPageId = pages[Math.max(0, pageIndex - 1)].id;
    loadPageContent(currentPageId);
  }
  
  chrome.storage.local.set({ pages, currentPageId });
  renderPageTabs();
}

// Open emoji picker
function openEmojiPicker(pageId) {
  editingPageId = pageId;
  closeDeletePageConfirm();

  if (emojiPickerClear) {
    emojiPickerClear.disabled = !getPageById(pageId)?.emoji;
  }

  if (emojiPickerDelete) {
    emojiPickerDelete.disabled = pages.length <= 1;
    emojiPickerDelete.setAttribute('aria-expanded', 'false');
  }

  emojiPicker?.classList.add('visible');
  updateEmojiPickerState({ focusSelection: true });
  positionEmojiPicker(pageId);
}

// Close emoji picker
function closeEmojiPicker({ restoreFocus = false } = {}) {
  const pageIdToFocus = editingPageId;

  editingPageId = null;
  closeDeletePageConfirm();
  emojiPicker?.classList.remove('visible');
  if (emojiPicker) {
    emojiPicker.style.left = '';
    emojiPicker.style.top = '';
  }

  if (restoreFocus) {
    getPageTabButton(pageIdToFocus)?.focus();
  }
}

function updateEmojiPickerState({ focusSelection = false } = {}) {
  const page = getPageById(editingPageId);
  const selectedEmoji = page?.emoji || '';
  let selectedButton = null;
  let firstButton = null;

  emojiGrid?.querySelectorAll('.emoji-option').forEach(button => {
    if (!firstButton) {
      firstButton = button;
    }

    const isSelected = Boolean(selectedEmoji) && button.dataset.emoji === selectedEmoji;
    button.classList.toggle('selected', isSelected);
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

    if (isSelected) {
      selectedButton = button;
    }
  });

  if (emojiPickerClear) {
    emojiPickerClear.disabled = !selectedEmoji;
  }

  if (emojiPickerDelete) {
    emojiPickerDelete.disabled = pages.length <= 1;
  }

  if (focusSelection) {
    requestAnimationFrame(() => {
      (selectedButton || firstButton)?.focus();
    });
  }
}

function clearPageEmoji() {
  if (!editingPageId) return;

  const page = getPageById(editingPageId);
  if (!page || !page.emoji) {
    return;
  }

  page.emoji = '';
  chrome.storage.local.set({ pages, currentPageId });
  renderPageTabs();
  closeEmojiPicker({ restoreFocus: true });
}

// Select emoji for page
function selectEmoji(emoji) {
  if (!editingPageId) return;
  
  const page = getPageById(editingPageId);
  if (page) {
    page.emoji = emoji;
    chrome.storage.local.set({ pages, currentPageId });
    renderPageTabs();
  }
  
  closeEmojiPicker({ restoreFocus: true });
}

// Initialize emoji picker
function initEmojiPicker() {
  emojiGrid.innerHTML = '';
  
  PAGE_EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-option';
    btn.type = 'button';
    btn.dataset.emoji = emoji;
    btn.setAttribute('aria-label', `Set page emoji to ${emoji}`);
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = emoji;
    btn.addEventListener('click', () => selectEmoji(emoji));
    emojiGrid.appendChild(btn);
  });
  
  // Click outside to close
  document.addEventListener('click', (e) => {
    if (emojiPicker?.classList.contains('visible')) {
      if (!e.target.closest('.emoji-picker') && !e.target.closest('.page-tab')) {
        closeEmojiPicker();
      }
    }
  });
  
  // Delete button
  if (emojiPickerDelete) {
    emojiPickerDelete.addEventListener('click', (event) => {
      event.stopPropagation();

      if (!editingPageId || pages.length <= 1) {
        return;
      }

      if (uiState.deleteConfirmOpen) {
        closeDeletePageConfirm({ restoreFocus: false });
      } else {
        openDeletePageConfirm();
      }
    });
  }

  if (emojiPickerClear) {
    emojiPickerClear.addEventListener('click', (event) => {
      event.stopPropagation();
      clearPageEmoji();
    });
  }

  if (cancelDeletePageBtn) {
    cancelDeletePageBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      closeDeletePageConfirm({ restoreFocus: true });
    });
  }

  if (confirmDeletePageBtn) {
    confirmDeletePageBtn.addEventListener('click', (event) => {
      event.stopPropagation();

      if (editingPageId && pages.length > 1) {
        deletePage(editingPageId);
        closeEmojiPicker();
      }
    });
  }
}

// Get current settings from controls
function getCurrentSettings() {
  return {
    fontFamily: controls.fontFamily.value,
    fontSize: parseFloat(controls.fontSize.value),
    lineHeight: parseFloat(controls.lineHeight.value),
    letterSpacing: parseFloat(controls.letterSpacing.value),
    maxWidth: parseFloat(controls.maxWidth.value),
    drawSize: drawingState.currentBrushSize,
    drawColor: getCurrentBrushColor(),
    drawColorMode: drawingState.currentBrushColorMode,
    textColor: controls.textColor.value,
    backgroundColor: controls.backgroundColor.value,
    selectionColor: syncSelectionColorControl(controls.textColor.value),
    currentTheme: currentTheme
  };
}

// Initialize theme grid
function initThemeGrid() {
  themeGrid.innerHTML = '';
  
  Object.entries(THEMES).forEach(([key, theme]) => {
    const swatch = document.createElement('button');
    swatch.className = 'theme-swatch';
    swatch.dataset.theme = key;
    swatch.title = theme.name;
    swatch.type = 'button';
    
    const inner = document.createElement('div');
    inner.className = 'theme-swatch-inner';
    inner.style.backgroundColor = theme.backgroundColor;
    
    const preview = document.createElement('div');
    preview.className = 'theme-swatch-preview';

    const regularText = document.createElement('span');
    regularText.className = 'theme-swatch-text theme-swatch-text-regular';
    regularText.textContent = 'Aa';

    const highlightedText = document.createElement('span');
    highlightedText.className = 'theme-swatch-highlight';
    highlightedText.style.backgroundColor = theme.textColor;

    const highlightedTextLabel = document.createElement('span');
    highlightedTextLabel.className = 'theme-swatch-text theme-swatch-text-highlighted';
    regularText.style.color = theme.textColor;
    highlightedTextLabel.style.color = '#FFFFFF';
    highlightedTextLabel.textContent = 'Aa';

    highlightedText.appendChild(highlightedTextLabel);
    preview.appendChild(regularText);
    preview.appendChild(highlightedText);
    
    const nameEl = document.createElement('span');
    nameEl.className = 'theme-swatch-name';
    nameEl.textContent = theme.name;
    
    inner.appendChild(preview);
    swatch.appendChild(inner);
    swatch.appendChild(nameEl);
    
    swatch.addEventListener('click', () => selectTheme(key));
    themeGrid.appendChild(swatch);
  });
}

// Select a theme
function selectTheme(themeKey) {
  if (!THEMES[themeKey]) return;
  
  currentTheme = themeKey;
  const theme = THEMES[themeKey];
  
  // Update color controls
  controls.textColor.value = theme.textColor;
  controls.backgroundColor.value = theme.backgroundColor;
  controls.selectionColor.value = theme.textColor;
  
  // Update hex inputs
  if (hexInputs.textColor) hexInputs.textColor.value = theme.textColor;
  if (hexInputs.backgroundColor) hexInputs.backgroundColor.value = theme.backgroundColor;
  if (hexInputs.selectionColor) hexInputs.selectionColor.value = theme.textColor;

  if (drawingState.currentBrushColorMode !== 'custom') {
    setBrushColor(theme.textColor, { persist: false, mode: 'theme' });
  }
  
  // Apply and save
  handleSettingChange();
  updateThemeGridSelection();
}

// Update theme grid selection state
function updateThemeGridSelection() {
  const swatches = themeGrid.querySelectorAll('.theme-swatch');
  swatches.forEach(swatch => {
    if (swatch.dataset.theme === currentTheme) {
      swatch.classList.add('active');
    } else {
      swatch.classList.remove('active');
    }
  });
}

// Handle manual color changes (marks theme as custom)
function handleColorChange() {
  // Check if current colors match any theme
  const textColor = controls.textColor.value.toUpperCase();
  const bgColor = controls.backgroundColor.value.toUpperCase();
  const selColor = syncSelectionColorControl(textColor).toUpperCase();
  
  // Sync hex inputs
  if (hexInputs.textColor) hexInputs.textColor.value = controls.textColor.value;
  if (hexInputs.backgroundColor) hexInputs.backgroundColor.value = controls.backgroundColor.value;
  if (hexInputs.selectionColor) hexInputs.selectionColor.value = selColor;
  
  let matchedTheme = null;
  for (const [key, theme] of Object.entries(THEMES)) {
    if (theme.textColor.toUpperCase() === textColor &&
        theme.backgroundColor.toUpperCase() === bgColor &&
        theme.textColor.toUpperCase() === selColor) {
      matchedTheme = key;
      break;
    }
  }
  
  currentTheme = matchedTheme || 'custom';
  if (drawingState.currentBrushColorMode !== 'custom') {
    setBrushColor(controls.textColor.value, { persist: false, mode: 'theme' });
  }
  updateThemeGridSelection();
  handleSettingChange();
}

// Handle hex input changes
function handleHexInputChange(colorKey) {
  const hexInput = hexInputs[colorKey];
  const colorInput = controls[colorKey];
  if (!hexInput || !colorInput) return;

  if (colorKey === 'selectionColor') {
    syncSelectionColorControl();
    return;
  }
  
  let value = hexInput.value.trim();
  
  // Add # if missing
  if (value && !value.startsWith('#')) {
    value = '#' + value;
  }
  
  // Validate hex color
  const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value);
  
  if (isValidHex) {
    // Expand 3-char hex to 6-char
    if (value.length === 4) {
      value = '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
    }
    hexInput.value = value.toUpperCase();
    colorInput.value = value;
    handleColorChange();
  }
}

// Handle setting changes
function handleSettingChange() {
  const settings = getCurrentSettings();
  applySettings(settings);
  saveSettings(settings);
  
  // Update value displays
  valueDisplays.fontSize.textContent = settings.fontSize + 'px';
  valueDisplays.lineHeight.textContent = settings.lineHeight;
  valueDisplays.letterSpacing.textContent = settings.letterSpacing + 'em';
  valueDisplays.maxWidth.textContent = settings.maxWidth + 'px';

  scheduleDrawingLayerSync();
}

// Reset settings to defaults
function resetSettings() {
  currentTheme = 'lavender';
  const resetSettingsValues = { ...DEFAULT_SETTINGS, selectionColor: DEFAULT_SETTINGS.textColor };
  applySettings(resetSettingsValues);
  updateControlValues(resetSettingsValues);
  saveSettings(resetSettingsValues);
  updateThemeGridSelection();
  scheduleDrawingLayerSync();
}

// Event Listeners

// Editor input - auto-save
editor.addEventListener('input', debouncedSave);
editor.addEventListener('input', scheduleDrawingLayerSync);

// Prevent unwanted formatting on paste - keep plain text
editor.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  const selection = window.getSelection();
  if (selection.rangeCount) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
});

// Tab key handling for indentation (Markdown-like behavior)
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    if (e.shiftKey) {
      // Shift+Tab: Un-indent (remove one level)
      handleUnindent(selection);
    } else {
      // Tab: Indent
      handleIndent(selection);
    }
    
    debouncedSave();
  }
});

// Insert tab or indent selected lines
function handleIndent(selection) {
  const range = selection.getRangeAt(0);
  
  if (range.collapsed) {
    // No selection - just insert a tab character
    insertTextAtCursor('\t');
  } else {
    // Multi-line selection - indent each line
    const selectedText = range.toString();
    const lines = selectedText.split('\n');
    const indentedText = lines.map(line => '\t' + line).join('\n');
    insertTextAtCursor(indentedText);
  }
}

// Modern text insertion helper (replaces deprecated execCommand)
function insertTextAtCursor(text) {
  const selection = window.getSelection();
  if (selection.rangeCount) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// Remove one level of indentation (1 tab or up to 4 spaces)
function handleUnindent(selection) {
  const range = selection.getRangeAt(0);
  
  // Get the current line or selected text
  if (range.collapsed) {
    // No selection - unindent current line
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const offset = range.startOffset;
      
      // Find line start
      let lineStart = text.lastIndexOf('\n', offset - 1) + 1;
      
      // Check for leading tab or spaces
      if (text[lineStart] === '\t') {
        // Remove one tab
        node.textContent = text.slice(0, lineStart) + text.slice(lineStart + 1);
        range.setStart(node, Math.max(lineStart, offset - 1));
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // Remove up to 4 leading spaces
        let spacesToRemove = 0;
        for (let i = 0; i < 4 && text[lineStart + i] === ' '; i++) {
          spacesToRemove++;
        }
        if (spacesToRemove > 0) {
          node.textContent = text.slice(0, lineStart) + text.slice(lineStart + spacesToRemove);
          range.setStart(node, Math.max(lineStart, offset - spacesToRemove));
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  } else {
    // Multi-line selection - unindent each line
    const selectedText = range.toString();
    const lines = selectedText.split('\n');
    const unindentedText = lines.map(line => {
      if (line.startsWith('\t')) {
        return line.slice(1);
      } else {
        // Remove up to 4 leading spaces
        const match = line.match(/^( {1,4})/);
        return match ? line.slice(match[1].length) : line;
      }
    }).join('\n');
    insertTextAtCursor(unindentedText);
  }
}

// Setting controls
['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'maxWidth'].forEach(key => {
  controls[key].addEventListener('input', handleSettingChange);
  controls[key].addEventListener('change', handleSettingChange);
});

// Color controls - use special handler
['textColor', 'backgroundColor'].forEach(key => {
  controls[key].addEventListener('input', handleColorChange);
  controls[key].addEventListener('change', handleColorChange);
});

// Hex input controls
['textColor', 'backgroundColor', 'selectionColor'].forEach(key => {
  if (hexInputs[key]) {
    hexInputs[key].addEventListener('input', () => handleHexInputChange(key));
    hexInputs[key].addEventListener('change', () => handleHexInputChange(key));
    hexInputs[key].addEventListener('blur', () => handleHexInputChange(key));
  }
});

// Reset button
document.getElementById('resetSettings').addEventListener('click', resetSettings);

// Settings panel controls
if (settingsToggleBtn) {
  settingsToggleBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    setSettingsPanelOpen(!uiState.settingsOpen);
  });
}

if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener('click', () => {
    setSettingsPanelOpen(false);
    settingsToggleBtn?.focus();
  });
}

// Add page button
addPageBtn.addEventListener('click', addNewPage);

if (pageTabsList) {
  pageTabsList.addEventListener('pointerdown', () => {
    closeDeletePageConfirm();
  });
}

// Drawing mode controls
if (drawToggleBtn) {
  drawToggleBtn.addEventListener('click', (event) => {
    toggleDrawingTool('brush');
    event.currentTarget.blur();
  });
}

if (eraseToggleBtn) {
  eraseToggleBtn.addEventListener('click', (event) => {
    toggleDrawingTool('eraser');
    event.currentTarget.blur();
  });
}

drawSizeButtons.forEach(button => {
  button.addEventListener('click', (event) => {
    setBrushSize(button.dataset.drawSize);
    event.currentTarget.blur();
  });
});

if (undoDrawingBtn) {
  undoDrawingBtn.addEventListener('click', (event) => {
    undoLastStroke();
    event.currentTarget.blur();
  });
}

if (clearDrawingsBtn) {
  clearDrawingsBtn.addEventListener('click', (event) => {
    clearCurrentPageDrawings();
    event.currentTarget.blur();
  });
}

if (drawingLayer) {
  drawingLayer.addEventListener('pointerdown', beginStroke);
  drawingLayer.addEventListener('pointermove', extendStroke);
  drawingLayer.addEventListener('pointerup', finishStroke);
  drawingLayer.addEventListener('pointercancel', finishStroke);
}

window.addEventListener('resize', () => {
  scheduleDrawingLayerSync();
  if (emojiPicker?.classList.contains('visible')) {
    positionEmojiPicker(editingPageId);
  }
});

window.addEventListener('scroll', () => {
  handleScrollActivity({ persistPageScroll: true });
}, { passive: true });

if (pageTabsList) {
  pageTabsList.addEventListener('scroll', () => {
    handleScrollActivity({ repositionEmojiPicker: true });
  }, { passive: true });
}

if (emojiPicker) {
  emojiPicker.addEventListener('scroll', () => {
    handleScrollActivity();
  }, { passive: true });
}

window.addEventListener('pagehide', () => {
  syncCurrentPageScrollPosition();
  persistPagesStateImmediately();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    syncCurrentPageScrollPosition();
    persistPagesStateImmediately();
  }
});

document.addEventListener('click', (event) => {
  if (uiState.settingsOpen && !event.target.closest('.controls-container') && !event.target.closest('.color-picker-popup')) {
    setSettingsPanelOpen(false);
  }

  if (uiState.deleteConfirmOpen && !event.target.closest('#deletePageConfirm') && !event.target.closest('#emojiPickerDelete')) {
    closeDeletePageConfirm();
  }
});

if (window.ResizeObserver && board) {
  const resizeObserver = new ResizeObserver(() => {
    scheduleDrawingLayerSync();
  });

  resizeObserver.observe(board);
  if (editorShell) {
    resizeObserver.observe(editorShell);
  }
  resizeObserver.observe(editor);
}

// Initialize emoji picker
initEmojiPicker();

// Initialize font dropdown
initFontDropdown();

// Word count element
const wordCountEl = document.getElementById('wordCount');

// Update word/character count
function updateWordCount() {
  if (!wordCountEl) return;
  const text = editor.innerText || '';
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  wordCountEl.textContent = `${words} words · ${chars} chars`;
}

// Debounced word count update
const debouncedWordCount = debounce(updateWordCount, 300);
editor.addEventListener('input', debouncedWordCount);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  const isModifierPressed = e.ctrlKey || e.metaKey;

  if (e.key === 'Escape') {
    if (uiState.deleteConfirmOpen) {
      e.preventDefault();
      closeDeletePageConfirm({ restoreFocus: true });
      return;
    }

    if (colorPickerState.isOpen) {
      e.preventDefault();
      closeColorPicker();
      return;
    }

    if (fontDropdownOpen) {
      e.preventDefault();
      closeFontDropdown();
      return;
    }

    if (emojiPicker?.classList.contains('visible')) {
      e.preventDefault();
      closeEmojiPicker({ restoreFocus: true });
      return;
    }

    if (uiState.settingsOpen) {
      e.preventDefault();
      setSettingsPanelOpen(false);
      settingsToggleBtn?.focus();
      return;
    }
  }

  if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'b' && shouldHandleBrushToggleShortcut(e)) {
    e.preventDefault();
    toggleDrawingTool('brush');
    return;
  }

  if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'e' && shouldHandleBrushToggleShortcut(e)) {
    e.preventDefault();
    toggleDrawingTool('eraser');
    return;
  }

  if (isUndoShortcut(e)) {
    if (drawingState.enabled && !isFormFieldShortcutTarget(e)) {
      e.preventDefault();
      undoLastStroke();
      return;
    }

    if (isTextEditingShortcutTarget(e)) {
      return;
    }
  }

  if (drawingState.enabled && shouldHandleDrawingShortcut(e)) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setDrawMode(false);
      return;
    }
  }

  if (!shouldHandleGlobalShortcut(e)) {
    return;
  }

  // Ctrl+N: New page
  if (isModifierPressed && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    addNewPage();
  }
});

// Initialize
loadSavedData();
scheduleDrawingLayerSync();

// Focus editor on load
editor.focus();
