V26 METRONOME AND TRANSITION FIX
- rest-end-zero now routes to round-start single cue
- round-end-zero stays on rest-start double cue
- metronome runs only in WORK, never in REST
- pause now explicitly stops metronome before timer pause
- subdivided metronome now uses a real upbeat runtime sample extracted from the second hit of metronome_split.wav
- metronome/transition/countdown gains slightly increased for audibility
- storage key bumped to v7 to avoid stale settings contamination
