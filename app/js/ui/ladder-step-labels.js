// UI-only names. Ladder mechanics, saved config and timing remain unchanged.
export function syncLadderStepLabels(root,{intervalMode,ladderEnabled}={}) {
  const twoPhaseLadder=intervalMode==='two_phase'&&Boolean(ladderEnabled);
  const name=twoPhaseLadder?'Шаг фазы 1 по раундам':'Шаг работы по раундам';
  const label=root.getElementById('workStepSecLabel');
  const control=root.getElementById('workStepSecControl');
  if(label) label.textContent=name;
  if(control) control.setAttribute('aria-label',name);
  const note=root.getElementById('workStepSecNote');
  if(note) note.textContent=twoPhaseLadder
    ? 'Отрицательный шаг сокращает фазу 1 в каждом следующем раунде, положительный — удлиняет. Изменение по 5 секунд.'
    : 'Отрицательный шаг сокращает каждый следующий раунд, положительный — удлиняет. Изменение по 5 секунд.';
  return name;
}
