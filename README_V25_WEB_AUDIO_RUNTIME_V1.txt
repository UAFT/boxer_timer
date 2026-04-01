BOXER_TIMER_WEB_AUDIO_RUNTIME_V1

Сделано:
- HTMLAudio/cloneNode удалён из runtime-cue слоя.
- Введён единый AudioContext + AudioBuffer runtime.
- Все cue и метроном играются через AudioBufferSourceNode.
- START разблокирует AudioContext.
- pause/reset мгновенно режут активные source nodes.
- transition cue, warning и metronome разведены по tag-каналам.

Изменённые файлы:
- app/js/audio/audio-engine.js
- app/js/audio/metronome-engine.js
- app/js/audio/catalog.js
- app/js/app.js
