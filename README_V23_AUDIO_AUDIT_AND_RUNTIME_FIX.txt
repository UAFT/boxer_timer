BOXER_TIMER_AUDIO_AUDIT_AND_RUNTIME_FIX_V23

Что подтверждено:
1. start_workout_cue_2.wav, start_rest_cue_2.wav, end_workout_cue_2.wav в пакете совпадают с пользовательскими файлами по SHA256.
2. Реальный источник проблем был в runtime:
   - warning_tick_runtime раньше был неверно собран и маскировал переходные cue;
   - metronome_single.wav и metronome_split.wav использовались как runtime-сэмплы почти полной секундной длины,
     из-за чего дробный метроном и переходные сигналы перекрывались.

Что изменено:
- исходные пользовательские файлы сохранены;
- добавлены runtime-версии:
  - metronome_single_runtime.wav
  - metronome_split_runtime.wav
  - warning_tick_runtime.wav
- metronome-engine переведён на runtime-файлы;
- добавлено suppressFor() для краткого подавления метронома вокруг transition cue;
- start/rest/workout cue не заменялись и остаются пользовательскими файлами.
