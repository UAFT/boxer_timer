# Fight Tech Interval Timer — owner map (refactor V1)

## Runtime contract
Offline-first Capacitor app. No server-side backend or database is required.
One application entry: `app/js/app.js`. All business features belong to owners.
No change to storage keys, installed user data, program semantics or timer presets in this refactor.

| Owner | Path | Contract |
|---|---|---|
| App composition | app/js/app.js | Wire owners, no workout data or program editor DOM |
| Timer engine | app/js/timer/timer-engine.js | Time/phase transitions, event emission; no UI or storage |
| Timer scheduling | app/js/core/schedule.js | Pure work/rest/round calculations |
| Audio | app/js/audio/ | Gong, warning cues and metronome |
| Preset storage | app/js/state/ | Persistent settings and presets |
| Legacy program owner | app/js/program/legacy-program-controller.js | Existing editor, saved stages, compilation, run/exit |
| Legacy program compiler | app/js/core/program.js | Pure normalization and round compilation |
| Workout catalog | app/js/library/catalog.js | Built-in programs and protocol step definitions |
| Workout library UI/runtime | app/js/library/library-ui.js | Library selection, composer, view and temporary playback; **needs further runtime extraction** |
| UI components | app/js/ui/ | DOM references, rendering, bindings |
| Styles | app/styles/components/*.css | Ordered, separated stylesheets; CSS order preserved |

## Refactor gate / follow-up
- This is an incremental structural split, **not** a claim of completed runtime consolidation.
- Current library still has its own playback clock and persistence keys. A single timer authority is required before adding advanced workouts or methodology.
- Library dialog and existing editor coexist; integration needs on-device visual acceptance.
- Do not add new features to `app.js` or `library-ui.js` until their owners are separated further.
- No new backend. Preserve offline and existing saved user data.
- Baseline: Git branch feat/workout-library-v1. Working branch refactor/owner-modules-v1.
- Rollback: revert refactor commit or restore /home/uaft/_backups/andar-fight-timer/ARCH_OWNER_SPLIT_20261020/before.tgz.
- Acceptance: tests + build + Android visual smoke + timer/gong/legacy program/library composition tests.
