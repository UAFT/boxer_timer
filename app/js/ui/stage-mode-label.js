// A single presentation vocabulary for stage preset MODE, separate from
// owner-defined stage TITLE. Never infer the mode from the stage name.
export function stageModeLabel(source = {}) {
  if (source.intervalMode === 'count_up') return 'Таймер';
  if (source.presetId === 'tabata2020x24') return 'Скоростной';
  if (source.intervalMode === 'two_phase')
    return source.ladderEnabled ? 'Две фазы + Лестница' : 'Две фазы';
  if (source.intervalMode === 'ladder') return 'Лестница';
  return 'Обычный';
}
