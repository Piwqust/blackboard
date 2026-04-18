# Task Context: Editor Bugfixes

Session ID: 2026-04-18-editor-bugfixes
Created: 2026-04-18T00:00:00Z
Status: in_progress

## Current Request
1. Make all images scalable relative to the text size.
2. Fix the bug: when I scroll the page, the hover effect doesn't disappear.
3. Fix drawing mode lag, prevent exiting drawing mode from taking the page back to the top, and stop text input lag after exiting drawing mode.

## Context Files (Standards to Follow)
- C:\Users\wheny\.opencode\context\core\standards\code-quality.md
- C:\Users\wheny\.opencode\context\core\standards\code-analysis.md
- C:\Users\wheny\.opencode\context\ui\web\ui-styling-standards.md
- C:\Users\wheny\.opencode\context\core\workflows\feature-breakdown.md

## Reference Files (Source Material to Look At)
- C:\Users\wheny\Desktop\CODE\blackboard-text\README.md
- C:\Users\wheny\Desktop\CODE\blackboard-text\editor.html
- C:\Users\wheny\Desktop\CODE\blackboard-text\editor.css
- C:\Users\wheny\Desktop\CODE\blackboard-text\editor.js

## External Docs Fetched
- None

## Components
- Editor content styling for text-relative embedded media
- Scroll/hover state suppression for floating controls and page tabs
- Drawing mode lifecycle, canvas sync, and text editor focus/scroll stability

## Constraints
- Plain HTML/CSS/JS Chrome extension codebase
- Keep fixes scoped and maintainable
- Avoid introducing regressions in page persistence, drawing persistence, and editor typing behavior
- Validate each change incrementally

## Exit Criteria
- [ ] Images inside the editor scale with text size instead of staying fixed-size
- [ ] Hover visuals no longer remain stuck after scroll activity
- [ ] Drawing interactions feel responsive without severe lag
- [ ] Exiting drawing mode does not jump the viewport to the top
- [ ] Typing remains responsive after leaving drawing mode
