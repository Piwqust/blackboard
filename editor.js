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
    selectionColor: '#4A4E69'
  },
  sepia: {
    name: 'Sepia',
    textColor: '#5C4033',
    backgroundColor: '#F4ECD8',
    selectionColor: '#8B7355'
  },
  forest: {
    name: 'Forest',
    textColor: '#2D5A27',
    backgroundColor: '#F0F5E9',
    selectionColor: '#4A7C43'
  },
  ocean: {
    name: 'Ocean',
    textColor: '#1E5162',
    backgroundColor: '#E8F4F8',
    selectionColor: '#2980B9'
  },
  rose: {
    name: 'Rosé',
    textColor: '#8E4A5C',
    backgroundColor: '#FDF2F4',
    selectionColor: '#C77B8B'
  },
  charcoal: {
    name: 'Charcoal',
    textColor: '#D4D4D4',
    backgroundColor: '#2D2D2D',
    selectionColor: '#505050'
  },
  paper: {
    name: 'Paper',
    textColor: '#333333',
    backgroundColor: '#FFFFFF',
    selectionColor: '#6B7280'
  }
};

// Default settings
const DEFAULT_SETTINGS = {
  fontFamily: 'Georgia, serif',
  fontSize: 18,
  lineHeight: 1.8,
  letterSpacing: 0,
  maxWidth: 800,
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

// DOM Elements
const editor = document.getElementById('editor');
const saveIndicator = document.getElementById('saveIndicator');
const pageTabsList = document.getElementById('pageTabsList');
const addPageBtn = document.getElementById('addPageBtn');
const emojiGrid = document.getElementById('emojiGrid');
const themeGrid = document.getElementById('themeGrid');

// Setting controls
const controls = {
  fontFamily: document.getElementById('fontFamily'),
  fontSize: document.getElementById('fontSize'),
  lineHeight: document.getElementById('lineHeight'),
  letterSpacing: document.getElementById('letterSpacing'),
  maxWidth: document.getElementById('maxWidth'),
  textColor: document.getElementById('textColor'),
  backgroundColor: document.getElementById('backgroundColor'),
  selectionColor: document.getElementById('selectionColor')
};

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
  const labels = { textColor: 'Text Color', backgroundColor: 'Background', selectionColor: 'Selection' };
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
  
  let left = rect.left - popupWidth - 12;
  let top = rect.top - 50;
  
  // Keep within viewport
  if (left < 12) left = rect.right + 12;
  if (top < 12) top = 12;
  if (top + popupHeight > window.innerHeight - 12) {
    top = window.innerHeight - popupHeight - 12;
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
  
  // Apply settings live
  handleColorChange();
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

// Close picker when clicking outside
document.addEventListener('click', (e) => {
  if (colorPickerState.isOpen) {
    if (!e.target.closest('.color-picker-popup') && !e.target.closest('.color-control input[type="color"]')) {
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
  const isMovingToControls = relatedTarget && relatedTarget.closest('.controls-container');
  
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

// Apply settings to CSS custom properties
function applySettings(settings) {
  const root = document.documentElement;
  root.style.setProperty('--font-family', settings.fontFamily);
  root.style.setProperty('--font-size', settings.fontSize + 'px');
  root.style.setProperty('--line-height', settings.lineHeight);
  root.style.setProperty('--letter-spacing', settings.letterSpacing + 'em');
  root.style.setProperty('--max-width', settings.maxWidth + 'px');
  root.style.setProperty('--text-color', settings.textColor);
  root.style.setProperty('--bg-color', settings.backgroundColor);
  root.style.setProperty('--selection-color', settings.selectionColor);
}

// Update control values in UI
function updateControlValues(settings) {
  controls.fontFamily.value = settings.fontFamily;
  controls.fontSize.value = settings.fontSize;
  controls.lineHeight.value = settings.lineHeight;
  controls.letterSpacing.value = settings.letterSpacing;
  controls.maxWidth.value = settings.maxWidth;
  controls.textColor.value = settings.textColor;
  controls.backgroundColor.value = settings.backgroundColor;
  controls.selectionColor.value = settings.selectionColor;
  
  // Update hex inputs
  if (hexInputs.textColor) hexInputs.textColor.value = settings.textColor;
  if (hexInputs.backgroundColor) hexInputs.backgroundColor.value = settings.backgroundColor;
  if (hexInputs.selectionColor) hexInputs.selectionColor.value = settings.selectionColor;
  
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
    const content = editor.innerHTML;
    const pageIndex = pages.findIndex(p => p.id === currentPageId);
    if (pageIndex === -1) {
      console.warn('Current page not found in pages array');
      return;
    }
    pages[pageIndex].content = content;
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
    
    // Migration: convert old single-note format to pages
    if (!localData.pages && localData.noteContent) {
      pages = [{
        id: generateId(),
        emoji: '📝',
        content: localData.noteContent
      }];
      currentPageId = pages[0].id;
      await chrome.storage.local.set({ pages, currentPageId });
      await chrome.storage.local.remove(['noteContent']);
    } else if (localData.pages && localData.pages.length > 0) {
      pages = localData.pages;
      currentPageId = localData.currentPageId || pages[0].id;
    } else {
      // Create default page
      pages = [{
        id: generateId(),
        emoji: '📝',
        content: ''
      }];
      currentPageId = pages[0].id;
      await chrome.storage.local.set({ pages, currentPageId });
    }
    
    renderPageTabs();
    loadPageContent(currentPageId);
    
    // Load settings
    const syncData = await chrome.storage.sync.get(['settings']);
    const settings = { ...DEFAULT_SETTINGS, ...syncData.settings };
    
    // Set current theme
    currentTheme = settings.currentTheme || 'lavender';
    
    applySettings(settings);
    updateControlValues(settings);
    
    // Initialize theme grid
    initThemeGrid();
    updateThemeGridSelection();
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
  }
}

// Render page tabs
function renderPageTabs() {
  pageTabsList.innerHTML = '';
  
  pages.forEach((page, index) => {
    const tab = document.createElement('button');
    tab.className = 'page-tab' + (page.id === currentPageId ? ' active' : '');
    tab.title = 'Click to switch, double-click to change emoji, drag to reorder';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', page.id === currentPageId ? 'true' : 'false');
    tab.setAttribute('tabindex', page.id === currentPageId ? '0' : '-1');
    tab.setAttribute('draggable', 'true');
    tab.dataset.pageId = page.id;
    tab.dataset.pageIndex = index;
    
    // Create emoji element
    const emoji = typeof page.emoji === 'string' ? page.emoji : '📝';
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
      if (page.id !== currentPageId) {
        saveContent();
        loadPageContent(page.id);
      }
    });
    
    // Double click to change emoji
    tab.addEventListener('dblclick', (e) => {
      openEmojiPicker(page.id);
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
  
  saveContent();
  
  const newPage = {
    id: generateId(),
    emoji: emoji,
    content: ''
  };
  
  pages.push(newPage);
  currentPageId = newPage.id;
  editor.innerHTML = '';
  
  chrome.storage.local.set({ pages, currentPageId });
  renderPageTabs();
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
  const picker = document.getElementById('emojiPicker');
  picker.classList.add('visible');
}

// Close emoji picker
function closeEmojiPicker() {
  editingPageId = null;
  const picker = document.getElementById('emojiPicker');
  picker.classList.remove('visible');
}

// Select emoji for page
function selectEmoji(emoji) {
  if (!editingPageId) return;
  
  const page = pages.find(p => p.id === editingPageId);
  if (page) {
    page.emoji = emoji;
    chrome.storage.local.set({ pages });
    renderPageTabs();
  }
  
  closeEmojiPicker();
}

// Initialize emoji picker
function initEmojiPicker() {
  emojiGrid.innerHTML = '';
  
  PAGE_EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-option';
    btn.textContent = emoji;
    btn.addEventListener('click', () => selectEmoji(emoji));
    emojiGrid.appendChild(btn);
  });
  
  // Click outside to close
  document.addEventListener('click', (e) => {
    const picker = document.getElementById('emojiPicker');
    if (picker.classList.contains('visible')) {
      if (!e.target.closest('.emoji-picker') && !e.target.closest('.page-tab')) {
        closeEmojiPicker();
      }
    }
  });
  
  // Delete button
  const deleteBtn = document.getElementById('emojiPickerDelete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
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
    textColor: controls.textColor.value,
    backgroundColor: controls.backgroundColor.value,
    selectionColor: controls.selectionColor.value,
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
    
    const text = document.createElement('span');
    text.className = 'theme-swatch-text';
    text.style.color = theme.textColor;
    text.textContent = 'Aa';
    
    const nameEl = document.createElement('span');
    nameEl.className = 'theme-swatch-name';
    nameEl.textContent = theme.name;
    
    inner.appendChild(text);
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
  controls.selectionColor.value = theme.selectionColor;
  
  // Update hex inputs
  if (hexInputs.textColor) hexInputs.textColor.value = theme.textColor;
  if (hexInputs.backgroundColor) hexInputs.backgroundColor.value = theme.backgroundColor;
  if (hexInputs.selectionColor) hexInputs.selectionColor.value = theme.selectionColor;
  
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
  const selColor = controls.selectionColor.value.toUpperCase();
  
  // Sync hex inputs
  if (hexInputs.textColor) hexInputs.textColor.value = controls.textColor.value;
  if (hexInputs.backgroundColor) hexInputs.backgroundColor.value = controls.backgroundColor.value;
  if (hexInputs.selectionColor) hexInputs.selectionColor.value = controls.selectionColor.value;
  
  let matchedTheme = null;
  for (const [key, theme] of Object.entries(THEMES)) {
    if (theme.textColor.toUpperCase() === textColor &&
        theme.backgroundColor.toUpperCase() === bgColor &&
        theme.selectionColor.toUpperCase() === selColor) {
      matchedTheme = key;
      break;
    }
  }
  
  currentTheme = matchedTheme || 'custom';
  updateThemeGridSelection();
  handleSettingChange();
}

// Handle hex input changes
function handleHexInputChange(colorKey) {
  const hexInput = hexInputs[colorKey];
  const colorInput = controls[colorKey];
  if (!hexInput || !colorInput) return;
  
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
}

// Reset settings to defaults
function resetSettings() {
  currentTheme = 'lavender';
  applySettings(DEFAULT_SETTINGS);
  updateControlValues(DEFAULT_SETTINGS);
  saveSettings(DEFAULT_SETTINGS);
  updateThemeGridSelection();
}

// Event Listeners

// Editor input - auto-save
editor.addEventListener('input', debouncedSave);

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

// Setting controls (non-color)
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
    hexInputs[key].addEventListener('change', () => handleHexInputChange(key));
    hexInputs[key].addEventListener('blur', () => handleHexInputChange(key));
  }
});

// Reset button
document.getElementById('resetSettings').addEventListener('click', resetSettings);

// Add page button
addPageBtn.addEventListener('click', addNewPage);

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
  // Ctrl+N: New page
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault();
    addNewPage();
  }
});

// Initialize
loadSavedData();

// Focus editor on load
editor.focus();
