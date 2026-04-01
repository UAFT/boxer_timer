# Boxer Timer v2 — offline boxed app starter

Это не web-runtime проект.
Это локальный таймер под Android shell:

- логика локальная;
- звуки локальные;
- API нет;
- сеть в runtime не требуется;
- production-контур = `dist/` -> `webDir` -> `android/`.

## Источник истины

- `app/` — живые web sources
- `dist/` — generated build output
- `android/` — native shell, создаётся только через Capacitor CLI

## Быстрый старт

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

## Аудио-контракт

### Countdown
- `app/assets/audio/countdown/count_3.mp3`
- `app/assets/audio/countdown/count_2.mp3`
- `app/assets/audio/countdown/count_1.mp3`

### Cue
- `app/assets/audio/cues/cue_round_start_single.mp3`
- `app/assets/audio/cues/cue_round_end_single.mp3`
- `app/assets/audio/cues/cue_rest_end_double.mp3`
- `app/assets/audio/cues/cue_warning_10s.mp3`
- `app/assets/audio/cues/cue_workout_end_long.mp3`

Countdown и cue всегда разделены.
`3,2,1` — это не часть финального сигнала.
Сигнал на нуле — отдельное событие.

## Следующий рабочий шаг

1. Подменить placeholder audio на реальные файлы.
2. Прогнать локально в браузере.
3. Сгенерировать Android shell.
4. После этого уже править контент/звук, а не архитектуру.
