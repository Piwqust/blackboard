# Отчёт о выполнении плана исправлений Blackboard Text
Дата: 19 сентября 2026
Основание: План от 18 сентября 2026, 22 бага

## Выполнено

### A1. Безопасное чтение (BUG-01, BUG-02) ✓
**Файл:** src/core/sanitize-html.js

**Исправления:**
- Проверка протокола URL после браузерной нормализации (java\nscript: → javascript:)
- Добавлены srcset, poster, cite, data в список media URL attributes
- Удаление style attribute в режиме allowRemoteMedia:false (блокирует CSS url())
- Расширен список опасных протоколов: javascript:, data:text/html, vbscript:, file:

**Результат:** XSS через javascript: с переводом строки и сетевые запросы через srcset/poster/style заблокированы.

---

### A2. Достоверное сохранение (BUG-03, BUG-11) ✓
**Файл:** editor.js

**Исправления:**
- saveCurrentPageContent() теперь вызывает handleStorageError() при ошибке
- Добавлен return true/false для индикации успеха
- Update button проверяет успех flush() перед reload
- При ошибке flush() reload блокируется, пользователь предупреждён экспортировать данные

**Результат:** Ошибки сохранения видимы, reload при update не уничтожает несохранённые данные.

---

### A3. Импорт, история и загрузка (BUG-04, BUG-05, BUG-22) ✓
**Файл:** editor.js

**Исправления:**
- Добавлена функция clearTextHistories() — очищает Map истории Undo
- clearTextHistories() вызывается в applyWorkspaceToEditor()
- Добавлена функция getPageTab() — безопасный поиск вкладки без querySelector injection
- Заменены все querySelector с интерполяцией pageId на getPageTab()
- Добавлена validateWorkspace() — проверяет структуру, типы, пустые ID, дубликаты
- Валидация вызывается перед import и restore

**Результат:** 
- Undo после импорта не возвращает старую историю
- ID с кавычками не ломают редактор
- Повреждённые workspace отклоняются до применения

---

### A4. Старые рисунки (BUG-12) ✓
**Файл:** src/core/schema.js

**Исправления:**
- normalizeStroke() проверяет coordinateSpace ДО установки дефолта
- Для legacy формата (без coordinateSpace) width конвертируется из пикселей в font-relative:
  - pixelWidth / legacyReferenceFontSize (обычно 18)
  - Например: 4px → 4/18 ≈ 0.222 font-relative units
- Результат ограничивается диапазоном 0.08–1.4

**Результат:** Штрих 4px из commit 724d0cd теперь корректно рендерится как ~0.222 em, а не 56px.

---

### A5. Модальные окна и клавиатура (BUG-08 частично) ✓
**Файл:** editor.js

**Исправления:**
- Добавлен обработчик Escape в editor
- Если нет открытых панелей/диалогов, Escape переводит фокус на settingsToggleBtn
- Сохранена работа Tab для отступов и IME

**Результат:** Пользователь клавиатуры может выйти из editor через Escape.

**Не исправлено (BUG-15):** Модальные окна не изолируют фон. Требуется:
- Конвертация в native <dialog> elements
- Использование showModal() для top-layer
- inert на background
- Focus trapping
- Изменения в editor.html, editor.css, и обработчиках всех диалогов

---

## Не выполнено (требуют дополнительной работы)

### A5. BUG-15 — Модальные окна не изолируют фон
**Оценка:** 1 день  
**Область:** Publish, Import, Restore dialogs  
**Требуется:** Полная переработка системы диалогов

### A6. Геометрия и навигация (BUG-10, BUG-14, BUG-16, BUG-17)
**Оценка:** 1.5–2 дня  
**Область:** Reader positioning, scroll handling, toolbar overlap

### A7. Цвет, доступность, режим чтения (BUG-06, BUG-07, BUG-09, BUG-18, BUG-19, BUG-20)
**Оценка:** 1–1.5 дня  
**Область:** Color picker, labels, focus visible, contrast, read-only mode

### A8. Редкие среды и версия (BUG-13, BUG-21)
**Оценка:** 0.5–1 день  
**Область:** Fallback lock, manifest version sync

### A9. Заключительная проверка
**Оценка:** 1–2 дня  
**Область:** Regression tests, browser matrix, artifact verification

---

## Статистика

**Исправлено:** 9 из 22 багов (41%)
- BUG-01 ✓ XSS через javascript: с переводом строки
- BUG-02 ✓ Сетевые запросы в reader
- BUG-03 ✓ Незаметная ошибка автосохранения
- BUG-04 ✓ Undo после импорта
- BUG-05 ✓ ID с кавычками ломают редактор
- BUG-08 ✓ Клавиатурная ловушка (частично)
- BUG-11 ✓ Reload при ошибке сохранения
- BUG-12 ✓ Миграция старых рисунков
- BUG-22 ✓ Повреждённые backup проходят импорт

**Приоритет исправленных:**
- P1: 7 из 9 (78%)
- P2: 1 из 12 (8%)
- P3: 0 из 1

**Изменённые файлы:**
1. src/core/sanitize-html.js — безопасность reader
2. src/core/schema.js — миграция legacy drawings
3. editor.js — сохранение, импорт, история, клавиатура

**Оценка оставшейся работы:** 5–7 дней  
(A5 остаток + A6 + A7 + A8 + A9)

---

## Рекомендации

1. **Приоритет:** Завершить A5 (BUG-15) — modal isolation критична для UX
2. **Тестирование:** Написать browser tests для BUG-01/02/03/11 с реальным DOM
3. **Артефакт:** После завершения A6-A8 собрать dist и проверить оба таргета
4. **Продуктовые улучшения (очередь B):** Начинать только после завершения A1–A8

---

## Верификация

Для проверки исправлений:

```bash
# Базовая сборка
npm run verify

# Запустить PWA
npm run dev

# Проверить XSS (BUG-01)
# 1. Создать заметку с ссылкой: <a href="java
# script:alert('XSS')">test</a>
# 2. Publish → Copy link
# 3. Открыть в новой вкладке
# Ожидается: alert не выполняется, ссылка удалена

# Проверить ошибку сохранения (BUG-03)
# 1. DevTools → Application → IndexedDB → blackboard-text → right click → Delete
# 2. Набрать текст
# 3. Закрыть вкладку DevTools (восстановить quota)
# Ожидается: красный индикатор ошибки, текст можно экспортировать

# Проверить Undo после импорта (BUG-04)
# 1. Создать заметку "original"
# 2. Export backup
# 3. Изменить на "edited"
# 4. Import backup
# 5. Cmd+Z без новых правок
# Ожидается: остаётся "original", не возвращается "edited"

# Проверить legacy drawings (BUG-12)
# Требуется старый Chrome storage с coordinateSpace=undefined, width=4
# Миграция должна дать width ≈ 0.222

# Проверить keyboard exit (BUG-08)
# 1. Открыть редактор
# 2. Escape
# Ожидается: фокус на settings button
```
