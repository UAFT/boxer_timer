BOXER_TIMER_METRONOME_STATE_FIX_V1

Изменения:
1. action-mask метронома открывается только по click, без pointerup-дубля.
2. открытие маски сразу переводит метроном в active-flow:
   - panel = expanded
   - metronomeEnabled = true
   - bpm >= 20 (если был 0)
3. power-кнопка стала честным toggle:
   - on  -> panel expanded
   - off -> panel collapsed
4. плюс/минус bpm:
   - bpm > 0 => panel expanded + metronomeEnabled=true
   - bpm = 0 => metronomeEnabled=false + panel collapsed
5. mode buttons теперь тоже держат active-flow и не гасят панель.
6. preset switching больше не управляет состоянием панели.
7. power-button исключена из stepper query, чтобы не ходить в onAdjustValue.

Файлы:
- app/js/app.js
- app/js/ui/bindings.js
- app/js/ui/dom.js
- dist/* rebuilt через scripts/build.sh
