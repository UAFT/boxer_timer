export const AUDIO_FILE_MAP = {
  cue_countdown_321: './assets/audio/countdown/start_cue_3_2_1.wav',
  cue_warning_tick: './assets/audio/cues/warning_tick_runtime.wav',
  cue_round_start_v1: './assets/audio/cues/start_workout_cue.wav',
  cue_round_start_v2: './assets/audio/cues/start_workout_cue_2.wav',
  cue_rest_start_v1: './assets/audio/cues/start_rest_cue.wav',
  cue_rest_start_v2: './assets/audio/cues/start_rest_cue_2.wav',
  cue_workout_end_v1: './assets/audio/cues/end_workout_cue.wav',
  cue_workout_end_v2: './assets/audio/cues/end_workout_cue_2.wav',
  metronome_direct: './assets/audio/metronome/metronome_single_runtime.wav',
  metronome_subdivided: './assets/audio/metronome/metronome_split_upbeat_runtime.wav'
};

export const CUE_VARIANT_OPTIONS = {
  workStartCueVariant: [
    { value: 'v1', label: 'Вариант 1' },
    { value: 'v2', label: 'Вариант 2' }
  ],
  restStartCueVariant: [
    { value: 'v1', label: 'Вариант 1' },
    { value: 'v2', label: 'Вариант 2' }
  ],
  workoutEndCueVariant: [
    { value: 'v1', label: 'Вариант 1' },
    { value: 'v2', label: 'Вариант 2' }
  ]
};
