BOXER TIMER V20

Audio contract fixed to user-specified sequence:
- Prestart before first round: start_cue_3_2_1.wav
- First round start at 02:59: start_workout_cue_2.wav
- Work warning: countdown_3/5/10.wav (settings-driven)
- Round end / rest start at 01:00: start_rest_cue_2.wav
- Rest final 3 sec: start_cue_3_2_1.wav
- Rest end / next round start: start_rest_cue_2.wav
- Final workout end: end_workout_cue_2.wav

Additional fixes:
- settings storage bumped to v5 to avoid stale old cue selections
- preset defaults switched to v2 for start/rest/end cues
- phase captions fixed to use warningSeconds instead of countdownEnabled in timer engine
