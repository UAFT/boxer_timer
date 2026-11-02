# Fight Tech — several diaries and the diary file (2026-11-02)

## Diaries on one device
- Registry `localStorage['fighttech.diaries.v1']` = `{"active": id, "list": [{"id","name"}]}`. Missing or broken = only
  «Мой дневник» (`id: "main"`, empty name = the localized default). At most 30 diaries, names up to 60 characters,
  user names are never translated.
- Records: «Мой дневник» keeps **exactly** the files of every earlier version (`fighttech-diary-{a,b}.json` in the
  app's DATA folder; browser `fighttech.diary.v1.{a,b}`). Another diary `<id>`: `fighttech-diary-<id>-{a,b}.json`
  (browser `fighttech.diary.v1.<id>.{a,b}`). Slot `backup` = the copy kept before a file replaced the diary.
- Calendar: ⋮ (in place of «Сегодня») opens the «Дневники» dialog — list with ✓ (tap switches), Create, Send, Save to file,
  Load from file, Rename, Restore from backup (only when a backup exists), Delete (with confirmation; disabled for «Мой дневник»).
- A run is bound to its diary when it starts: from a diary appointment → that diary; the plain timer, a preset, the
  editor → «Мой дневник». Switching the active diary mid-run does not move it. Runs saved by earlier versions (no
  `diaryId`) go to «Мой дневник». A deleted diary resolves to «Мой дневник» (a record is never dropped).
- Delete: the registry forgets the diary first, then its files are removed (a failed delete leaves an orphan file,
  never a half-listed diary).

## The `.ftdiary` file (`app/js/diary/diary-file.js`)
```json
{"format":"fighttech.diary","version":1,"exportedAt":"ISO","diary":{"name":"…"},
 "sessions":[{"id","date","status","planRef","execRef?","programId","origin","createdAt","updatedAt","runId?","startedAt?","endedAt?","canceledAt?","repeatOf?","facts?":{"roundsDone","roundsTotal","activeSec","startFrom?"}}],
 "snapshots":{"<ref>":{"name","entries":[…full stages…],"options":{"cycles","cycleRestSec"}}}}
```
- Self-contained: every session with its full workout snapshot (stages, rounds, names, times, two phases, ladder,
  blocks, metronome incl. phases, cycles). No reference to the sender's library or «Мои». Only referenced snapshots are written.
- Validation on import: max 16 MB, JSON object, exact format, `version` 1 (newer → «newer version» message), dates
  `YYYY-MM-DD`, known statuses, refs must exist, unique ids, snapshots through the same checks as a `.ftworkout`
  (`checkEntries` + `normalizeProgram`); unknown fields are dropped. Our own export is parsed by the same check before it is written.
- Import = replace the **selected** diary only, after a confirmation that shows the target, the file name, the diary
  name in the file, the workout count and the date range. Order: write `backup` slot → one store commit (new slot,
  old one untouched). No backup → no replacement; a failed commit → «Ничего не изменено». Restore = the same
  replacement from the backup.
- Send = Android Sharesheet (Capacitor Share, cache file). Save = `Documents/Fight Tech/<name>.ftdiary` (Capacitor
  Filesystem DOCUMENTS); in a browser both download. A `.ftworkout` import stays additive («Мои»), never touches a diary.

## Migration
Nothing is rewritten on update: no registry = «Мой дневник» only, reading the same files as 0.2.208. Stages saved
before keep their metronome (no `phases` = both phases sound) and their tempo; 10 BPM applies only to a new value.
