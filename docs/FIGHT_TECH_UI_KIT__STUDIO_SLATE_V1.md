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
