# Fight Tech workout exchange v1

- File extension: `.ftworkout` (UTF-8 JSON; no executable instructions).
- File fields: `{ format:'fighttech.workout', version:1, name, entries, options }`.
- Program entries include preset ID, title, round names/descriptions, stage timing/settings, rest after stage. Program options include cycles and rest between cycles.
- Export resolves legacy `null` stage settings using the sender's current preset profile, without changing the saved source program.
- Native export: Capacitor Filesystem (cache file, base64 UTF-8) + Share files intent. Android share target is selected by user (e.g., Telegram). No account, web API, cloud storage, or internet is required within Fight Tech.
- Web export: Web Share file if available, otherwise browser download.
- Import: Android system file picker through HTML `type=file`; accepts any MIME to allow unknown `.ftworkout` types from Downloads. Parser validates format, version and constraints before a preview is shown.
- The user explicitly confirms import. Saved program is added as a new independent copy with a fresh ID. Existing saved programs, active playback, and editable drafts are not replaced. Storage is written before in-memory list is updated.
- Limits: max 128 KiB; up to 24 stages; up to 200 names/descriptions per stage; at most 10,000 generated rounds including cycles; up to 100 saved programs. Future versions are rejected.
- No deep links from Telegram in v1. Open Fight Tech -> My Programs -> Import -> Downloads. Direct file association is a separate future feature.
- JS modules: `app/js/sharing/workout-file.js`, `file-transfer.js`, `workout-exchange-ui.js`; UI styles in `app/styles/workout-exchange.css`. This feature does not modify timer engine.
- Native dependencies: `@capacitor/filesystem@7.1.9`, `@capacitor/share@7.0.4`; Android signed workflow regenerates native project and registers both plugins during `cap sync android`.
- Must verify file chooser/share intent on a real Android device after installation. Unit and Chromium tests do not prove Telegram receiver interoperability.
