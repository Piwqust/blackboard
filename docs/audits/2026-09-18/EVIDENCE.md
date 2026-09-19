# Доказательства и воспроизведение

Этот каталог сопровождает [REPORT.md](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/REPORT.md) и [PLAN.md](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/PLAN.md). Все примеры используют синтетические записи. Ни один файл здесь не является экспортом личных заметок пользователя.

## Качество подтверждений

- Данные в файлах *-reproduction.json перенесены из возвращённых инструментами результатов в этой сессии. Это протокол наблюдений, не автоматически повторно исполненный тест.
- core-probes.json получен запуском локального Node-скрипта с fake-indexeddb и моделью таймеров. Семь проверок, шесть демонстрируют дефект, одна подтверждает корректное исправление дубликатов ID. Код завершает сбор диагностик с exit 0; pass:false означает найденное нарушение, а не успешный тест продукта.
- Два независимых разбора интерфейса использовали разные браузерные профили. Их совпавшие наблюдения объединены в итоговые BUG, а не посчитаны дважды.
- Скриншоты сняты, но не просмотрены моделью: инструмент изображения недоступен. Интерфейсные дефекты подтверждены геометрией, hit-test, клавиатурой, accessibility tree, стилями и в отдельных случаях вычислением контраста по пикселям.
- Все видеозаписи в этом каталоге отмечены автором проверки как действительные воспроизведения. Неудачные промежуточные записи из временного каталога сюда не копировались.

## Указатель

| Дефект | Основное доказательство | Дополнительное |
| --- | --- | --- |
| BUG-01, BUG-02 | [security-reproduction.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/security-reproduction.json) | [security-network.log](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/security-network.log) |
| BUG-03, BUG-04, BUG-05, BUG-11 | [storage-reproduction.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/storage-reproduction.json) | [autosave-failure.png](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/autosave-failure.png), [import-undo.png](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/import-undo.png) |
| BUG-06, BUG-07 | [settings-reproduction.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/settings-reproduction.json) | UI-значения сопоставлены с сохранёнными settings. |
| BUG-08 | [keyboard-exit.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/keyboard-exit.json) | Родительская независимая проверка дала тот же результат. |
| BUG-09 | [readonly.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/readonly.json) | Передача права записи проверена отдельно и работает. |
| BUG-10 | [reader-alignment.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/reader-alignment.json) | [drawing-alignment-desktop.png](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/drawing-alignment-desktop.png), [drawing-alignment-mobile.png](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/drawing-alignment-mobile.png) |
| BUG-12 | [legacy-migration.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/legacy-migration.json) | [core-probes.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/core-probes.json); screenshot миграции не сохранился и не используется. |
| BUG-13, BUG-21, BUG-22 | [core-probes.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/core-probes.json) | [baseline.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/baseline.json) |
| BUG-14 | [scroll-reproduction.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/scroll-reproduction.json) | DOM-scroll плюс нажатия настоящих вкладок. |
| BUG-15 | [modal-focus.webm](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/modal-focus.webm), [modal-layering.webm](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/modal-layering.webm) | [modal-hit-tests.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/modal-hit-tests.json), [modal-background-edited.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/modal-background-edited.json), [modal-before.png](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/modal-before.png), [modal-after.png](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/modal-after.png) |
| BUG-16 | [toolbar-overlap-1440.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/toolbar-overlap-1440.json), [toolbar-overlap-1280.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/toolbar-overlap-1280.json) | [toolbar-overlap-1440.png](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/toolbar-overlap-1440.png), [toolbar-overlap-1280.png](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/toolbar-overlap-1280.png) |
| BUG-17 | [reader-overflow.webm](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/reader-overflow.webm), [reader-overflow.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/reader-overflow.json) | [reader-fit.png](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/reader-fit.png), [reader-scrolled-out.png](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/reader-scrolled-out.png) |
| BUG-18 | [color-picker-accessibility.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/color-picker-accessibility.json) | Реальный accessibility tree, не вывод только из HTML. |
| BUG-19 | [focus-contrast.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/focus-contrast.json), [slider-focus.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/slider-focus.json) | Контраст и сравнение области слайдера. |
| BUG-20 | [text-contrast-pixels.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/text-contrast-pixels.json) | [settings-contrast.png](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/settings-contrast.png), [settings-paper.png](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/settings-paper.png) |

## Сборка, проверки и сохранность исходников

- [checks.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/checks.json): результаты штатных проверок, офлайн, расширения и тестового обновления.
- [npm-audit.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/npm-audit.json): сведения npm об известных уязвимостях зависимостей.
- [live-static-check.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/live-static-check.json): побайтовое соответствие опубликованных reader/editor/sanitizer локальным исходникам. pwa-sw.js отличается ожидаемо: это шаблон в исходниках и сгенерированный файл на сайте.
- [baseline.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/baseline.json) и [source-manifest.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/source-manifest.json): commit, начальное состояние Git и хеши 61 исходного файла.
- [preservation.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/preservation.json): заключительное сравнение исходных файлов.
- [graph-diagnostics.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/graph-diagnostics.json): ограничения графа связей, не список багов приложения.
- [impeccable-cli.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/impeccable-cli.json), [detector-false-positives.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/detector-false-positives.json), [overlay-limit.json](/Users/dameer/Desktop/code/blackboard-text/docs/audits/2026-09-18/evidence/overlay-limit.json): сырой скан, разбор ложных срабатываний и отказ live-overlay.

## Повторить диагностику чистых модулей

Открыть терминал проекта Blackboard Text и выполнить:

    cd /Users/dameer/Desktop/code/blackboard-text
    node docs/audits/2026-09-18/probes/core-probes.mjs

Скрипт читает исходные модули и использует только fake-indexeddb в памяти; данные браузера не изменяет. Требуется уже установленная dev-зависимость fake-indexeddb. Результат нового запуска появляется рядом со скриптом в probes/core-probes.json. Зафиксированный результат аудита находится в evidence/core-probes.json и не перезаписывается.

Для браузерных багов следовать шагам соответствующего BUG из отчёта в новом тестовом профиле. **Импорт заменяет рабочую область выбранного профиля**, поэтому не использовать профиль с личными заметками. Для quota/update-проб требуется искусственный отказ IndexedDB; это диагностический режим, не инструкция изменять установленное приложение.

## Временные материалы

Полные исходные отчёты двух разборов, дополнительные снимки и файлы браузерных тестов оставлены в /Users/dameer/Desktop/code/blackboard-text/.tmp/audit-2026-09-18. Они не нужны для чтения итогового отчёта. В этот каталог перенесены только выбранные доказательства, без браузерных профилей, npm-кешей или личных данных.
