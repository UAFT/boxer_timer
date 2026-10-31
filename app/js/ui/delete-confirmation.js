// Owner: program-deletion confirmation UI. Native confirm() is intentionally not used.
const labels = {
  ru: { title: 'Удалить программу?', message: 'Это действие нельзя отменить.', cancel: 'Отмена', delete: 'Удалить' },
  en: { title: 'Delete program?', message: 'This action cannot be undone.', cancel: 'Cancel', delete: 'Delete' }
};
export function deleteDialogLabels(language) {
  return labels[language === 'en' ? 'en' : 'ru'];
}

export function installDeleteConfirmation(doc = document) {
  const get = id => doc.getElementById(id);
  const overlay = get('programDeleteConfirmModal');
  const cancelButton = get('programDeleteConfirmCancel');
  const acceptButton = get('programDeleteConfirmAccept');
  let pending = null;

  function close(restoreFocus = true) {
    const previous = pending;
    pending = null;
    overlay.hidden = true;
    doc.removeEventListener('keydown', onKeyDown);
    if (restoreFocus && previous) {
      const target = previous.trigger?.isConnected ? previous.trigger : get('programLibraryMine');
      target?.focus();
    }
  }
  function onKeyDown(event) {
    if (!pending) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [cancelButton, acceptButton];
    const index = controls.indexOf(doc.activeElement);
    if (index < 0) {
      event.preventDefault();
      cancelButton.focus();
    } else if ((event.shiftKey && index === 0) || (!event.shiftKey && index === 1)) {
      event.preventDefault();
      controls[event.shiftKey ? 1 : 0].focus();
    }
  }
  cancelButton.addEventListener('click', () => close());
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  acceptButton.addEventListener('click', () => {
    if (!pending) return;
    const { onConfirm } = pending;
    close(false);
    onConfirm();
    get('programLibraryMine')?.focus();
  });
  // labels: optional { ru, en } overrides, e.g. the diary's «Удалить из календаря?».
  return function confirmDeletion({ name, trigger, onConfirm, labels: custom }) {
    if (pending || typeof onConfirm !== 'function') return;
    const lang = doc.documentElement.lang === 'en' ? 'en' : 'ru';
    const copy = { ...deleteDialogLabels(lang), ...custom?.[lang] };
    get('programDeleteConfirmTitle').textContent = copy.title;
    get('programDeleteConfirmMessage').textContent = copy.message;
    get('programDeleteConfirmName').textContent = name;
    cancelButton.textContent = copy.cancel;
    acceptButton.textContent = copy.delete;
    pending = { trigger, onConfirm };
    overlay.hidden = false;
    doc.addEventListener('keydown', onKeyDown);
    cancelButton.focus();
  };
}
