/** Studio Slate accessible in-app language menu; native <select> remains the
 * existing persistence / translation contract, never triggers Android picker. */
export function installCustomLanguageSelect(select, root = document) {
  if (!select) return () => {};
  const trigger = root.getElementById('ftLanguageTrigger');
  const menu = root.getElementById('ftLanguageList');
  const selected = root.getElementById('ftLanguageSelected');
  if (!trigger || !menu || !selected) return () => {};
  const options = Array.from(menu.querySelectorAll('[data-ft-lang]'));
  const byValue = value => options.find(option => option.dataset.ftLang === value);
  const sync = () => {
    const current = byValue(select.value) || options[0];
    if (!current) return;
    selected.textContent = current.textContent;
    for (const option of options) option.setAttribute('aria-selected', String(option === current));
  };
  const close = (restoreFocus = false) => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  };
  const open = (focus = false) => {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (focus) (byValue(select.value) || options[0])?.focus();
  };
  const choose = value => {
    if (!byValue(value)) return;
    select.value = value;
    select.dispatchEvent(new Event('change', {bubbles:true}));
    sync();
    close(true);
  };
  trigger.addEventListener('click', () => menu.hidden ? open() : close());
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown','ArrowUp','Enter',' '].includes(event.key)) {
      event.preventDefault();
      open(true);
    } else if (event.key === 'Escape') close();
  });
  options.forEach((option, index) => {
    option.addEventListener('click', () => choose(option.dataset.ftLang));
    option.addEventListener('keydown', event => {
      if (event.key === 'Escape') {event.preventDefault();close(true);}
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        options[(index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length].focus();
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();options[event.key === 'Home' ? 0 : options.length - 1].focus();
      }
    });
  });
  root.addEventListener('pointerdown', event => {
    if (!menu.hidden && !root.getElementById('ftLanguagePicker')?.contains(event.target)) close();
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) close(true);
  });
  select.addEventListener('change', sync);
  sync();
  return { sync, close, open };
}
