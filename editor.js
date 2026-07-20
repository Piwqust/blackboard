import { createWorkspaceBackup, describeBackup, makeBackupFilename, parseWorkspaceBackup, serializeWorkspaceBackup } from './src/core/backup.js';
import { isExtensionContext, readLegacyChromeWorkspace } from './src/core/legacy-chrome.js';
import { migrateFontFamily, normalizeSettings } from './src/core/schema.js';
import { createWorkspaceStore } from './src/core/workspace-store.js';
import { acquireWorkspaceLock, createWorkspaceChannel } from './src/core/workspace-lock.js';
import { createStatusAnnouncer } from './src/ui/app-status.js';
import { registerPwaUpdates } from './src/ui/pwa-updates.js';

const APP_VERSION = '2.0.0';

// Theme presets
const THEMES = {
  lavender: {
    name: 'Lavender',
    textColor: '#5B4FA8',
    backgroundColor: '#F2F0F8',
    selectionColor: '#5B4FA8'
  },
  midnight: {
    name: 'Midnight',
    textColor: '#E4DFD0',
    backgroundColor: '#10172A',
    selectionColor: '#E4DFD0'
  },
  sepia: {
    name: 'Sepia',
    textColor: '#4A2E1F',
    backgroundColor: '#F6EAD3',
    selectionColor: '#4A2E1F'
  },
  forest: {
    name: 'Forest',
    textColor: '#1F4D2B',
    backgroundColor: '#EDF3E5',
    selectionColor: '#1F4D2B'
  },
  ocean: {
    name: 'Ocean',
    textColor: '#0F4C5C',
    backgroundColor: '#E0EEF2',
    selectionColor: '#0F4C5C'
  },
  rose: {
    name: 'Rosé',
    textColor: '#7A3B4D',
    backgroundColor: '#FCEDEF',
    selectionColor: '#7A3B4D'
  },
  charcoal: {
    name: 'Charcoal',
    textColor: '#DDDAD2',
    backgroundColor: '#1F1F23',
    selectionColor: '#DDDAD2'
  },
  paper: {
    name: 'Paper',
    textColor: '#1A1A1A',
    backgroundColor: '#FAFAF7',
    selectionColor: '#1A1A1A'
  }
};

// Default settings
const DEFAULT_SETTINGS = {
  fontFamily: "'Inter Tight', sans-serif",
  fontSize: 40,
  lineHeight: 1.6,
  letterSpacing: 0,
  maxWidth: 1600,
  drawSize: 4 / 18,
  drawColor: '#5B4FA8',
  drawColorMode: 'theme',
  textColor: '#5B4FA8',
  backgroundColor: '#F2F0F8',
  selectionColor: '#5B4FA8',
  currentTheme: 'lavender'
};

const DRAWING_COORDINATE_SPACE = 'text-scaled-px';
const LEGACY_DRAWING_COORDINATE_SPACE = 'font-relative';
const MIN_DRAW_SIZE = 0.08;
const MAX_DRAW_SIZE = 1.4;
// Squared minimum distance (px²) between consecutive stored stroke points.
const MIN_STROKE_POINT_DISTANCE_SQ = 1.5 * 1.5;

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
const MAX_PAGE_TITLE_LENGTH = 80;

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
const drawSizeToggleBtn = document.getElementById('drawSizeToggleBtn');
const drawSizeToggleStroke = document.getElementById('drawSizeToggleStroke');
const drawSizePopover = document.getElementById('drawSizePopover');
const settingsToggleBtn = document.getElementById('settingsToggleBtn');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const controlsContainer = document.querySelector('.controls-container');
const saveIndicator = document.getElementById('saveIndicator');
const pageTabsList = document.getElementById('pageTabsList');
const addPageBtn = document.getElementById('addPageBtn');
const emojiPicker = document.getElementById('emojiPicker');
const emojiGrid = document.getElementById('emojiGrid');
const pageTitleInput = document.getElementById('pageTitleInput');
const emojiPickerClear = document.getElementById('emojiPickerClear');
const emojiPickerDelete = document.getElementById('emojiPickerDelete');
const emojiPickerClose = document.getElementById('emojiPickerClose');
const deletePageConfirm = document.getElementById('deletePageConfirm');
const cancelDeletePageBtn = document.getElementById('cancelDeletePageBtn');
const confirmDeletePageBtn = document.getElementById('confirmDeletePageBtn');
const themeGrid = document.getElementById('themeGrid');
const clearDrawingsConfirm = document.getElementById('clearDrawingsConfirm');
const cancelClearDrawingsBtn = document.getElementById('cancelClearDrawingsBtn');
const confirmClearDrawingsBtn = document.getElementById('confirmClearDrawingsBtn');
const colorPickerMatchTheme = document.getElementById('colorPickerMatchTheme');
const exportWorkspaceBtn = document.getElementById('exportWorkspaceBtn');
const importWorkspaceBtn = document.getElementById('importWorkspaceBtn');
const importWorkspaceInput = document.getElementById('importWorkspaceInput');
const importConfirmDialog = document.getElementById('importConfirmDialog');
const importConfirmText = document.getElementById('importConfirmText');
const cancelImportBtn = document.getElementById('cancelImportBtn');
const confirmImportBtn = document.getElementById('confirmImportBtn');
const restoreSnapshotBtn = document.getElementById('restoreSnapshotBtn');
const recoverySummary = document.getElementById('recoverySummary');
const restoreConfirmDialog = document.getElementById('restoreConfirmDialog');
const restoreConfirmText = document.getElementById('restoreConfirmText');
const cancelRestoreBtn = document.getElementById('cancelRestoreBtn');
const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
const storageSummary = document.getElementById('storageSummary');
const workspaceModeNotice = document.getElementById('workspaceModeNotice');
const appStatus = document.getElementById('appStatus');
const updateReadyNotice = document.getElementById('updateReadyNotice');
const reloadForUpdateBtn = document.getElementById('reloadForUpdateBtn');

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

const drawSizeSlider = document.getElementById('drawSize');
const drawSizeValue = document.getElementById('drawSizeValue');
const drawSizeMarkers = document.getElementById('drawSizeMarkers');
// Marker buttons live in `drawSizeMarkerButtons` once `initBrushSizeMarkers`
// runs — they don't exist at module load, so there's no top-level handle.
const DRAW_SIZE_MARKERS = [0.08, 0.14, 0.22, 0.32, 0.46, 0.66, 0.92, 1.22];

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

// Pick black or white based on the WCAG relative luminance of a hex color.
// Used to keep selected text readable regardless of the highlight color.
function getContrastingTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channel = c => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
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
  const labels = { textColor: 'Text Color', backgroundColor: 'Background', selectionColor: 'Highlight', drawColor: 'Brush Color' };

  closeDrawSizePopover();

  if (colorKey === 'drawColor') {
    setSettingsPanelOpen(false);
  } else {
    closeDeletePageConfirm();
  }

  colorPickerState.activeColorKey = colorKey;
  colorPickerState.isOpen = true;

  // "Match theme" is only meaningful for the brush color (where mode='custom'
  // means the brush no longer follows theme changes). Hide it elsewhere.
  if (colorPickerMatchTheme) {
    const isBrushCustom = colorKey === 'drawColor' && drawingState.currentBrushColorMode === 'custom';
    colorPickerMatchTheme.hidden = !isBrushCustom;
  }

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
  
  // Position popup near trigger. The popup is hidden via opacity/visibility,
  // not display, so its rendered size is measurable before it becomes visible.
  const rect = triggerElement.getBoundingClientRect();
  const popupWidth = colorPickerPopup.offsetWidth || 220;
  const popupHeight = colorPickerPopup.offsetHeight || 340;
  
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
    // The brush just stopped following theme — reveal "Match theme color".
    if (colorPickerMatchTheme) {
      colorPickerMatchTheme.hidden = false;
    }
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

// Color area pointer events — pointer capture keeps the drag alive even when
// the pointer leaves the area, and works for mouse, touch, and pen alike.
if (colorPickerArea) {
  colorPickerArea.addEventListener('pointerdown', (e) => {
    colorPickerState.isDragging = true;
    if (colorPickerArea.setPointerCapture) {
      try {
        colorPickerArea.setPointerCapture(e.pointerId);
      } catch (error) {
        // Ignore capture errors (e.g. pointer already released).
      }
    }
    handleAreaInteraction(e);
  });

  colorPickerArea.addEventListener('pointermove', (e) => {
    if (colorPickerState.isDragging) {
      handleAreaInteraction(e);
    }
  });

  const endColorAreaDrag = () => {
    colorPickerState.isDragging = false;
  };
  colorPickerArea.addEventListener('pointerup', endColorAreaDrag);
  colorPickerArea.addEventListener('pointercancel', endColorAreaDrag);
}

// Hue slider
if (colorPickerHue) {
  colorPickerHue.addEventListener('input', () => {
    colorPickerState.hue = parseInt(colorPickerHue.value, 10);
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

// "Match theme color" — only relevant for brush color. Pulls the current
// theme's text color and flips brush mode back to 'theme' so future theme
// switches keep the brush in sync.
colorPickerMatchTheme?.addEventListener('click', () => {
  const themeColor = controls.textColor?.value || DEFAULT_SETTINGS.textColor;
  setBrushColor(themeColor, { persist: true, mode: 'theme' });

  // Sync the picker's internal HSB state to the new color so the cursor
  // jumps to the right swatch and "New" preview updates.
  const hsb = hexToHsb(themeColor);
  colorPickerState.hue = hsb.h;
  colorPickerState.sat = hsb.s;
  colorPickerState.brightness = hsb.b;
  if (colorPickerHue) colorPickerHue.value = hsb.h;
  updateColorPickerDisplay();
  if (colorPickerMatchTheme) colorPickerMatchTheme.hidden = true;
});

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
    label: 'Bundled fonts',
    fonts: [
      { value: "'Inter', sans-serif", name: 'Inter' },
      { value: "'Inter Tight', sans-serif", name: 'Inter Tight' }
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

function positionFontDropdown() {
  if (!fontDropdownTrigger || !fontDropdownMenu) return;

  const triggerRect = fontDropdownTrigger.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const gap = 8;
  const spaceBelow = viewportH - triggerRect.bottom - gap;
  const spaceAbove = triggerRect.top - gap;

  // Measure the menu's natural height by temporarily neutralizing constraints.
  const prevMaxHeight = fontDropdownMenu.style.maxHeight;
  fontDropdownMenu.style.maxHeight = 'none';
  const naturalHeight = fontDropdownMenu.scrollHeight;
  fontDropdownMenu.style.maxHeight = prevMaxHeight;

  const flipUp = spaceBelow < naturalHeight && spaceAbove > spaceBelow;
  fontDropdownMenu.classList.toggle('flip-up', flipUp);
  const cap = Math.max(120, Math.floor((flipUp ? spaceAbove : spaceBelow)));
  fontDropdownMenu.style.maxHeight = `${Math.min(naturalHeight, cap)}px`;
}

function toggleFontDropdown() {
  fontDropdownOpen = !fontDropdownOpen;
  fontDropdownTrigger.classList.toggle('open', fontDropdownOpen);

  if (fontDropdownOpen) {
    positionFontDropdown();
    updateFontDropdownSelection();
  }

  fontDropdownMenu.classList.toggle('visible', fontDropdownOpen);
}

function closeFontDropdown() {
  fontDropdownOpen = false;
  fontDropdownTrigger?.classList.remove('open');
  fontDropdownMenu?.classList.remove('visible');
}

function selectFont(value, name) {
  if (!workspaceWritable) return;
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
let scrollRestoreFrame = null;
let scrollRestoreNestedFrame = null;
let isRestoringPageScroll = false;
let hoverResetOnPointerMove = false;
let drawSizeMarkerButtons = [];
let workspaceWritable = true;
let workspaceLock = null;
let pendingWorkspaceImport = null;
let pendingRecoverySnapshot = null;
const workspaceStore = createWorkspaceStore();
const workspaceChannel = createWorkspaceChannel();
const statusAnnouncer = createStatusAnnouncer(appStatus);

// Overlay/menu state
const uiState = {
  settingsOpen: false,
  deleteConfirmOpen: false,
  drawSizePopoverOpen: false,
  clearDrawingsConfirmOpen: false
};

// Drawing state
const drawingContext = drawingLayer
  ? (drawingLayer.getContext('2d', { desynchronized: true }) || drawingLayer.getContext('2d'))
  : null;
const drawingState = {
  enabled: false,
  isDrawing: false,
  currentStroke: null,
  currentTool: 'brush',
  currentBrushSize: DEFAULT_SETTINGS.drawSize,
  currentBrushColorMode: DEFAULT_SETTINGS.drawColorMode,
  syncFrame: null,
  strokeFrame: null,
  activeBoardRect: null,
  lastRenderedPointIndex: -1,
  pendingFullRedraw: false,
  scrollTopBeforeMode: 0,
  activePointerId: null
};

function getNormalizedFontSize(fontSize = controls.fontSize?.value || DEFAULT_SETTINGS.fontSize) {
  const parsedFontSize = Number(fontSize);
  return Number.isFinite(parsedFontSize) && parsedFontSize > 0 ? parsedFontSize : DEFAULT_SETTINGS.fontSize;
}

function clampBrushSize(size) {
  const parsedSize = Number(size);

  if (!Number.isFinite(parsedSize)) {
    return DEFAULT_SETTINGS.drawSize;
  }

  return Math.min(MAX_DRAW_SIZE, Math.max(MIN_DRAW_SIZE, parsedSize));
}

function normalizeBrushSizeSetting(size, fontSize = DEFAULT_SETTINGS.fontSize) {
  const parsedSize = Number(size);
  if (!Number.isFinite(parsedSize)) {
    return DEFAULT_SETTINGS.drawSize;
  }

  const normalizedFontSize = getNormalizedFontSize(fontSize);
  const scaledSize = parsedSize > MAX_DRAW_SIZE ? parsedSize / normalizedFontSize : parsedSize;
  return clampBrushSize(scaledSize);
}

function normalizeStoredPoint(point = {}) {
  const x = Number(point?.x);
  const y = Number(point?.y);

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0
  };
}

function getStrokeReferenceFontSize(stroke = {}, fallbackFontSize = DEFAULT_SETTINGS.fontSize) {
  return getNormalizedFontSize(stroke.referenceFontSize ?? stroke.fontSize ?? fallbackFontSize);
}

function convertLegacyPointToStoredPixels(point, fontSize = DEFAULT_SETTINGS.fontSize) {
  const normalizedFontSize = getNormalizedFontSize(fontSize);
  const normalizedPoint = normalizeStoredPoint(point);

  return {
    x: normalizedPoint.x * normalizedFontSize,
    y: normalizedPoint.y * normalizedFontSize
  };
}

function convertPointToCanvasPixels(point, referenceFontSize = DEFAULT_SETTINGS.fontSize, fontSize = getNormalizedFontSize()) {
  const normalizedReferenceFontSize = getNormalizedFontSize(referenceFontSize);
  const normalizedFontSize = getNormalizedFontSize(fontSize);
  const normalizedPoint = normalizeStoredPoint(point);
  const scaleFactor = normalizedFontSize / normalizedReferenceFontSize;

  return {
    x: normalizedPoint.x * scaleFactor,
    y: normalizedPoint.y * scaleFactor
  };
}

function getBrushSizeInPixels(size = drawingState.currentBrushSize, fontSize = getNormalizedFontSize()) {
  return Math.max(1, clampBrushSize(size) * getNormalizedFontSize(fontSize));
}

function formatBrushSizeLabel(size = drawingState.currentBrushSize, fontSize = getNormalizedFontSize()) {
  const pixelValue = getBrushSizeInPixels(size, fontSize);
  const roundedPixels = pixelValue >= 10 ? pixelValue.toFixed(0) : pixelValue.toFixed(1);
  const normalizedPixels = roundedPixels.replace(/\.0$/, '');
  return `${normalizedPixels}px`;
}

function getClosestBrushMarkerSize(size = drawingState.currentBrushSize) {
  const normalizedBrushSize = clampBrushSize(size);

  return DRAW_SIZE_MARKERS.reduce((closestSize, markerSize) => {
    return Math.abs(markerSize - normalizedBrushSize) < Math.abs(closestSize - normalizedBrushSize)
      ? markerSize
      : closestSize;
  }, DRAW_SIZE_MARKERS[0]);
}

function updateBrushSizeMarkers(size = drawingState.currentBrushSize) {
  if (!drawSizeMarkerButtons.length) {
    return;
  }

  const activeMarkerSize = getClosestBrushMarkerSize(size);

  drawSizeMarkerButtons.forEach(button => {
    const markerSize = Number(button.dataset.drawSize);
    const isActive = Math.abs(markerSize - activeMarkerSize) < 0.001;
    const previewHeight = Math.min(16, Math.max(2, getBrushSizeInPixels(markerSize) / 1.7));

    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
    button.style.setProperty('--marker-stroke-height', `${previewHeight}px`);
    button.title = formatBrushSizeLabel(markerSize);
  });
}

function initBrushSizeMarkers() {
  if (!drawSizeMarkers) {
    return;
  }

  drawSizeMarkers.innerHTML = '';
  drawSizeMarkerButtons = DRAW_SIZE_MARKERS.map(markerSize => {
    const button = document.createElement('button');
    const swatch = document.createElement('span');

    button.className = 'drawing-size-marker';
    button.type = 'button';
    button.dataset.drawSize = String(markerSize);
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-label', `Set brush size to ${formatBrushSizeLabel(markerSize)}`);
    button.setAttribute('aria-pressed', 'false');

    swatch.className = 'drawing-size-marker-swatch';
    button.appendChild(swatch);
    button.addEventListener('click', () => setBrushSize(markerSize));
    drawSizeMarkers.appendChild(button);

    return button;
  });

  updateBrushSizeMarkers();
}

function updateBrushSizeButtons() {
  const normalizedBrushSize = clampBrushSize(drawingState.currentBrushSize);
  const brushSizeLabel = formatBrushSizeLabel(normalizedBrushSize);

  drawingState.currentBrushSize = normalizedBrushSize;

  if (drawSizeSlider) {
    drawSizeSlider.value = normalizedBrushSize;
    drawSizeSlider.setAttribute('aria-valuetext', brushSizeLabel);
  }

  if (drawSizeValue) {
    drawSizeValue.textContent = brushSizeLabel;
  }

  if (drawSizeToggleBtn) {
    drawSizeToggleBtn.setAttribute('aria-label', `Brush size: ${brushSizeLabel}`);
    drawSizeToggleBtn.title = `Brush size: ${brushSizeLabel}`;
  }

  if (drawSizeToggleStroke) {
    const previewHeight = Math.min(10, Math.max(2, getBrushSizeInPixels(normalizedBrushSize) / 1.9));
    drawSizeToggleStroke.style.setProperty('--draw-size-preview-height', `${previewHeight}px`);
  }

  updateBrushSizeMarkers(normalizedBrushSize);
}

function normalizeStroke(stroke = {}, fontSize = DEFAULT_SETTINGS.fontSize) {
  const points = Array.isArray(stroke.points) ? stroke.points : [];
  const isCurrentCoordinateSpace = stroke.coordinateSpace === DRAWING_COORDINATE_SPACE;
  const isLegacyFontRelativeStroke = stroke.coordinateSpace === LEGACY_DRAWING_COORDINATE_SPACE;
  const referenceFontSize = getStrokeReferenceFontSize(stroke, fontSize);

  return {
    id: stroke.id || generateId(),
    tool: stroke.tool === 'eraser' ? 'eraser' : 'brush',
    color: stroke.tool === 'eraser' ? null : (stroke.color || null),
    width: isCurrentCoordinateSpace || isLegacyFontRelativeStroke
      ? clampBrushSize(stroke.width)
      : normalizeBrushSizeSetting(stroke.width, referenceFontSize),
    points: points.map(point => {
      if (isCurrentCoordinateSpace) {
        return normalizeStoredPoint(point);
      }

      if (isLegacyFontRelativeStroke) {
        return convertLegacyPointToStoredPixels(point, referenceFontSize);
      }

      return normalizeStoredPoint(point);
    }),
    coordinateSpace: DRAWING_COORDINATE_SPACE,
    referenceFontSize
  };
}

function normalizePage(page = {}, fontSize = DEFAULT_SETTINGS.fontSize) {
  const parsedScrollTop = Number(page.scrollTop);

  return {
    id: page.id || generateId(),
    emoji: typeof page.emoji === 'string' ? page.emoji : DEFAULT_PAGE_EMOJI,
    title: typeof page.title === 'string' ? page.title.slice(0, MAX_PAGE_TITLE_LENGTH) : '',
    content: typeof page.content === 'string' ? page.content : '',
    drawings: Array.isArray(page.drawings) ? page.drawings.map(stroke => normalizeStroke(stroke, fontSize)) : [],
    scrollTop: Number.isFinite(parsedScrollTop) && parsedScrollTop > 0 ? parsedScrollTop : 0
  };
}

function getPageDisplayTitle(page) {
  return typeof page?.title === 'string' ? page.title.trim() : '';
}

// Tooltip + accessible name for a tab, built from the optional page name.
function getPageTabLabels(page, index, isActive) {
  const name = getPageDisplayTitle(page);

  if (isActive) {
    return {
      title: name
        ? `${name} — current page. Click to change emoji or name. Drag to reorder.`
        : 'Current page. Click to change emoji. Drag to reorder.',
      ariaLabel: name
        ? `Current page: ${name}. Click to change the emoji or name.`
        : `Current page ${index + 1}. Click to change the emoji.`
    };
  }

  return {
    title: name
      ? `${name} — click to switch pages. Drag to reorder.`
      : 'Click to switch pages. Drag to reorder.',
    ariaLabel: name ? `Open page: ${name}.` : `Open page ${index + 1}.`
  };
}

// Refresh one tab's tooltip/aria-label in place (used while typing a name, so
// the whole rail doesn't re-render on every keystroke).
function updatePageTabLabels(pageId) {
  const page = getPageById(pageId);
  const tab = getPageTabButton(pageId);
  if (!page || !tab) {
    return;
  }

  const index = pages.indexOf(page);
  const labels = getPageTabLabels(page, index, page.id === currentPageId);
  tab.title = labels.title;
  tab.setAttribute('aria-label', labels.ariaLabel);
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

  // While a page-switch restore is mid-flight, the viewport may briefly hold a
  // clamped scroll value that doesn't represent the user's intent yet.
  if (isRestoringPageScroll) {
    return;
  }

  page.scrollTop = getViewportScrollTop();
}

function persistCurrentPageScrollPosition({ immediate = false } = {}) {
  syncCurrentPageScrollPosition();

  if (immediate) {
    persistPagesStateImmediately();
    return;
  }

  persistPagesState();
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

  // Cancel any pending restore from a previous switch so it can't overwrite this one.
  if (scrollRestoreTimeout) {
    clearTimeout(scrollRestoreTimeout);
    scrollRestoreTimeout = null;
  }
  if (scrollRestoreFrame !== null) {
    cancelAnimationFrame(scrollRestoreFrame);
    scrollRestoreFrame = null;
  }
  if (scrollRestoreNestedFrame !== null) {
    cancelAnimationFrame(scrollRestoreNestedFrame);
    scrollRestoreNestedFrame = null;
  }

  // Block the scroll-event listener from overwriting page.scrollTop with the
  // intermediate clamped values that fire while layout is still settling.
  isRestoringPageScroll = true;
  applyScroll();

  scrollRestoreFrame = requestAnimationFrame(() => {
    scrollRestoreFrame = null;
    applyScroll();
    scrollRestoreNestedFrame = requestAnimationFrame(() => {
      scrollRestoreNestedFrame = null;
      applyScroll();
    });
  });

  scrollRestoreTimeout = setTimeout(() => {
    applyScroll();
    scrollRestoreTimeout = null;
    isRestoringPageScroll = false;
  }, 120);
}

function clearHoverEffectsSuppression() {
  document.body.classList.remove('is-scrolling');

  if (hoverResetTimeout) {
    clearTimeout(hoverResetTimeout);
    hoverResetTimeout = null;
  }

  if (hoverResetOnPointerMove) {
    window.removeEventListener('pointermove', clearHoverEffectsSuppression);
    hoverResetOnPointerMove = false;
  }
}

function suppressHoverEffects() {
  document.body.classList.add('is-scrolling');

  if (hoverResetTimeout) {
    clearTimeout(hoverResetTimeout);
  }

  if (!hoverResetOnPointerMove) {
    window.addEventListener('pointermove', clearHoverEffectsSuppression, { passive: true });
    hoverResetOnPointerMove = true;
  }

  hoverResetTimeout = setTimeout(() => {
    clearHoverEffectsSuppression();
  }, 480);
}

function handleScrollActivity({ repositionEmojiPicker = false, persistPageScroll = false } = {}) {
  suppressHoverEffects();

  if (repositionEmojiPicker && emojiPicker?.classList.contains('visible')) {
    positionEmojiPicker(editingPageId);
  }

  if (uiState.deleteConfirmOpen) {
    positionDeletePageConfirm();
  }

  if (persistPageScroll) {
    persistCurrentPageScrollPosition();
  }
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
  if (!workspaceWritable) return;
  if (!controls.drawColor || !color) {
    return;
  }

  controls.drawColor.value = color;
  drawingState.currentBrushColorMode = mode;
  updateDrawColorPreview();
  redrawDrawings();

  if (persist) {
    scheduleSettingsSave();
  }
}

function setBrushSize(size, persist = true) {
  if (!workspaceWritable) return;
  drawingState.currentBrushSize = normalizeBrushSizeSetting(size, getNormalizedFontSize());
  updateBrushSizeButtons();

  if (persist) {
    scheduleSettingsSave();
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

function focusEditorWithoutScroll(scrollTop = getViewportScrollTop()) {
  if (!editor) {
    return;
  }

  try {
    editor.focus({ preventScroll: true });
  } catch (error) {
    editor.focus();
  }

  restorePageScrollPosition(scrollTop);
}

function toggleDrawingTool(tool) {
  if (!workspaceWritable) return;
  const nextTool = tool === 'eraser' ? 'eraser' : 'brush';

  if (drawingState.enabled && drawingState.currentTool === nextTool) {
    setDrawMode(false);
    return;
  }

  setDrawingTool(nextTool);
  setDrawMode(true);
}

function setDrawMode(enabled) {
  if (!workspaceWritable && enabled) return;
  const viewportScrollTop = getViewportScrollTop();
  drawingState.enabled = Boolean(enabled);
  document.body.classList.toggle('drawing-mode', drawingState.enabled);
  if (drawingToolbar) {
    drawingToolbar.classList.toggle('active', drawingState.enabled);
  }
  updateDrawingToolButtons();

  if (drawingState.enabled) {
    drawingState.scrollTopBeforeMode = viewportScrollTop;
    syncCurrentPageScrollPosition();
    editor.blur();
  } else {
    focusEditorWithoutScroll(drawingState.scrollTopBeforeMode || viewportScrollTop);
    syncCurrentPageScrollPosition();
  }
}

function scheduleDrawingLayerSync({ forceRedraw = false } = {}) {
  drawingState.pendingFullRedraw = drawingState.pendingFullRedraw || forceRedraw;

  if (drawingState.syncFrame) {
    cancelAnimationFrame(drawingState.syncFrame);
  }

  drawingState.syncFrame = requestAnimationFrame(() => {
    const pendingFullRedraw = drawingState.pendingFullRedraw;
    drawingState.syncFrame = null;
    drawingState.pendingFullRedraw = false;
    syncDrawingLayerSize({ forceRedraw: pendingFullRedraw });
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

// Shared canvas paint path. Treats a single-point stroke as a tiny dot so it
// still renders. `tailPoints` is the array of vertices to lineTo *after* the
// starting point — keeps `drawStroke` and `drawStrokeRange` on one code path.
function paintPath(stroke, startPoint, tailPoints, fontSize) {
  if (!drawingContext || !startPoint) return;

  const isEraserStroke = stroke.tool === 'eraser';

  drawingContext.save();
  drawingContext.globalCompositeOperation = isEraserStroke ? 'destination-out' : 'source-over';
  drawingContext.strokeStyle = isEraserStroke ? '#000000' : (stroke.color || getCurrentBrushColor());
  drawingContext.lineWidth = getBrushSizeInPixels(stroke.width, fontSize);
  drawingContext.lineCap = 'round';
  drawingContext.lineJoin = 'round';
  drawingContext.beginPath();
  drawingContext.moveTo(startPoint.x, startPoint.y);

  if (!tailPoints || tailPoints.length === 0) {
    // Single-point stroke — nudge a hair so a dot renders.
    drawingContext.lineTo(startPoint.x + 0.01, startPoint.y + 0.01);
  } else {
    tailPoints.forEach(point => drawingContext.lineTo(point.x, point.y));
  }

  drawingContext.stroke();
  drawingContext.restore();
}

function drawStroke(stroke) {
  if (!drawingContext || !stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) {
    return;
  }

  const fontSize = getNormalizedFontSize();
  const referenceFontSize = getStrokeReferenceFontSize(stroke, fontSize);
  const renderedPoints = stroke.points.map(point => convertPointToCanvasPixels(point, referenceFontSize, fontSize));
  const [firstPoint, ...tail] = renderedPoints;
  paintPath(stroke, firstPoint, tail, fontSize);
}

function redrawDrawings() {
  clearDrawingSurface();

  const page = getCurrentPage();
  if (!page || !Array.isArray(page.drawings) || page.drawings.length === 0) {
    return;
  }

  page.drawings.forEach(stroke => drawStroke(stroke));
}

function syncDrawingLayerSize({ forceRedraw = false } = {}) {
  if (!drawingLayer || !drawingContext || !board) return;

  const { width, height } = getBoardSize();
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.round(width * dpr));
  const targetHeight = Math.max(1, Math.round(height * dpr));
  let resized = false;

  if (drawingLayer.width !== targetWidth || drawingLayer.height !== targetHeight) {
    drawingLayer.width = targetWidth;
    drawingLayer.height = targetHeight;
    drawingLayer.style.width = `${width}px`;
    drawingLayer.style.height = `${height}px`;
    drawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    resized = true;
  }

  if (resized || forceRedraw) {
    redrawDrawings();
  }
}

function getRelativePoint(event, rect = drawingState.activeBoardRect) {
  if (!board) {
    return { x: 0, y: 0 };
  }

  const boardRect = rect || board.getBoundingClientRect();
  const width = Math.max(boardRect.width, 1);
  const height = Math.max(boardRect.height, 1);
  const x = Math.min(Math.max(event.clientX - boardRect.left, 0), width);
  const y = Math.min(Math.max(event.clientY - boardRect.top, 0), height);

  return { x, y };
}

function drawStrokeRange(stroke, startIndex = 0) {
  if (!drawingContext || !stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) {
    return;
  }

  const clampedStartIndex = Math.max(0, Math.min(Number(startIndex) || 0, stroke.points.length - 1));
  const pathStartIndex = clampedStartIndex > 0 ? clampedStartIndex - 1 : 0;
  const fontSize = getNormalizedFontSize();
  const referenceFontSize = getStrokeReferenceFontSize(stroke, fontSize);
  const startPoint = convertPointToCanvasPixels(stroke.points[pathStartIndex], referenceFontSize, fontSize);
  const tailPoints = stroke.points
    .slice(clampedStartIndex > 0 ? clampedStartIndex : 1)
    .map(point => convertPointToCanvasPixels(point, referenceFontSize, fontSize));
  const isSinglePointStroke = stroke.points.length === 1 && clampedStartIndex === 0;

  paintPath(stroke, startPoint, isSinglePointStroke ? [] : tailPoints, fontSize);
}

function flushPendingStrokeRender() {
  const stroke = drawingState.currentStroke;
  if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) {
    return;
  }

  const startIndex = drawingState.lastRenderedPointIndex < 0
    ? 0
    : drawingState.lastRenderedPointIndex + 1;

  if (startIndex >= stroke.points.length) {
    return;
  }

  drawStrokeRange(stroke, startIndex);
  drawingState.lastRenderedPointIndex = stroke.points.length - 1;
}

function schedulePendingStrokeRender() {
  if (drawingState.strokeFrame) {
    return;
  }

  drawingState.strokeFrame = requestAnimationFrame(() => {
    drawingState.strokeFrame = null;
    flushPendingStrokeRender();
  });
}

function resetCurrentStrokeState() {
  drawingState.isDrawing = false;
  drawingState.currentStroke = null;
  drawingState.activeBoardRect = null;
  drawingState.lastRenderedPointIndex = -1;
  drawingState.activePointerId = null;

  if (drawingState.strokeFrame) {
    cancelAnimationFrame(drawingState.strokeFrame);
    drawingState.strokeFrame = null;
  }
}

function beginStroke(event) {
  if (!workspaceWritable) return;
  if (!drawingState.enabled || event.button !== 0) return;

  const page = getCurrentPage();
  if (!page) return;

  event.preventDefault();
  drawingState.activeBoardRect = board?.getBoundingClientRect() || null;
  const referenceFontSize = getNormalizedFontSize();
  const initialPoint = normalizeStoredPoint(getRelativePoint(event, drawingState.activeBoardRect));

  const stroke = {
    id: generateId(),
    tool: drawingState.currentTool,
    color: drawingState.currentTool === 'eraser' ? null : getCurrentBrushColor(),
    width: clampBrushSize(drawingState.currentBrushSize),
    points: [initialPoint],
    coordinateSpace: DRAWING_COORDINATE_SPACE,
    referenceFontSize
  };

  page.drawings.push(stroke);
  drawingState.isDrawing = true;
  drawingState.currentStroke = stroke;
  drawingState.lastRenderedPointIndex = -1;
  drawingState.activePointerId = event.pointerId;

  if (drawingLayer.setPointerCapture) {
    drawingLayer.setPointerCapture(event.pointerId);
  }

  schedulePendingStrokeRender();
}

function extendStroke(event) {
  if (!drawingState.enabled || !drawingState.isDrawing || !drawingState.currentStroke) return;
  if (drawingState.activePointerId !== null && event.pointerId !== drawingState.activePointerId) return;

  event.preventDefault();
  const point = normalizeStoredPoint(getRelativePoint(event, drawingState.activeBoardRect));
  const points = drawingState.currentStroke.points;
  const lastPoint = points[points.length - 1];

  // Skip points closer than ~1.5px to the previous one — high-refresh pointers
  // fire 120+ events/sec and the extra vertices are invisible but balloon the
  // stored stroke data.
  if (lastPoint) {
    const dx = point.x - lastPoint.x;
    const dy = point.y - lastPoint.y;
    if ((dx * dx) + (dy * dy) < MIN_STROKE_POINT_DISTANCE_SQ) {
      return;
    }
  }

  points.push(point);
  schedulePendingStrokeRender();
}

function finishStroke(event) {
  if (!drawingState.isDrawing || !drawingState.currentStroke) return;
  if (event && drawingState.activePointerId !== null && event.pointerId !== drawingState.activePointerId) return;

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

  if (drawingState.strokeFrame) {
    cancelAnimationFrame(drawingState.strokeFrame);
    drawingState.strokeFrame = null;
  }

  flushPendingStrokeRender();

  if (drawingState.currentStroke.points.length === 1) {
    drawingState.currentStroke.points.push({ ...drawingState.currentStroke.points[0] });
  }

  resetCurrentStrokeState();
  saveContent();
}

function undoLastStroke() {
  if (!workspaceWritable) return false;
  const page = getCurrentPage();
  if (!page || !Array.isArray(page.drawings)) {
    return false;
  }

  if (drawingState.currentStroke && cancelActiveStroke()) {
    saveContent();
    return true;
  }

  if (page.drawings.length === 0) {
    return false;
  }

  page.drawings.pop();
  redrawDrawings();
  saveContent();
  return true;
}

async function clearCurrentPageDrawings() {
  if (!workspaceWritable) return;
  const page = getCurrentPage();
  if (!page || !Array.isArray(page.drawings) || page.drawings.length === 0) {
    closeClearDrawingsConfirm();
    return;
  }

  await captureDestructiveSnapshot('Before clearing page drawings');
  page.drawings = [];
  redrawDrawings();
  await safeLocalSet({ pages, currentPageId }, 'clearing page drawings');
  closeClearDrawingsConfirm({ restoreFocus: true });
}

// Confirm popover for the "clear drawings" toolbar button — mirrors the page
// delete confirmation pattern so both destructive actions feel consistent.
function positionClearDrawingsConfirm() {
  if (!clearDrawingsConfirm || clearDrawingsConfirm.hidden || !clearDrawingsBtn) {
    return;
  }

  const triggerRect = clearDrawingsBtn.getBoundingClientRect();
  const popoverWidth = Math.min(clearDrawingsConfirm.offsetWidth || 244, window.innerWidth - 24);
  const popoverHeight = Math.min(clearDrawingsConfirm.offsetHeight || 120, window.innerHeight - 24);
  const viewportPadding = 12;
  const gutter = 10;

  let left = triggerRect.right - popoverWidth;
  left = Math.min(Math.max(viewportPadding, left), window.innerWidth - popoverWidth - viewportPadding);

  let top = triggerRect.bottom + gutter;
  if (top + popoverHeight > window.innerHeight - viewportPadding) {
    top = Math.max(viewportPadding, triggerRect.top - popoverHeight - gutter);
  }

  clearDrawingsConfirm.style.left = `${left}px`;
  clearDrawingsConfirm.style.top = `${top}px`;
}

function openClearDrawingsConfirm() {
  const page = getCurrentPage();
  if (!clearDrawingsConfirm || !page || !Array.isArray(page.drawings) || page.drawings.length === 0) {
    return;
  }

  closeDrawSizePopover();
  closeColorPicker();
  uiState.clearDrawingsConfirmOpen = true;
  clearDrawingsConfirm.hidden = false;
  clearDrawingsConfirm.classList.add('visible');
  clearDrawingsBtn?.setAttribute('aria-expanded', 'true');
  positionClearDrawingsConfirm();
}

function closeClearDrawingsConfirm({ restoreFocus = false } = {}) {
  uiState.clearDrawingsConfirmOpen = false;

  if (clearDrawingsConfirm) {
    clearDrawingsConfirm.classList.remove('visible');
    clearDrawingsConfirm.hidden = true;
    clearDrawingsConfirm.style.left = '';
    clearDrawingsConfirm.style.top = '';
  }

  if (clearDrawingsBtn) {
    clearDrawingsBtn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      clearDrawingsBtn.focus();
    }
  }
}

function positionDrawSizePopover() {
  if (!drawSizePopover || drawSizePopover.hidden || !drawSizeToggleBtn) {
    return;
  }

  const triggerRect = drawSizeToggleBtn.getBoundingClientRect();
  const popoverWidth = Math.min(drawSizePopover.offsetWidth || 248, window.innerWidth - 24);
  const popoverHeight = Math.min(drawSizePopover.offsetHeight || 180, window.innerHeight - 24);
  const viewportPadding = 12;
  const gutter = 12;

  let left = triggerRect.left + (triggerRect.width - popoverWidth) / 2;
  left = Math.min(Math.max(viewportPadding, left), window.innerWidth - popoverWidth - viewportPadding);

  let top = triggerRect.bottom + gutter;
  if (top + popoverHeight > window.innerHeight - viewportPadding) {
    top = Math.max(viewportPadding, triggerRect.top - popoverHeight - gutter);
  }

  drawSizePopover.style.left = `${left}px`;
  drawSizePopover.style.top = `${top}px`;
}

function closeDrawSizePopover({ restoreFocus = false } = {}) {
  uiState.drawSizePopoverOpen = false;

  if (drawSizePopover) {
    drawSizePopover.classList.remove('visible');
    drawSizePopover.hidden = true;
  }

  if (drawSizeToggleBtn) {
    drawSizeToggleBtn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      drawSizeToggleBtn.focus();
    }
  }
}

function openDrawSizePopover() {
  if (!drawSizePopover || !drawSizeToggleBtn) {
    return;
  }

  closeDeletePageConfirm();
  closeColorPicker();
  uiState.drawSizePopoverOpen = true;
  drawSizePopover.hidden = false;
  drawSizePopover.classList.add('visible');
  drawSizeToggleBtn.setAttribute('aria-expanded', 'true');
  positionDrawSizePopover();
}

function toggleDrawSizePopover() {
  if (uiState.drawSizePopoverOpen) {
    closeDrawSizePopover({ restoreFocus: false });
    return;
  }

  openDrawSizePopover();
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
    deletePageConfirm.style.left = '';
    deletePageConfirm.style.top = '';
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

  closeDrawSizePopover();
  uiState.deleteConfirmOpen = true;
  deletePageConfirm.hidden = false;
  deletePageConfirm.classList.add('visible');
  emojiPickerDelete.setAttribute('aria-expanded', 'true');
  positionDeletePageConfirm();
}

function positionDeletePageConfirm() {
  if (!deletePageConfirm || deletePageConfirm.hidden || !emojiPickerDelete) {
    return;
  }

  const pickerRect = emojiPicker?.getBoundingClientRect();
  const triggerRect = emojiPickerDelete.getBoundingClientRect();
  const popoverWidth = Math.min(deletePageConfirm.offsetWidth || 244, window.innerWidth - 24);
  const popoverHeight = Math.min(deletePageConfirm.offsetHeight || 120, window.innerHeight - 24);
  const viewportPadding = 12;
  const menuPadding = 10;
  const gutter = 8;
  const horizontalAnchor = triggerRect.right - (popoverWidth / 2);

  let left = horizontalAnchor;

  if (pickerRect) {
    const minLeft = Math.max(viewportPadding, pickerRect.left + menuPadding);
    const maxLeft = Math.min(window.innerWidth - popoverWidth - viewportPadding, pickerRect.right - popoverWidth - menuPadding);
    left = Math.min(Math.max(minLeft, left), Math.max(minLeft, maxLeft));
  } else {
    left = Math.min(Math.max(viewportPadding, left), window.innerWidth - popoverWidth - viewportPadding);
  }

  let top = triggerRect.bottom + gutter;
  if (pickerRect) {
    const maxTop = pickerRect.bottom - popoverHeight - menuPadding;
    top = Math.min(top, maxTop);
  }
  top = Math.min(Math.max(viewportPadding, top), window.innerHeight - popoverHeight - viewportPadding);

  deletePageConfirm.style.left = `${left}px`;
  deletePageConfirm.style.top = `${top}px`;
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
  let placement = 'left';
  if (left < viewportPadding) {
    left = anchorRect.right + gutter;
    placement = 'right';
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
  emojiPicker.dataset.placement = placement;

  if (uiState.deleteConfirmOpen) {
    positionDeletePageConfirm();
  }
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

  if (target.closest('textarea, select, input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="password"], input[type="number"]')) {
    return true;
  }

  return target === editor || target.closest('#editor') || target.isContentEditable;
}

function getControlRangeBounds(control) {
  const min = Number(control?.min);
  const max = Number(control?.max);

  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 100
  };
}

function adjustFontSizeByStep(stepDelta) {
  if (!workspaceWritable) return false;
  if (!controls.fontSize) {
    return false;
  }

  const currentValue = Number(controls.fontSize.value);
  const { min, max } = getControlRangeBounds(controls.fontSize);
  const nextValue = Math.min(max, Math.max(min, currentValue + stepDelta));

  if (!Number.isFinite(nextValue) || nextValue === currentValue) {
    return false;
  }

  controls.fontSize.value = String(nextValue);
  handleSettingChange();
  return true;
}

function shouldHandleFontResizeWheel(event) {
  if (!event.shiftKey || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  const target = getShortcutTarget(event);
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  if (target.closest('input, textarea, select, .color-picker-popup, .emoji-picker, .delete-confirm-popover, .drawing-size-popover')) {
    return false;
  }

  return Boolean(target.closest('#board, .top-right-rail, .page-tabs') || target === document.body);
}

function shouldHandleDrawingUndoShortcut(event) {
  const target = getShortcutTarget(event);

  if (!(target instanceof HTMLElement)) {
    return true;
  }

  if (target.closest('textarea, select, input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="password"], input[type="number"]')) {
    return false;
  }

  return !target.closest('.controls-container, .color-picker-popup, .emoji-picker, .delete-confirm-popover, .drawing-size-popover');
}

function removeStrokeById(drawings, strokeId) {
  if (!Array.isArray(drawings) || !strokeId) {
    return false;
  }

  const strokeIndex = drawings.findIndex(stroke => stroke?.id === strokeId);
  if (strokeIndex < 0) {
    return false;
  }

  drawings.splice(strokeIndex, 1);
  return true;
}

function cancelActiveStroke() {
  const page = getCurrentPage();
  const activeStrokeId = drawingState.currentStroke?.id;

  if (!page || !activeStrokeId) {
    return false;
  }

  if (drawingLayer?.releasePointerCapture && drawingState.activePointerId !== null) {
    try {
      drawingLayer.releasePointerCapture(drawingState.activePointerId);
    } catch (error) {
      // Ignore release errors when pointer capture is already cleared.
    }
  }

  const removedStroke = removeStrokeById(page.drawings, activeStrokeId);
  resetCurrentStrokeState();
  redrawDrawings();
  return removedStroke;
}

function isUndoShortcut(event) {
  // Skip IME composition — Ctrl/Cmd+Z while a CJK IME is composing belongs
  // to the IME (cancel composition), not to our undo handler.
  if (event.isComposing || event.keyCode === 229) {
    return false;
  }
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'z';
}

function isRedoShortcut(event) {
  if (event.isComposing || event.keyCode === 229) {
    return false;
  }
  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return false;
  }
  const key = event.key.toLowerCase();
  return (event.shiftKey && key === 'z') || (!event.shiftKey && key === 'y');
}

// Text undo/redo applies when the shortcut lands on the editor itself (or the
// body, where it would otherwise do nothing) — not on inputs, which keep
// their native undo.
function isEditorHistoryTarget(event) {
  const target = getShortcutTarget(event);
  if (!target) {
    return false;
  }
  return target === editor || Boolean(target.closest('#editor')) || target === document.body;
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

// Every local write goes through IndexedDB. The editor keeps page objects in
// memory for fast drawing, but each record is persisted independently and all
// multi-page operations are serialized by the store.
async function safeLocalSet(payload, context = 'saving') {
  if (!workspaceWritable) {
    return false;
  }

  try {
    if (Array.isArray(payload.pages)) {
      await workspaceStore.saveWorkspace({
        pages: payload.pages.map((page, position) => ({ ...page, position })),
        currentPageId: payload.currentPageId || currentPageId,
        settings: normalizeSettings(getCurrentSettings(), DEFAULT_SETTINGS)
      });
    } else if (typeof payload.currentPageId === 'string') {
      await workspaceStore.saveCurrentPageId(payload.currentPageId);
    }

    workspaceChannel.post('workspace-saved', { context });
    return true;
  } catch (error) {
    handleStorageError(error, context);
    return false;
  }
}

const persistPagesState = debounce(() => {
  safeLocalSet({ pages, currentPageId }, 'saving pages');
}, 200);

async function persistPagesStateImmediately() {
  await safeLocalSet({ pages, currentPageId }, 'saving pages');
}

// Apply settings to CSS custom properties
function applySettings(settings) {
  const root = document.documentElement;
  const selectionColor = normalizeHex(settings.selectionColor || settings.textColor || DEFAULT_SETTINGS.selectionColor);
  root.style.setProperty('--font-family', settings.fontFamily);
  root.style.setProperty('--font-size', settings.fontSize + 'px');
  root.style.setProperty('--line-height', settings.lineHeight);
  root.style.setProperty('--letter-spacing', settings.letterSpacing + 'em');
  root.style.setProperty('--max-width', settings.maxWidth + 'px');
  root.style.setProperty('--text-color', settings.textColor);
  root.style.setProperty('--bg-color', settings.backgroundColor);
  root.style.setProperty('--selection-color', selectionColor);
  root.style.setProperty('--selection-text-color', getContrastingTextColor(selectionColor));
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
  const selectionColor = normalizeHex(settings.selectionColor || settings.textColor || DEFAULT_SETTINGS.selectionColor);
  const normalizedDrawSize = normalizeBrushSizeSetting(settings.drawSize, settings.fontSize);

  controls.fontFamily.value = settings.fontFamily;
  controls.fontSize.value = settings.fontSize;
  controls.lineHeight.value = settings.lineHeight;
  controls.letterSpacing.value = settings.letterSpacing;
  controls.maxWidth.value = settings.maxWidth;
  controls.drawColor.value = settings.drawColor || settings.textColor || DEFAULT_SETTINGS.drawColor;
  controls.textColor.value = settings.textColor;
  controls.backgroundColor.value = settings.backgroundColor;
  controls.selectionColor.value = selectionColor;
  drawingState.currentBrushSize = normalizedDrawSize;
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
  if (!currentPageId || !workspaceWritable) return;
  
  try {
    syncCurrentPageScrollPosition();

    const content = sanitizeStoredContent(editor.innerHTML);
    const pageIndex = pages.findIndex(p => p.id === currentPageId);
    if (pageIndex === -1) {
      console.warn('Current page not found in pages array');
      return;
    }
    pages[pageIndex].content = content;
    pages[pageIndex].drawings = Array.isArray(pages[pageIndex].drawings) ? pages[pageIndex].drawings : [];
    await workspaceStore.savePage({ ...pages[pageIndex], position: pageIndex }, currentPageId);
    workspaceChannel.post('page-saved', { pageId: currentPageId });
    showSaveIndicator();
    updateWordCount();
  } catch (error) {
    console.error('Error saving content:', error);
  }
}

// Surface storage quota / write failures so the user notices when their notes
// stop being saved instead of silently losing edits.
function handleStorageError(error, context = 'saving') {
  console.error(`Error ${context}:`, error);
  if (!saveIndicator) return;

  saveIndicator.classList.add('error', 'visible');
  saveIndicator.title = error?.message
    ? `Save failed: ${error.message}`
    : 'Save failed. Storage quota may be full.';
  saveIndicator.setAttribute('aria-label', saveIndicator.title);
  statusAnnouncer.show(saveIndicator.title, { kind: 'error', duration: 8_000 });

  // Auto-clear the error after a few seconds so the next successful save can
  // overwrite it with the normal indicator state.
  setTimeout(() => {
    if (saveIndicator.classList.contains('error')) {
      saveIndicator.classList.remove('error', 'visible');
      saveIndicator.title = '';
      saveIndicator.removeAttribute('aria-label');
    }
  }, 4000);
}

// Debounced save
const debouncedSave = debounce(saveContent, 1000);

// Show save indicator briefly
function showSaveIndicator() {
  // A successful save clears any lingering error state.
  saveIndicator.classList.remove('error');
  saveIndicator.title = '';
  saveIndicator.setAttribute('aria-label', 'Saved locally.');
  saveIndicator.classList.add('visible');
  setTimeout(() => {
    saveIndicator.classList.remove('visible');
    saveIndicator.removeAttribute('aria-label');
  }, 1500);
}

// Save settings
async function saveSettings(settings) {
  settingsSaveDirty = false;
  if (!workspaceWritable) return;
  try {
    await workspaceStore.saveSettings(normalizeSettings(settings, DEFAULT_SETTINGS));
    workspaceChannel.post('settings-saved');
  } catch (error) {
    handleStorageError(error, 'saving settings');
  }
}

// Slider drags fire `input` continuously. Debounce the IndexedDB writes so
// changing a visual setting stays responsive; the dirty flag lets pagehide
// flush anything still pending.
let settingsSaveDirty = false;

const debouncedSaveSettings = debounce(() => {
  saveSettings(getCurrentSettings());
}, 400);

function scheduleSettingsSave() {
  settingsSaveDirty = true;
  debouncedSaveSettings();
}

function flushPendingSettingsSave() {
  if (settingsSaveDirty) {
    saveSettings(getCurrentSettings());
  }
}

// Mark theme as explicit so the prefers-color-scheme dark-mode override stops
// applying. Called only when the user actively picks a theme or color — not
// on every font/size tweak (which previously locked dark mode out forever).
function markThemeExplicit() {
  document.documentElement.setAttribute('data-theme-set', 'true');
}

// Load saved data
async function loadSavedData() {
  try {
    let storedWorkspace = await workspaceStore.readWorkspace();
    let importedLegacyWorkspace = false;

    // A manually reloaded legacy unpacked extension has access to its old
    // chrome.storage records. Copy them into IndexedDB, but never delete the
    // source data: the user can still export it again if needed.
    if (storedWorkspace.pages.length === 0 && isExtensionContext()) {
      const legacyWorkspace = await readLegacyChromeWorkspace({
        defaults: DEFAULT_SETTINGS,
        sanitizeHtml: sanitizeStoredContent
      });
      if (legacyWorkspace?.pages.length) {
        storedWorkspace = legacyWorkspace;
        importedLegacyWorkspace = true;
        if (workspaceWritable) {
          await workspaceStore.saveWorkspace(storedWorkspace);
        }
      }
    }

    const settings = normalizeSettings(storedWorkspace.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS);
    settings.drawSize = normalizeBrushSizeSetting(settings.drawSize, settings.fontSize);
    settings.selectionColor = normalizeHex(settings.selectionColor || settings.textColor || DEFAULT_SETTINGS.selectionColor);
    const pagesNeedMigration = Array.isArray(storedWorkspace.pages) && storedWorkspace.pages.some(page =>
      Array.isArray(page?.drawings) && page.drawings.some(stroke =>
        stroke?.coordinateSpace !== DRAWING_COORDINATE_SPACE || !Number.isFinite(Number(stroke?.referenceFontSize))
      )
    );
    const settingsNeedMigration = storedWorkspace.settings?.drawSize !== settings.drawSize ||
      storedWorkspace.settings?.fontFamily !== migrateFontFamily(storedWorkspace.settings?.fontFamily);

    if (storedWorkspace.pages.length > 0) {
      pages = storedWorkspace.pages.map(page => normalizePage(page, settings.fontSize));
      currentPageId = storedWorkspace.currentPageId || pages[0].id;
    } else {
      pages = [normalizePage({
        id: generateId(),
        emoji: DEFAULT_PAGE_EMOJI,
        content: ''
      }, settings.fontSize)];
      currentPageId = pages[0].id;
    }

    if (!pages.some(page => page.id === currentPageId)) currentPageId = pages[0].id;

    // Set current theme
    currentTheme = settings.currentTheme || 'lavender';
    
    applySettings(settings);
    updateControlValues(settings);
    
    // Initialize theme grid
    initThemeGrid();
    updateThemeGridSelection();

    renderPageTabs();
    loadPageContent(currentPageId);

    if (workspaceWritable && (pagesNeedMigration || settingsNeedMigration || storedWorkspace.pages.length === 0 || importedLegacyWorkspace)) {
      await workspaceStore.saveWorkspace(getWorkspaceForPersistence());
    }

    if (importedLegacyWorkspace) {
      statusAnnouncer.show('Copied your legacy extension notes to local storage. The original Chrome storage was left untouched.', {
        kind: 'success',
        duration: 9_000
      });
    }

    void updateStorageSummary();
    void updateRecoverySummary();
  } catch (error) {
    console.error('Error loading saved data:', error);
    handleStorageError(error, 'loading local data');
    applySettings(DEFAULT_SETTINGS);
    updateControlValues(DEFAULT_SETTINGS);
    initThemeGrid();
  }
}

function getWorkspaceForPersistence({ captureEditor = false } = {}) {
  if (captureEditor) {
    syncCurrentPageScrollPosition();
    const page = getCurrentPage();
    if (page) page.content = sanitizeStoredContent(editor.innerHTML);
  }

  return {
    pages: pages.map((page, position) => ({ ...page, position })),
    currentPageId,
    settings: normalizeSettings(getCurrentSettings(), DEFAULT_SETTINGS)
  };
}

function formatStorageSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

async function updateStorageSummary() {
  if (!storageSummary) return;
  let message = 'Stored only in this browser on this device.';

  try {
    if (navigator.storage?.persisted && navigator.storage?.persist) {
      const alreadyPersistent = await navigator.storage.persisted();
      if (!alreadyPersistent) await navigator.storage.persist();
    }
    const estimate = await navigator.storage?.estimate?.();
    const used = formatStorageSize(estimate?.usage);
    if (used) message = `Stored only in this browser on this device · ${used} currently used.`;
  } catch (error) {
    // Storage persistence is best effort; the downloadable backup remains the
    // durable way for the user to retain control over a browser profile reset.
  }

  storageSummary.textContent = message;
}

async function updateRecoverySummary() {
  if (!recoverySummary || !restoreSnapshotBtn) return;

  try {
    const [latestSnapshot] = await workspaceStore.listSnapshots();
    restoreSnapshotBtn.disabled = !workspaceWritable || !latestSnapshot;
    if (!latestSnapshot) {
      recoverySummary.textContent = 'Recovery snapshots appear here after an import or destructive change.';
      return;
    }

    const label = latestSnapshot.label || 'Recovery snapshot';
    const time = new Date(latestSnapshot.createdAt).toLocaleString('en-US');
    recoverySummary.textContent = `Latest snapshot: ${label} · ${time}.`;
  } catch (error) {
    recoverySummary.textContent = 'Recovery snapshots are unavailable until local storage is ready.';
    restoreSnapshotBtn.disabled = true;
  }
}

function applyWorkspaceToEditor(workspace) {
  const settings = normalizeSettings(workspace.settings, DEFAULT_SETTINGS);
  pages = workspace.pages.map(page => normalizePage(page, settings.fontSize));
  currentPageId = workspace.currentPageId || pages[0]?.id || null;
  if (!pages.some(page => page.id === currentPageId)) currentPageId = pages[0]?.id || null;
  currentTheme = settings.currentTheme || 'lavender';

  applySettings(settings);
  updateControlValues(settings);
  initThemeGrid();
  updateThemeGridSelection();
  renderPageTabs();
  if (currentPageId) loadPageContent(currentPageId);
}

function setWorkspaceReadOnlyMode(reason = 'Another Blackboard Text tab is editing this workspace.') {
  workspaceWritable = false;
  document.body.classList.add('workspace-readonly');
  editor.contentEditable = 'false';
  editor.setAttribute('aria-readonly', 'true');

  const allowed = new Set([exportWorkspaceBtn, reloadForUpdateBtn]);
  document.querySelectorAll('button, input, select').forEach(control => {
    if (allowed.has(control)) return;
    if (!control.disabled) control.dataset.workspaceLocked = 'true';
    control.disabled = true;
  });

  if (workspaceModeNotice) {
    workspaceModeNotice.textContent = `${reason} This tab is read-only. Close the writing tab, then return here to continue.`;
    workspaceModeNotice.hidden = false;
  }
}

function setWorkspaceWritableMode() {
  workspaceWritable = true;
  document.body.classList.remove('workspace-readonly');
  editor.contentEditable = 'true';
  editor.removeAttribute('aria-readonly');
  document.querySelectorAll('[data-workspace-locked="true"]').forEach(control => {
    control.disabled = false;
    delete control.dataset.workspaceLocked;
  });
  if (workspaceModeNotice) workspaceModeNotice.hidden = true;
}

async function tryPromoteReadOnlyTab() {
  if (workspaceWritable) return;
  const nextLock = await acquireWorkspaceLock();
  if (!nextLock.acquired) return;

  workspaceLock = nextLock;
  setWorkspaceWritableMode();
  await loadSavedData();
  statusAnnouncer.show('This tab now owns the writing lock.', { kind: 'success' });
}

async function captureDestructiveSnapshot(label) {
  if (!workspaceWritable) return null;
  const snapshot = await workspaceStore.createSnapshot(label, getWorkspaceForPersistence({ captureEditor: true }));
  workspaceChannel.post('snapshot-created', { label });
  void updateRecoverySummary();
  return snapshot;
}

// Generate unique ID
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Strip anything an attacker could use to execute script if the stored
// content was ever tampered with by an external party (another extension
// writing to local storage, a buggy migration, an imported file, etc).
// Paste-into-editor is already sanitized to plain text, but we don't want
// `editor.innerHTML = page.content` to be a code-execution sink.
const UNSAFE_TAGS = new Set([
  'SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'STYLE',
  'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION'
]);
const UNSAFE_URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

function sanitizeStoredContent(html) {
  if (typeof html !== 'string' || html.length === 0) {
    return '';
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const doomed = [];
  let node = walker.nextNode();

  while (node) {
    if (UNSAFE_TAGS.has(node.tagName)) {
      doomed.push(node);
    } else {
      // Drop inline event handlers (onclick, onerror, …) and javascript: URLs.
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) {
          node.removeAttribute(attr.name);
          continue;
        }
        if (UNSAFE_URL_ATTRS.has(name)) {
          const value = attr.value.trim().toLowerCase();
          if (value.startsWith('javascript:') || value.startsWith('data:text/html')) {
            node.removeAttribute(attr.name);
          }
        }
      }
    }
    node = walker.nextNode();
  }

  doomed.forEach(el => el.remove());
  return template.innerHTML;
}

// --- Per-page text history -------------------------------------------------
// The browser's native contenteditable undo stack is destroyed every time we
// assign editor.innerHTML (page switches, restores), so text undo is handled
// here instead: per-page snapshot stacks, coalesced so one undo step roughly
// equals one burst of typing. Held in memory only — it intentionally doesn't
// survive a reload.
const TEXT_HISTORY_LIMIT = 100;
const TEXT_SNAPSHOT_DEBOUNCE_MS = 350;
const textHistories = new Map(); // pageId -> { states: [{ html, sel }], index }
let textSnapshotTimeout = null;

// Selection as plain character offsets over the editor's text content, so a
// snapshot can restore the caret after innerHTML is reassigned.
function getEditorSelectionOffsets() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const measure = (container, offset) => {
    const probe = document.createRange();
    probe.selectNodeContents(editor);
    try {
      probe.setEnd(container, offset);
    } catch (error) {
      return 0;
    }
    return probe.toString().length;
  };

  return {
    start: measure(range.startContainer, range.startOffset),
    end: measure(range.endContainer, range.endOffset)
  };
}

function resolveEditorTextOffset(offset) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, Number(offset) || 0);
  let lastNode = null;
  let node = walker.nextNode();

  while (node) {
    const length = node.textContent.length;
    if (remaining <= length) {
      return { node, offset: remaining };
    }
    remaining -= length;
    lastNode = node;
    node = walker.nextNode();
  }

  if (lastNode) {
    return { node: lastNode, offset: lastNode.textContent.length };
  }
  return { node: editor, offset: 0 };
}

function setEditorSelectionOffsets(start, end = start) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const startPos = resolveEditorTextOffset(start);
  const endPos = end === start ? startPos : resolveEditorTextOffset(end);
  const range = document.createRange();

  try {
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
  } catch (error) {
    return;
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

function ensureTextHistory(pageId, html) {
  if (!textHistories.has(pageId)) {
    textHistories.set(pageId, {
      states: [{ html: typeof html === 'string' ? html : '', sel: null }],
      index: 0
    });
  }
  return textHistories.get(pageId);
}

function captureTextSnapshot() {
  if (textSnapshotTimeout) {
    clearTimeout(textSnapshotTimeout);
    textSnapshotTimeout = null;
  }

  if (!currentPageId) {
    return;
  }

  const history = ensureTextHistory(currentPageId, '');
  const html = editor.innerHTML;

  if (history.states[history.index]?.html === html) {
    return;
  }

  // A new edit after undo discards the redo branch.
  history.states.length = history.index + 1;
  history.states.push({ html, sel: getEditorSelectionOffsets() });

  if (history.states.length > TEXT_HISTORY_LIMIT) {
    history.states.shift();
  }
  history.index = history.states.length - 1;
}

function scheduleTextSnapshot() {
  if (textSnapshotTimeout) {
    clearTimeout(textSnapshotTimeout);
  }
  textSnapshotTimeout = setTimeout(captureTextSnapshot, TEXT_SNAPSHOT_DEBOUNCE_MS);
}

// Capture a pending snapshot right now (page switch, undo) so it lands on the
// page it belongs to.
function flushPendingTextSnapshot() {
  if (textSnapshotTimeout) {
    captureTextSnapshot();
  }
}

// Drop a pending snapshot without capturing — used when the page it would
// describe is going away.
function cancelPendingTextSnapshot() {
  if (textSnapshotTimeout) {
    clearTimeout(textSnapshotTimeout);
    textSnapshotTimeout = null;
  }
}

function applyTextHistoryState(state) {
  editor.innerHTML = state.html;
  if (state.sel) {
    setEditorSelectionOffsets(state.sel.start, state.sel.end);
  } else {
    setEditorSelectionOffsets(editor.textContent.length);
  }
  debouncedSave();
  updateWordCount();
  scheduleDrawingLayerSync();
}

function undoTextEdit() {
  if (!currentPageId) {
    return false;
  }

  flushPendingTextSnapshot();
  const history = textHistories.get(currentPageId);
  if (!history || history.index <= 0) {
    return false;
  }

  history.index -= 1;
  applyTextHistoryState(history.states[history.index]);
  return true;
}

function redoTextEdit() {
  if (!currentPageId) {
    return false;
  }

  flushPendingTextSnapshot();
  const history = textHistories.get(currentPageId);
  if (!history || history.index >= history.states.length - 1) {
    return false;
  }

  history.index += 1;
  applyTextHistoryState(history.states[history.index]);
  return true;
}
// ---------------------------------------------------------------------------

// Load page content
function loadPageContent(pageId) {
  const page = pages.find(p => p.id === pageId);
  if (page) {
    // Callers that switch pages flush the outgoing page's pending snapshot
    // before getting here; anything still pending now would be misattributed.
    cancelPendingTextSnapshot();
    resetCurrentStrokeState();
    editor.innerHTML = sanitizeStoredContent(page.content);
    ensureTextHistory(pageId, editor.innerHTML);
    currentPageId = pageId;
    safeLocalSet({ currentPageId }, 'updating active page');
    renderPageTabs();
    updateWordCount();
    scheduleDrawingLayerSync({ forceRedraw: true });
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

    const labels = getPageTabLabels(page, index, isActive);
    tab.className = 'page-tab' + (isActive ? ' active' : '');
    tab.type = 'button';
    tab.title = labels.title;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
    tab.setAttribute('draggable', 'true');
    tab.setAttribute('aria-label', labels.ariaLabel);
    tab.disabled = !workspaceWritable;
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
      flushPendingTextSnapshot();
      syncCurrentPageScrollPosition();
      saveContent();
      loadPageContent(page.id);
    });
    
    pageTabsList.appendChild(tab);
  });

  updateWordCount();
  updatePageTabsScrollState();
  scrollActivePageTabIntoView();
}

function updatePageTabsScrollState() {
  if (!pageTabsList) return;
  const { scrollTop, scrollHeight, clientHeight } = pageTabsList;
  const overflows = scrollHeight > clientHeight + 1;
  pageTabsList.classList.toggle('is-at-top', !overflows || scrollTop <= 1);
  pageTabsList.classList.toggle('is-at-bottom', !overflows || scrollTop + clientHeight >= scrollHeight - 1);
}

function scrollActivePageTabIntoView() {
  if (!pageTabsList || !currentPageId) return;
  const activeTab = pageTabsList.querySelector(`.page-tab[data-page-id="${currentPageId}"]`);
  if (!activeTab) return;
  const tabTop = activeTab.offsetTop;
  const tabBottom = tabTop + activeTab.offsetHeight;
  const viewTop = pageTabsList.scrollTop;
  const viewBottom = viewTop + pageTabsList.clientHeight;
  if (tabTop < viewTop) {
    pageTabsList.scrollTop = Math.max(0, tabTop - 8);
  } else if (tabBottom > viewBottom) {
    pageTabsList.scrollTop = tabBottom - pageTabsList.clientHeight + 8;
  }
}

// Drag and drop state
let draggedPageId = null;

function clearPageTabDragState() {
  document.querySelectorAll('.page-tab').forEach(tab => {
    tab.classList.remove('dragging', 'drag-over');
  });
}

function setPageReorderingState(isReordering) {
  document.body.classList.toggle('page-reordering', Boolean(isReordering));
}

function handleDragStart(e) {
  const tab = e.currentTarget.closest('.page-tab');
  if (!tab) {
    return;
  }

  draggedPageId = tab.dataset.pageId;
  clearPageTabDragState();
  setPageReorderingState(true);
  tab.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const tab = e.target.closest('.page-tab');
  clearPageTabDragState();

  const draggedTab = draggedPageId
    ? pageTabsList?.querySelector(`.page-tab[data-page-id="${draggedPageId}"]`)
    : null;

  if (draggedTab) {
    draggedTab.classList.add('dragging');
  }

  if (tab && tab.dataset.pageId !== draggedPageId) {
    tab.classList.add('drag-over');
  }
}

function handleDrop(e) {
  if (!workspaceWritable) return;
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
  
  draggedPageId = null;
  clearPageTabDragState();
  setPageReorderingState(false);
  safeLocalSet({ pages, currentPageId }, 'saving pages');
  renderPageTabs();
}

function handleDragEnd() {
  draggedPageId = null;
  clearPageTabDragState();
  setPageReorderingState(false);
}

// Keyboard support for the page rail: arrows move focus between tabs (roving
// tabindex), Home/End jump, Alt+arrow reorders the focused tab's page, and
// Enter/Space activate natively since the tabs are buttons.
function getPageTabButtons() {
  return pageTabsList ? Array.from(pageTabsList.querySelectorAll('.page-tab')) : [];
}

function focusPageTabAt(index) {
  const tabs = getPageTabButtons();
  if (tabs.length === 0) {
    return;
  }

  const clamped = ((index % tabs.length) + tabs.length) % tabs.length;
  tabs.forEach((tab, i) => tab.setAttribute('tabindex', i === clamped ? '0' : '-1'));
  tabs[clamped].focus();
}

function movePageByOffset(pageId, delta) {
  if (!workspaceWritable) return;
  const fromIndex = pages.findIndex(p => p.id === pageId);
  if (fromIndex === -1) {
    return;
  }

  const toIndex = Math.min(pages.length - 1, Math.max(0, fromIndex + delta));
  if (toIndex === fromIndex) {
    return;
  }

  const [page] = pages.splice(fromIndex, 1);
  pages.splice(toIndex, 0, page);
  safeLocalSet({ pages, currentPageId }, 'saving pages');
  renderPageTabs();

  // Re-rendering resets the roving tabindex to the active page; keep focus on
  // the moved tab so repeated Alt+arrow presses keep working.
  const movedTab = getPageTabButton(pageId);
  if (movedTab) {
    getPageTabButtons().forEach(tab => tab.setAttribute('tabindex', tab === movedTab ? '0' : '-1'));
    movedTab.focus();
  }
}

if (pageTabsList) {
  pageTabsList.addEventListener('keydown', (e) => {
    const tab = e.target instanceof HTMLElement ? e.target.closest('.page-tab') : null;
    if (!tab) {
      return;
    }

    const tabs = getPageTabButtons();
    const index = tabs.indexOf(tab);
    if (index === -1) {
      return;
    }

    const isNext = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    const isPrev = e.key === 'ArrowUp' || e.key === 'ArrowLeft';

    if ((isNext || isPrev) && e.altKey) {
      e.preventDefault();
      movePageByOffset(tab.dataset.pageId, isNext ? 1 : -1);
      return;
    }

    if (isNext || isPrev) {
      e.preventDefault();
      focusPageTabAt(index + (isNext ? 1 : -1));
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      focusPageTabAt(0);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      focusPageTabAt(tabs.length - 1);
    }
  });
}

// Add new page
function addNewPage() {
  if (!workspaceWritable) return;
  // Get a random unused emoji, or any if all used
  const usedEmojis = pages.map(p => p.emoji);
  const unusedEmojis = PAGE_EMOJIS.filter(e => !usedEmojis.includes(e));
  const emoji = unusedEmojis.length > 0 
    ? unusedEmojis[Math.floor(Math.random() * unusedEmojis.length)]
    : PAGE_EMOJIS[Math.floor(Math.random() * PAGE_EMOJIS.length)];
  
  flushPendingTextSnapshot();
  syncCurrentPageScrollPosition();
  saveContent();

  const newPage = {
    id: generateId(),
    emoji: emoji,
    title: '',
    content: '',
    drawings: [],
    scrollTop: 0
  };

  pages.push(newPage);
  currentPageId = newPage.id;
  editor.innerHTML = '';
  ensureTextHistory(newPage.id, '');
  redrawDrawings();
  
  safeLocalSet({ pages, currentPageId }, 'saving pages');
  renderPageTabs();
  scheduleDrawingLayerSync({ forceRedraw: true });
  restorePageScrollPosition(0);
  try {
    editor.focus({ preventScroll: true });
  } catch (error) {
    editor.focus();
  }
}

// Delete page
async function deletePage(pageId) {
  if (!workspaceWritable || pages.length <= 1) return;

  const pageIndex = pages.findIndex(p => p.id === pageId);
  if (pageIndex === -1) return;

  await captureDestructiveSnapshot('Before deleting a page');
  pages.splice(pageIndex, 1);
  textHistories.delete(pageId);
  if (pageId === currentPageId) {
    // A pending snapshot would describe the deleted page's content.
    cancelPendingTextSnapshot();
  }

  if (currentPageId === pageId) {
    currentPageId = pages[Math.max(0, pageIndex - 1)].id;
    loadPageContent(currentPageId);
  }
  
  safeLocalSet({ pages, currentPageId }, 'saving pages');
  renderPageTabs();
}

// Open emoji picker
function openEmojiPicker(pageId) {
  editingPageId = pageId;
  closeDeletePageConfirm();

  if (pageTitleInput) {
    pageTitleInput.value = getPageById(pageId)?.title || '';
  }

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
  if (!workspaceWritable || !editingPageId) return;

  const page = getPageById(editingPageId);
  if (!page || !page.emoji) {
    return;
  }

  page.emoji = '';
  safeLocalSet({ pages, currentPageId }, 'saving pages');
  renderPageTabs();
  closeEmojiPicker({ restoreFocus: true });
}

// Select emoji for page
function selectEmoji(emoji) {
  if (!workspaceWritable || !editingPageId) return;
  
  const page = getPageById(editingPageId);
  if (page) {
    page.emoji = emoji;
    safeLocalSet({ pages, currentPageId }, 'saving pages');
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
    btn.disabled = !workspaceWritable;
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

  if (emojiPickerClose) {
    emojiPickerClose.addEventListener('click', event => {
      event.stopPropagation();
      closeEmojiPicker({ restoreFocus: true });
    });
  }

  // Page name input — applies live to the tab tooltip, persists debounced.
  if (pageTitleInput) {
    const persistPageTitle = debounce(() => {
      safeLocalSet({ pages, currentPageId }, 'saving pages');
    }, 400);

    pageTitleInput.addEventListener('input', () => {
      const page = getPageById(editingPageId);
      if (!page) {
        return;
      }

      page.title = pageTitleInput.value.slice(0, MAX_PAGE_TITLE_LENGTH);
      updatePageTabLabels(page.id);
      persistPageTitle();
    });

    pageTitleInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        closeEmojiPicker({ restoreFocus: true });
      }
    });
  }

  if (cancelDeletePageBtn) {
    cancelDeletePageBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      closeDeletePageConfirm({ restoreFocus: true });
    });
  }

  if (confirmDeletePageBtn) {
    confirmDeletePageBtn.addEventListener('click', async (event) => {
      event.stopPropagation();

      if (editingPageId && pages.length > 1) {
        await deletePage(editingPageId);
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
    drawSize: clampBrushSize(drawingState.currentBrushSize),
    drawColor: getCurrentBrushColor(),
    drawColorMode: drawingState.currentBrushColorMode,
    textColor: controls.textColor.value,
    backgroundColor: controls.backgroundColor.value,
    selectionColor: normalizeHex(controls.selectionColor.value || controls.textColor.value),
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
    swatch.setAttribute('aria-label', `Use ${theme.name} theme`);
    swatch.disabled = !workspaceWritable;
    
    const inner = document.createElement('div');
    inner.className = 'theme-swatch-inner';
    inner.style.backgroundColor = theme.backgroundColor;
    
    const preview = document.createElement('div');
    preview.className = 'theme-swatch-preview';

    const regularText = document.createElement('span');
    regularText.className = 'theme-swatch-text theme-swatch-text-regular';
    regularText.textContent = 'Aa';

    const themeHighlight = theme.selectionColor || theme.textColor;
    const highlightedText = document.createElement('span');
    highlightedText.className = 'theme-swatch-highlight';
    highlightedText.style.backgroundColor = themeHighlight;

    const highlightedTextLabel = document.createElement('span');
    highlightedTextLabel.className = 'theme-swatch-text theme-swatch-text-highlighted';
    regularText.style.color = theme.textColor;
    highlightedTextLabel.style.color = theme.backgroundColor;
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
  if (!workspaceWritable) return;
  if (!THEMES[themeKey]) return;
  
  currentTheme = themeKey;
  const theme = THEMES[themeKey];
  
  // Update color controls
  const themeSelection = theme.selectionColor || theme.textColor;
  controls.textColor.value = theme.textColor;
  controls.backgroundColor.value = theme.backgroundColor;
  controls.selectionColor.value = themeSelection;

  // Update hex inputs
  if (hexInputs.textColor) hexInputs.textColor.value = theme.textColor;
  if (hexInputs.backgroundColor) hexInputs.backgroundColor.value = theme.backgroundColor;
  if (hexInputs.selectionColor) hexInputs.selectionColor.value = themeSelection;

  if (drawingState.currentBrushColorMode !== 'custom') {
    setBrushColor(theme.textColor, { persist: false, mode: 'theme' });
  }

  markThemeExplicit();
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

// Sync a hex text field, but never one the user is actively typing in —
// rewriting a focused input jumps the caret to the end mid-keystroke.
function syncHexInputValue(colorKey, value) {
  const input = hexInputs[colorKey];
  if (!input || document.activeElement === input) {
    return;
  }
  input.value = value;
}

// Handle manual color changes (marks theme as custom)
function handleColorChange() {
  if (!workspaceWritable) return;
  // Check if current colors match any theme
  const textColor = controls.textColor.value.toUpperCase();
  const bgColor = controls.backgroundColor.value.toUpperCase();
  const selColor = normalizeHex(controls.selectionColor.value || controls.textColor.value).toUpperCase();

  // Sync hex inputs
  syncHexInputValue('textColor', textColor);
  syncHexInputValue('backgroundColor', bgColor);
  syncHexInputValue('selectionColor', selColor);

  let matchedTheme = null;
  for (const [key, theme] of Object.entries(THEMES)) {
    const themeSel = (theme.selectionColor || theme.textColor).toUpperCase();
    if (theme.textColor.toUpperCase() === textColor &&
        theme.backgroundColor.toUpperCase() === bgColor &&
        themeSel === selColor) {
      matchedTheme = key;
      break;
    }
  }
  
  currentTheme = matchedTheme || 'custom';
  if (drawingState.currentBrushColorMode !== 'custom') {
    setBrushColor(controls.textColor.value, { persist: false, mode: 'theme' });
  }
  markThemeExplicit();
  updateThemeGridSelection();
  handleSettingChange();
}

// Handle hex input changes.
// While typing (`commit: false`) we only apply complete 6-digit values and
// never rewrite the field — expanding "#ABC" to "#AABBCC" or uppercasing
// mid-keystroke moves the caret and fights the user. Normalization (shorthand
// expansion, uppercase, reverting invalid input) happens on commit
// (change/blur).
function handleHexInputChange(colorKey, { commit = false } = {}) {
  if (!workspaceWritable) return;
  const hexInput = hexInputs[colorKey];
  const colorInput = controls[colorKey];
  if (!hexInput || !colorInput) return;

  let value = hexInput.value.trim();

  // Add # if missing
  if (value && !value.startsWith('#')) {
    value = '#' + value;
  }

  const isFullHex = /^#[A-Fa-f0-9]{6}$/.test(value);
  const isShortHex = /^#[A-Fa-f0-9]{3}$/.test(value);

  if (!commit) {
    if (isFullHex) {
      colorInput.value = value;
      handleColorChange();
    }
    return;
  }

  if (isFullHex || isShortHex) {
    if (isShortHex) {
      value = '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
    }
    hexInput.value = value.toUpperCase();
    colorInput.value = value;
    handleColorChange();
  } else {
    // Invalid on commit — revert to the currently applied color.
    hexInput.value = colorInput.value.toUpperCase();
  }
}

// Handle setting changes
function handleSettingChange() {
  if (!workspaceWritable) return;
  const settings = getCurrentSettings();
  applySettings(settings);
  scheduleSettingsSave();
  updateBrushSizeButtons();
  
  // Update value displays
  valueDisplays.fontSize.textContent = settings.fontSize + 'px';
  valueDisplays.lineHeight.textContent = settings.lineHeight;
  valueDisplays.letterSpacing.textContent = settings.letterSpacing + 'em';
  valueDisplays.maxWidth.textContent = settings.maxWidth + 'px';

  scheduleDrawingLayerSync({ forceRedraw: true });
}

// Reset settings to defaults
function resetSettings() {
  if (!workspaceWritable) return;
  currentTheme = 'lavender';
  const resetSettingsValues = { ...DEFAULT_SETTINGS };
  applySettings(resetSettingsValues);
  updateControlValues(resetSettingsValues);
  saveSettings(resetSettingsValues);
  updateThemeGridSelection();
  scheduleDrawingLayerSync({ forceRedraw: true });
}

function downloadWorkspaceBackup() {
  try {
    const content = serializeWorkspaceBackup(getWorkspaceForPersistence({ captureEditor: true }), { appVersion: APP_VERSION });
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = makeBackupFilename();
    // The app-wide outside-click handler should not interpret this transient
    // download link as a click outside the Settings panel.
    link.addEventListener('click', event => event.stopPropagation(), { once: true });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    statusAnnouncer.show('Backup downloaded. Keep it somewhere you control.', { kind: 'success' });
  } catch (error) {
    handleStorageError(error, 'exporting backup');
  }
}

function closeImportDialog({ restoreFocus = false } = {}) {
  pendingWorkspaceImport = null;
  if (importConfirmDialog) importConfirmDialog.hidden = true;
  if (restoreFocus) importWorkspaceBtn?.focus();
}

async function selectWorkspaceBackup(file) {
  if (!workspaceWritable || !file) return;

  try {
    const parsed = parseWorkspaceBackup(await file.text(), {
      defaults: DEFAULT_SETTINGS,
      sanitizeHtml: sanitizeStoredContent
    });
    pendingWorkspaceImport = parsed.workspace;
    if (importConfirmText) {
      const exportedWhen = parsed.metadata.exportedAt
        ? ` It was exported ${new Date(parsed.metadata.exportedAt).toLocaleString('en-US')}.`
        : '';
      importConfirmText.textContent = `This will replace the current ${describeBackup(getWorkspaceForPersistence())} with ${describeBackup(parsed.workspace)}. A local recovery snapshot is saved first.${exportedWhen}`;
    }
    if (importConfirmDialog) {
      importConfirmDialog.hidden = false;
      requestAnimationFrame(() => confirmImportBtn?.focus());
    }
  } catch (error) {
    pendingWorkspaceImport = null;
    statusAnnouncer.show(error?.message || 'The backup could not be imported.', { kind: 'error', duration: 8_000 });
  }
}

async function confirmWorkspaceImport() {
  if (!workspaceWritable || !pendingWorkspaceImport) return;

  const importCandidate = pendingWorkspaceImport;
  confirmImportBtn.disabled = true;

  try {
    // Capture the editor's final debounce-window content before the store makes
    // its recovery snapshot. This is why the snapshot can restore a note even
    // when import happens immediately after typing.
    await workspaceStore.saveWorkspace(getWorkspaceForPersistence({ captureEditor: true }));
    await workspaceStore.replaceWorkspaceWithSnapshot(importCandidate, 'Before backup import');

    applyWorkspaceToEditor(importCandidate);
    closeImportDialog({ restoreFocus: true });
    workspaceChannel.post('workspace-imported');
    statusAnnouncer.show('Backup imported. Your previous workspace is available as a local recovery snapshot.', { kind: 'success', duration: 7_000 });
    void updateStorageSummary();
    void updateRecoverySummary();
  } catch (error) {
    handleStorageError(error, 'importing backup');
  } finally {
    confirmImportBtn.disabled = false;
  }
}

function closeRestoreDialog({ restoreFocus = false } = {}) {
  pendingRecoverySnapshot = null;
  if (restoreConfirmDialog) restoreConfirmDialog.hidden = true;
  if (restoreFocus) restoreSnapshotBtn?.focus();
}

async function openLatestRecoverySnapshot() {
  if (!workspaceWritable) return;
  try {
    const [latestSnapshot] = await workspaceStore.listSnapshots();
    if (!latestSnapshot) {
      statusAnnouncer.show('There is no recovery snapshot yet.', { kind: 'info' });
      return;
    }

    pendingRecoverySnapshot = latestSnapshot;
    if (restoreConfirmText) {
      restoreConfirmText.textContent = `Restore the snapshot from ${new Date(latestSnapshot.createdAt).toLocaleString('en-US')}? Your current workspace will be saved as a new snapshot first.`;
    }
    if (restoreConfirmDialog) {
      restoreConfirmDialog.hidden = false;
      requestAnimationFrame(() => confirmRestoreBtn?.focus());
    }
  } catch (error) {
    handleStorageError(error, 'opening recovery snapshots');
  }
}

async function confirmRecoveryRestore() {
  if (!workspaceWritable || !pendingRecoverySnapshot) return;
  const snapshot = pendingRecoverySnapshot;
  confirmRestoreBtn.disabled = true;

  try {
    const currentWorkspace = getWorkspaceForPersistence({ captureEditor: true });
    await workspaceStore.saveWorkspace(currentWorkspace);
    await workspaceStore.createSnapshot('Before restoring recovery snapshot', currentWorkspace);
    const restoredWorkspace = await workspaceStore.restoreSnapshot(snapshot.id);
    applyWorkspaceToEditor(restoredWorkspace);
    closeRestoreDialog({ restoreFocus: true });
    workspaceChannel.post('snapshot-restored', { snapshotId: snapshot.id });
    statusAnnouncer.show('Recovery snapshot restored. The workspace you replaced was saved first.', { kind: 'success', duration: 7_000 });
    void updateStorageSummary();
    void updateRecoverySummary();
  } catch (error) {
    handleStorageError(error, 'restoring recovery snapshot');
  } finally {
    confirmRestoreBtn.disabled = false;
  }
}

function setupPwaUpdatePrompt() {
  registerPwaUpdates({
    onUpdateReady({ apply }) {
      if (!updateReadyNotice) return;
      updateReadyNotice.hidden = false;
      reloadForUpdateBtn?.addEventListener('click', async () => {
        reloadForUpdateBtn.disabled = true;
        flushPendingPersistence();
        await workspaceStore.flush();
        apply();
      }, { once: true });
    },
    onControllerChange() {
      window.location.reload();
    },
    onError(error) {
      console.warn('PWA update check failed:', error);
    }
  });
}

// Event Listeners

if (exportWorkspaceBtn) {
  exportWorkspaceBtn.addEventListener('click', downloadWorkspaceBackup);
}

if (importWorkspaceBtn && importWorkspaceInput) {
  importWorkspaceBtn.addEventListener('click', () => importWorkspaceInput.click());
  importWorkspaceInput.addEventListener('change', async () => {
    const [file] = importWorkspaceInput.files || [];
    importWorkspaceInput.value = '';
    await selectWorkspaceBackup(file);
  });
}

if (cancelImportBtn) {
  cancelImportBtn.addEventListener('click', () => closeImportDialog({ restoreFocus: true }));
}

if (confirmImportBtn) {
  confirmImportBtn.addEventListener('click', confirmWorkspaceImport);
}

if (restoreSnapshotBtn) {
  restoreSnapshotBtn.addEventListener('click', openLatestRecoverySnapshot);
}

if (cancelRestoreBtn) {
  cancelRestoreBtn.addEventListener('click', () => closeRestoreDialog({ restoreFocus: true }));
}

if (confirmRestoreBtn) {
  confirmRestoreBtn.addEventListener('click', confirmRecoveryRestore);
}

if (importConfirmDialog) {
  importConfirmDialog.addEventListener('click', event => {
    if (event.target === importConfirmDialog) closeImportDialog({ restoreFocus: true });
  });
}

if (restoreConfirmDialog) {
  restoreConfirmDialog.addEventListener('click', event => {
    if (event.target === restoreConfirmDialog) closeRestoreDialog({ restoreFocus: true });
  });
}

// Editor input - auto-save
editor.addEventListener('input', debouncedSave);
editor.addEventListener('input', () => scheduleDrawingLayerSync());
editor.addEventListener('input', scheduleTextSnapshot);

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
    // Inserting via script doesn't fire 'input', so save/snapshot explicitly.
    debouncedSave();
    debouncedWordCount();
    scheduleTextSnapshot();
    scheduleDrawingLayerSync();
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
    scheduleTextSnapshot();
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
      const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
      
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
['textColor', 'backgroundColor', 'selectionColor'].forEach(key => {
  controls[key].addEventListener('input', handleColorChange);
  controls[key].addEventListener('change', handleColorChange);
});

// Hex input controls
['textColor', 'backgroundColor', 'selectionColor'].forEach(key => {
  if (hexInputs[key]) {
    hexInputs[key].addEventListener('input', () => handleHexInputChange(key));
    hexInputs[key].addEventListener('change', () => handleHexInputChange(key, { commit: true }));
    hexInputs[key].addEventListener('blur', () => handleHexInputChange(key, { commit: true }));
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

if (drawSizeToggleBtn) {
  drawSizeToggleBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleDrawSizePopover();
  });
}

if (drawSizeSlider) {
  drawSizeSlider.addEventListener('input', () => {
    setBrushSize(drawSizeSlider.value);
    positionDrawSizePopover();
  });

  drawSizeSlider.addEventListener('change', () => {
    setBrushSize(drawSizeSlider.value);
  });
}

if (undoDrawingBtn) {
  undoDrawingBtn.addEventListener('click', (event) => {
    undoLastStroke();
    event.currentTarget.blur();
  });
}

if (clearDrawingsBtn) {
  clearDrawingsBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const page = getCurrentPage();
    if (!page || !Array.isArray(page.drawings) || page.drawings.length === 0) {
      // Nothing to clear — quietly do nothing.
      return;
    }
    if (uiState.clearDrawingsConfirmOpen) {
      closeClearDrawingsConfirm({ restoreFocus: false });
    } else {
      openClearDrawingsConfirm();
    }
  });
}

if (cancelClearDrawingsBtn) {
  cancelClearDrawingsBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    closeClearDrawingsConfirm({ restoreFocus: true });
  });
}

if (confirmClearDrawingsBtn) {
  confirmClearDrawingsBtn.addEventListener('click', async (event) => {
    event.stopPropagation();
    await clearCurrentPageDrawings();
  });
}

if (drawingLayer) {
  drawingLayer.addEventListener('pointerdown', beginStroke);
  drawingLayer.addEventListener('pointermove', extendStroke);
  drawingLayer.addEventListener('pointerup', finishStroke);
  drawingLayer.addEventListener('pointercancel', finishStroke);
}

window.addEventListener('resize', () => {
  scheduleDrawingLayerSync({ forceRedraw: true });
  if (emojiPicker?.classList.contains('visible')) {
    positionEmojiPicker(editingPageId);
  }
  if (uiState.drawSizePopoverOpen) {
    positionDrawSizePopover();
  }
  if (uiState.deleteConfirmOpen) {
    positionDeletePageConfirm();
  }
  if (uiState.clearDrawingsConfirmOpen) {
    positionClearDrawingsConfirm();
  }
});

window.addEventListener('wheel', (event) => {
  if (!shouldHandleFontResizeWheel(event)) {
    return;
  }

  const wheelDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
  if (!wheelDelta) {
    return;
  }

  const delta = Math.abs(wheelDelta) >= 80 ? 2 : 1;
  const direction = wheelDelta < 0 ? delta : -delta;
  const changed = adjustFontSizeByStep(direction);

  if (changed) {
    event.preventDefault();
  }
}, { passive: false });

window.addEventListener('scroll', () => {
  handleScrollActivity({ persistPageScroll: !isRestoringPageScroll });
}, { passive: true });

if (pageTabsList) {
  pageTabsList.addEventListener('scroll', () => {
    updatePageTabsScrollState();
    handleScrollActivity({ repositionEmojiPicker: true });
  }, { passive: true });

  window.addEventListener('resize', updatePageTabsScrollState, { passive: true });
}

if (emojiPicker) {
  emojiPicker.addEventListener('scroll', () => {
    handleScrollActivity();
  }, { passive: true });
}

// Flush everything that's still sitting in a debounce window. Without copying
// editor.innerHTML into the page first, closing the tab within a second of the
// last keystroke would lose those edits (debouncedSave waits 1000ms).
function flushPendingPersistence() {
  syncCurrentPageScrollPosition();

  const page = getCurrentPage();
  if (page) {
    page.content = editor.innerHTML;
  }

  persistPagesStateImmediately();
  flushPendingSettingsSave();
}

window.addEventListener('pagehide', flushPendingPersistence);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    flushPendingPersistence();
  }
});

document.addEventListener('click', (event) => {
  if (uiState.settingsOpen && !event.target.closest('.controls-container') && !event.target.closest('.color-picker-popup')) {
    setSettingsPanelOpen(false);
  }

  if (uiState.drawSizePopoverOpen && !event.target.closest('#drawSizePopover') && !event.target.closest('#drawSizeToggleBtn')) {
    closeDrawSizePopover();
  }

  if (uiState.deleteConfirmOpen && !event.target.closest('#deletePageConfirm') && !event.target.closest('#emojiPickerDelete')) {
    closeDeletePageConfirm();
  }

  if (uiState.clearDrawingsConfirmOpen && !event.target.closest('#clearDrawingsConfirm') && !event.target.closest('#clearDrawingsBtn')) {
    closeClearDrawingsConfirm();
  }
});

if (window.ResizeObserver && board) {
  const resizeObserver = new ResizeObserver(() => {
    scheduleDrawingLayerSync({ forceRedraw: true });
  });

  resizeObserver.observe(board);
  if (editorShell) {
    resizeObserver.observe(editorShell);
  }
  resizeObserver.observe(editor);
}

// Initialize emoji picker
initEmojiPicker();

// Initialize brush size markers
initBrushSizeMarkers();

// Initialize font dropdown
initFontDropdown();

// Word count element
const wordCountEl = document.getElementById('wordCount');

// Update word/character count
function updateWordCount() {
  if (!wordCountEl) return;
  const text = editor.innerText || '';
  const chars = text.length;
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;

  // Don't show "0 words · 0 chars" on an empty page — keep the canvas quiet.
  if (chars === 0) {
    wordCountEl.textContent = '';
    wordCountEl.classList.add('is-empty');
  } else {
    wordCountEl.textContent = `${words} words · ${chars} chars`;
    wordCountEl.classList.remove('is-empty');
  }
}

// Debounced word count update
const debouncedWordCount = debounce(updateWordCount, 300);
editor.addEventListener('input', debouncedWordCount);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Never hijack keys while an IME is composing.
  if (e.isComposing || e.keyCode === 229) {
    return;
  }

  if (e.key === 'Escape') {
    if (!importConfirmDialog?.hidden) {
      e.preventDefault();
      closeImportDialog({ restoreFocus: true });
      return;
    }

    if (!restoreConfirmDialog?.hidden) {
      e.preventDefault();
      closeRestoreDialog({ restoreFocus: true });
      return;
    }

    if (uiState.deleteConfirmOpen) {
      e.preventDefault();
      closeDeletePageConfirm({ restoreFocus: true });
      return;
    }

    if (uiState.clearDrawingsConfirmOpen) {
      e.preventDefault();
      closeClearDrawingsConfirm({ restoreFocus: true });
      return;
    }

    if (uiState.drawSizePopoverOpen) {
      e.preventDefault();
      closeDrawSizePopover({ restoreFocus: true });
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

  // Match on e.code as well as e.key — on macOS, Option+Shift+letter produces
  // a different character in e.key, which would make these shortcuts dead.
  const matchesAltShiftKey = (letter, code) =>
    e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey &&
    (e.key.toLowerCase() === letter || e.code === code);

  if (matchesAltShiftKey('b', 'KeyB') && shouldHandleBrushToggleShortcut(e)) {
    e.preventDefault();
    toggleDrawingTool('brush');
    return;
  }

  if (matchesAltShiftKey('e', 'KeyE') && shouldHandleBrushToggleShortcut(e)) {
    e.preventDefault();
    toggleDrawingTool('eraser');
    return;
  }

  // Alt+Shift+N: new page. (Ctrl/Cmd+N is reserved by the browser and never
  // reaches the page, so it can't be used as a shortcut.)
  if (matchesAltShiftKey('n', 'KeyN') && shouldHandleBrushToggleShortcut(e)) {
    e.preventDefault();
    addNewPage();
    return;
  }

  if (isUndoShortcut(e)) {
    if (drawingState.enabled && shouldHandleDrawingUndoShortcut(e)) {
      e.preventDefault();
      undoLastStroke();
      return;
    }

    if (isEditorHistoryTarget(e)) {
      e.preventDefault();
      undoTextEdit();
      return;
    }

    if (isTextEditingShortcutTarget(e)) {
      return;
    }
  }

  if (isRedoShortcut(e) && !drawingState.enabled && isEditorHistoryTarget(e)) {
    e.preventDefault();
    redoTextEdit();
    return;
  }

  if (drawingState.enabled && shouldHandleDrawingShortcut(e)) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setDrawMode(false);
      return;
    }
  }

});

// Dev-time sanity check — flags themes missing required color fields before
// they ship a broken swatch. Cheap, runs once.
(function validateThemes() {
  const REQUIRED = ['name', 'textColor', 'backgroundColor', 'selectionColor'];
  for (const [key, theme] of Object.entries(THEMES)) {
    for (const field of REQUIRED) {
      if (!theme || typeof theme[field] !== 'string' || !theme[field]) {
        console.warn(`[THEMES] "${key}" is missing required field "${field}".`);
      }
    }
  }
})();

async function bootstrapApp() {
  workspaceLock = await acquireWorkspaceLock();
  if (!workspaceLock.acquired) {
    setWorkspaceReadOnlyMode('Another Blackboard Text tab already owns the writing lock.');
  }

  workspaceChannel.onMessage(message => {
    if (!workspaceWritable && message?.type === 'workspace-imported') {
      statusAnnouncer.show('The editing tab imported a backup. Reload this read-only tab to see it.', { kind: 'info', duration: 8_000 });
    }
  });

  await loadSavedData();
  scheduleDrawingLayerSync({ forceRedraw: true });
  setupPwaUpdatePrompt();

  // Focus editor on load without auto-scrolling to top, so the per-page scroll
  // restore inside loadSavedData isn't overridden. A locked second tab stays
  // unfocused and clearly read-only instead.
  if (workspaceWritable) {
    try {
      editor.focus({ preventScroll: true });
    } catch (error) {
      editor.focus();
    }
  }
}

window.addEventListener('unload', () => {
  workspaceLock?.release?.();
  workspaceChannel.close();
});

window.addEventListener('focus', () => {
  void tryPromoteReadOnlyTab();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void tryPromoteReadOnlyTab();
});

void bootstrapApp();
