// Default settings
const DEFAULT_SETTINGS = {
  fontFamily: 'Georgia, serif',
  fontSize: 18,
  lineHeight: 1.8,
  letterSpacing: 0,
  maxWidth: 800,
  textColor: '#6D68B3',
  backgroundColor: '#ECEDE7',
  selectionColor: '#6D68B3'
};

// Apple-style emoji collection for pages
const PAGE_EMOJIS = [
  '📝', '✏️', '📖', '📚', '📓', '📒', '📕', '📗',
  '🌟', '⭐', '✨', '💫', '🌙', '☀️', '🌈', '🔥',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '🍎', '🍊', '🍋', '🍀', '🌸', '🌺', '🌻', '🌷',
  '🦋', '🐝', '🐱', '🐶', '🦊', '🐰', '🐻', '🐼',
  '🎵', '🎨', '🎭', '🎪', '🎯', '🎲', '🎮', '🕹️',
  '☕', '🍵', '🧁', '🍰', '🍩', '🍪', '🍫', '🍬',
  '🏠', '🏡', '🌍', '🚀', '✈️', '⛵', '🚲', '🛸',
  '💡', '💎', '🔮', '🎀', '🎁', '🏆', '🎈', '🎉',
  '📱', '💻', '⌨️', '🖥️', '📷', '🎬', '🎤', '🎧'
];

// DOM Elements
const editor = document.getElementById('editor');
const saveIndicator = document.getElementById('saveIndicator');
const pageTabsList = document.getElementById('pageTabsList');
const addPageBtn = document.getElementById('addPageBtn');
const emojiPickerOverlay = document.getElementById('emojiPickerOverlay');
const emojiGrid = document.getElementById('emojiGrid');

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
  
  // Update value displays
  valueDisplays.fontSize.textContent = settings.fontSize + 'px';
  valueDisplays.lineHeight.textContent = settings.lineHeight;
  valueDisplays.letterSpacing.textContent = settings.letterSpacing + 'em';
  valueDisplays.maxWidth.textContent = settings.maxWidth + 'px';
}

// Save note content
async function saveContent() {
  if (!currentPageId) return;
  
  const content = editor.innerHTML;
  const pageIndex = pages.findIndex(p => p.id === currentPageId);
  if (pageIndex !== -1) {
    pages[pageIndex].content = content;
    await chrome.storage.local.set({ 
      pages: pages,
      lastSaved: Date.now()
    });
    showSaveIndicator();
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
  await chrome.storage.sync.set({ settings });
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
    
    applySettings(settings);
    updateControlValues(settings);
  } catch (error) {
    console.error('Error loading saved data:', error);
    applySettings(DEFAULT_SETTINGS);
    updateControlValues(DEFAULT_SETTINGS);
  }
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Load page content
function loadPageContent(pageId) {
  const page = pages.find(p => p.id === pageId);
  if (page) {
    editor.innerHTML = page.content;
    currentPageId = pageId;
    chrome.storage.local.set({ currentPageId });
    renderPageTabs();
  }
}

// Render page tabs
function renderPageTabs() {
  pageTabsList.innerHTML = '';
  
  pages.forEach(page => {
    const tab = document.createElement('button');
    tab.className = 'page-tab' + (page.id === currentPageId ? ' active' : '');
    tab.title = 'Click to switch, double-click to change emoji';
    tab.innerHTML = `
      ${page.emoji}
      ${pages.length > 1 ? '<span class="page-tab-delete" title="Delete page">×</span>' : ''}
    `;
    
    // Single click to switch page
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('page-tab-delete')) {
        deletePage(page.id);
        return;
      }
      if (page.id !== currentPageId) {
        saveContent();
        loadPageContent(page.id);
      }
    });
    
    // Double click to change emoji
    tab.addEventListener('dblclick', (e) => {
      if (!e.target.classList.contains('page-tab-delete')) {
        openEmojiPicker(page.id);
      }
    });
    
    pageTabsList.appendChild(tab);
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
  emojiPickerOverlay.classList.add('visible');
}

// Close emoji picker
function closeEmojiPicker() {
  editingPageId = null;
  emojiPickerOverlay.classList.remove('visible');
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
  PAGE_EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-option';
    btn.textContent = emoji;
    btn.addEventListener('click', () => selectEmoji(emoji));
    emojiGrid.appendChild(btn);
  });
  
  emojiPickerOverlay.addEventListener('click', (e) => {
    if (e.target === emojiPickerOverlay) {
      closeEmojiPicker();
    }
  });
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
    selectionColor: controls.selectionColor.value
  };
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
  applySettings(DEFAULT_SETTINGS);
  updateControlValues(DEFAULT_SETTINGS);
  saveSettings(DEFAULT_SETTINGS);
}

// Event Listeners

// Editor input - auto-save
editor.addEventListener('input', debouncedSave);

// Prevent unwanted formatting on paste - keep plain text
editor.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  document.execCommand('insertText', false, text);
});

// Setting controls
Object.values(controls).forEach(control => {
  control.addEventListener('input', handleSettingChange);
  control.addEventListener('change', handleSettingChange);
});

// Reset button
document.getElementById('resetSettings').addEventListener('click', resetSettings);

// Add page button
addPageBtn.addEventListener('click', addNewPage);

// Initialize emoji picker
initEmojiPicker();

// Initialize
loadSavedData();

// Focus editor on load
editor.focus();
