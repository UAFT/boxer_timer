// Fight Tech choice dialog: the in-app list that replaces a native <select> (no Android radio sheet).
// One list at a time. ×, Back (platform/back-button.js), Escape or a tap outside close it without choosing;
// focus returns to the control that opened it. Texts carry both languages (data-ft-ru/en, see i18n/locale.js).
const lang = doc => doc.documentElement.lang === 'en' ? 'en' : 'ru';
let seq = 0;
// An element whose text is given in both languages; the locale observer keeps it in the current one.
export function bilingual(doc, tag, className, ru, en = ru) {
  const e = doc.createElement(tag);
  if (className) e.className = className;
  e.dataset.ftRu = ru; e.dataset.ftEn = en;
  e.textContent = lang(doc) === 'en' ? en : ru;
  return e;
}

// options: [{value, ru, en}]; title: {ru, en}. onChoose(value) runs after the list has closed.
export function openChoiceDialog(doc, { title, options, value, onChoose, opener = null }) {
  doc.getElementById('ftChoiceDialog')?.remove();
  const back = doc.createElement('div'); back.id = 'ftChoiceDialog'; back.className = 'ft-choice-backdrop';
  const box = doc.createElement('div'); box.className = 'ft-choice-dialog';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'ftChoiceTitle');
  const head = doc.createElement('div'); head.className = 'ft-choice-head';
  const h = bilingual(doc, 'h3', 'ft-choice-title', title.ru, title.en); h.id = 'ftChoiceTitle';
  const x = doc.createElement('button'); x.type = 'button'; x.id = 'ftChoiceDialogClose'; x.className = 'ft-choice-close';
  x.setAttribute('aria-label', 'Закрыть'); x.textContent = '×';
  head.append(h, x);
  const list = doc.createElement('div'); list.className = 'ft-choice-list'; list.setAttribute('role', 'listbox'); list.setAttribute('aria-labelledby', 'ftChoiceTitle');
  const close = () => { back.remove(); opener?.focus(); };
  const items = options.map(o => {
    const b = bilingual(doc, 'button', 'ft-choice-option', o.ru, o.en);
    b.type = 'button'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(o.value === value)); b.dataset.value = o.value;
    b.addEventListener('click', () => { close(); onChoose?.(o.value); });
    return b;
  });
  list.append(...items);
  box.append(head, list); back.append(box);
  x.addEventListener('click', close);
  back.addEventListener('click', e => { if (e.target === back) close(); });
  back.addEventListener('keydown', e => {
    const focusable = [x, ...items], i = focusable.indexOf(doc.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const j = items.indexOf(doc.activeElement), n = items.length; items[e.key === 'ArrowDown' ? (j + 1) % n : (j <= 0 ? n - 1 : j - 1)]?.focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); items[e.key === 'Home' ? 0 : items.length - 1]?.focus(); }
    // Focus stays inside the dialog while it is open.
    else if (e.key === 'Tab') { e.preventDefault(); focusable[(i + (e.shiftKey ? focusable.length - 1 : 1)) % focusable.length].focus(); }
  });
  doc.body.append(back);
  const selected = items.find(b => b.getAttribute('aria-selected') === 'true') || items[0];
  selected?.scrollIntoView?.({ block: 'nearest' });
  (selected || x).focus();
  return { close, element: back };
}

// A dropdown control: shows the chosen option and opens the choice dialog. label: {ru, en} (dialog title and accessible name).
export function choiceField(doc, { label, options, value, onChange, labelledBy = null }) {
  const btn = doc.createElement('button'); btn.type = 'button'; btn.className = 'ft-choice-trigger'; btn.setAttribute('aria-haspopup', 'dialog');
  const val = doc.createElement('span'); val.className = 'ft-choice-value'; val.id = 'ftChoiceValue' + (++seq);
  const chevron = doc.createElement('span'); chevron.className = 'ft-choice-chevron'; chevron.setAttribute('aria-hidden', 'true');
  btn.append(val, chevron);
  if (labelledBy) btn.setAttribute('aria-labelledby', labelledBy + ' ' + val.id);
  let opts = options, current = value;
  const show = () => {
    const o = opts.find(c => c.value === current) || opts[0];
    current = o?.value;
    val.dataset.ftRu = o?.ru ?? ''; val.dataset.ftEn = o?.en ?? o?.ru ?? '';
    val.textContent = lang(doc) === 'en' ? val.dataset.ftEn : val.dataset.ftRu;
  };
  btn.addEventListener('click', () => openChoiceDialog(doc, { title: label, options: opts, value: current, opener: btn,
    onChoose: v => { if (v === current) return; current = v; show(); onChange?.(v); } }));
  show();
  return { el: btn, get value() { return current; }, set(nextOptions, nextValue) { opts = nextOptions; current = nextValue; show(); } };
}
