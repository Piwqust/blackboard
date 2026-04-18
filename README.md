# Blackboard Text

Minimalist note-taking Chrome extension with customizable typography, page tabs, and freehand drawing.

![Blackboard Text preview](./theme-ui.png)

## Features

- Clean distraction-free writing canvas
- Multiple pages with emoji labels
- Adjustable font, size, line height, letter spacing, and content width
- Built-in theme presets plus custom text, background, and selection colors
- Drawing and eraser tools with brush sizes, undo, and clear actions
- Word and character count
- Automatic persistence with `chrome.storage`

## Install locally

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project folder
5. Click the extension icon to open `editor.html`

## Usage

- Write directly in the editor
- Open **Settings** to adjust typography, canvas width, themes, and custom colors
- Add pages with the **+** button or `Ctrl/Cmd + N`
- Use `Alt + Shift + B` for the brush and `Alt + Shift + E` for the eraser
- Use `Ctrl/Cmd + Z` to undo the last drawing stroke
- Press `Tab` / `Shift + Tab` to indent or un-indent text

## Storage

- Page content and current page are saved in `chrome.storage.local`
- Settings are saved in `chrome.storage.sync`

## Project structure

- `manifest.json` — extension manifest
- `service-worker.js` — opens the editor when the extension action is clicked
- `editor.html` — main UI
- `editor.css` — styling
- `editor.js` — editor, page, drawing, settings, and persistence logic
- `icons/` — extension icons
- `fonts/` — bundled fonts

## Version

Current manifest version: `1.6.0`
