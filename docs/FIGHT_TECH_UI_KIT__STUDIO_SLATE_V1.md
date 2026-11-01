# Fight Tech • Studio Slate UI Kit v1.0

Status: implemented as reversible presentation layer, pending owner phone validation.

## Reference
Owner approved five-column LIGHT SILVER/SILVER-GREY screenshot. NOT dark graphite. Same layout, buttons, phases, programs and timer controls. One stylesheet app/styles/fight-tech-ui-kit.css loaded last; no timer logic changes.

## Color tokens
| Role | Token | Value |
|---|---|---|
| Page | ft-bg | #E9EDF0 |
| Surface | ft-surface | #F9FAFB |
| Card | ft-card | #EFF2F5 |
| Raised buttons | ft-raised | #F4F6F8 |
| Thin border | ft-line | #D0D7DC |
| Main text | ft-ink | #1B2229 |
| Muted text | ft-secondary | #687580 |
| Active / Start / metronome | ft-steel-gradient | 145deg #688B89 → #416E6C → #2D5353 |
| Rest status | ft-orange | #CB884E |
| Danger status | ft-red | #BB5450 |

## Scale and appearance
- Font: Inter when available on device; system-ui / Segoe UI as no-download fallback.
- Numerals: tabular figures. Clock remains large and untouched.
- Spacing tokens: 4 / 8 / 12 / 16 / 24 px.
- Panel/card/control radii: 19 / 13 / 11 px.
- Buttons keep 44 px touch area where practical; reduce decorative padding instead of targets.
- Gradients limited to meaningful pressed/selected and work actions; other surfaces matte.
- Active/selected colors steel; rest amber; danger desaturated red.
- Icons: pencil, up, down, X, trash, import, share, save, reset are neutral controls with consistent shape. Destructive trash is muted red.

## Component scope
Actual current shell reskinned: header, 4 presets, timer, phase switch, countdown, stepper controls, metronome, program card, stages and reordering, full-screen plan, saved library, import/export, stage/round edit dialogs, confirmation, settings.

Language: single native dropdown Auto / Russian / English; persisted in existing fighttech.language.v1 storage; no three language buttons.

## Safety
Presentation only. No app.js growth, schedule engine edits, new mode, background implementation, new settings beyond language dropdown. Existing generated dist is pre-dirty: only build in isolated copy/worktree. Smoke physical owner Android before shipping additional features.

## v1.1 Owner Android corrections (2026-10-22)
- No wallpaper/render redesign. Source-level visual fixes only.
- New custom in-app language list replacing the Android native selection sheet; it keeps the existing `languageSelect` and persistent RU/EN/Auto contract, supports keyboard and closes on outside tap.
- Standard/saved/library workout cards are matte silver-gray, not steel; the category labels, plus buttons, stage header, round control and modal editors also use neutral surfaces.
- Steel-green reserved for selected tab/mode and positive/start/save primary actions.
- Program stage title/timing, edit/rename dialogs, stage +/- inputs and saved-program text all use light surface and high contrast text.
- Timer, metronome, preset ordering, plan computation, work/rest schedule not modified.

## v1.2 Choice dialog, collapsible start-from (2026-11-01)
**Rule: no native `<select>` / Android radio sheet for app choices.** Use the Fight Tech choice field + dialog
(`app/js/ui/choice-dialog.js`, CSS «Fight Tech choice field + dialog» in `fight-tech-ui-kit.css`). OS-owned pickers
(permissions, Google Play Billing, system share sheet) stay native.

| Part | Spec |
|---|---|
| Trigger `button.ft-choice-trigger` | ft-raised surface, 1 px ft-line border, radius 12, min-height 42 (48 in Settings), 13 px / 600 (16 px in Settings), ˅ chevron at the right; value wraps at spaces only, never inside a word, never clipped |
| Dialog `#ftChoiceDialog` | backdrop rgba(27,40,49,.42); card ft-surface, radius 16, width ≤ 420 px, max-height 100dvh − 48 px, list scrolls inside; title + × (44 × 44, aria-label «Закрыть») |
| Option `[role=option]` | min-height 48, 16 px / 600, multi-line; selected #dce9e6 / #244c4b, 750, ✓ |
| Behaviour | role=dialog + aria-modal, listbox/option + aria-selected; focus to the selected option (scrolled into view), ↑ ↓ Home End, Tab stays inside; ×, Escape, tap outside and Android Back (first in `back-button.js` CLOSERS) close without choosing; focus returns to the trigger |
| Texts | both languages on the element (`data-ft-ru` / `data-ft-en`), kept current by `i18n/locale.js`; user names never translated |

Used by: «Начать тренировку с» (stage, round) in the program editor, the workout plan and a diary workout; Settings
«Сигналы метронома» → «Электронные» tone. The Settings language menu is the earlier inline list of the same look
(v1.1). Remaining native selects, not migrated: the Tree «Расположение тренировки» editor (`ftEditLinks` in app.js:
Раздел / Ступень / Действие, RU-only owner tool) — migrate with this component when that screen is next touched.

**«Начать тренировку с»** (`app/js/ui/start-from.js`), one component in all three places: collapsed by default to one
row (ft-raised, min-height 40, ˅ at the right, whole row is the button). Expanded: labels «Этап | Раунд» in the same two
equal columns as the dropdowns, ˄ (44 × 36, aria-label «Свернуть») on the labels' line at the far right; two equal
full-width dropdowns, gap 8; then the outlined action (#1f5a45 outline and text) at the size of that screen's start
button: 37 px under «Запустить программу», 46 px in the plan and the Diary («Начать тренировку»). When a word cannot fit
beside the other dropdown (narrow screen, large font, long name) the two stack at full width with «Раунд» over the
second one. Existing buttons are never resized for it.

Checks: `tests/ui-system-audio-profiles.test.mjs` (no native select in these components, Back order, strings) and the
browser check in the project evidence (`UI_SYSTEM_AUDIO_PROFILES__20261101/browser/ui_audio.cjs`: DOM, geometry and
screenshots RU/EN × 320/360/393/412 × font 1/1.3, against 0.2.207 for the existing buttons).
