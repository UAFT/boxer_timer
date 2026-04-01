BOXER_TIMER_AUDIO_UNLOCK_AND_SETTINGS_CANON_V1

Changes in this patch:
- START button now performs audio unlock for the session.
- Settings screen rebuilt in timer visual style.
- Removed duplicate settings for rounds/work/rest/metronome from modal.
- Added warning selection: off / 3 / 5 / 10 sec.
- Added cue variant selection for work start, rest start, and workout end.
- Bundled uploaded local WAV assets into app/assets/audio.
- Metronome now uses bundled sample WAV files instead of generated oscillator beeps.

Known intentional behavior:
- Countdown uses the provided combined 3-2-1 WAV clip.
- The uploaded start_cue_3_2_1.wav is used as one combined countdown asset.
