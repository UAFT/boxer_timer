// The ordered program entries are the only authority for preset badges.
// Never keep a second mutable copy of the order in button state.
export function presetOrderPositions(entries, presetId) {
  return entries.flatMap((entry, index) => entry.presetId === presetId ? [index + 1] : []);
}

export function renderPresetOrders(tabs, entries, doc = document) {
  for (const tab of tabs) {
    const positions = presetOrderPositions(entries, tab.dataset.preset);
    tab.classList.toggle('has-program', positions.length > 0);
    let badges = tab.querySelector('.preset-order');
    if (!badges) {
      badges = doc.createElement('span');
      badges.className = 'preset-order';
      tab.append(badges);
    }
    const children = positions.map(position => {
      const badge = doc.createElement('b');
      badge.textContent = String(position);
      return badge;
    });
    badges.replaceChildren(...children);
    badges.setAttribute('aria-label', positions.length ? 'Позиции в программе: ' + positions.join(', ') : '');
  }
}
