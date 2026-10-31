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

  // dismissed: closed without an answer (Back, outside tap, Esc, ×). Only the dialog's own cancel button means «no».
  function close(restoreFocus = true, accepted = false, dismissed = false) {
    const previous = pending;
    pending = null;
    overlay.hidden = true;
    if (!accepted) (dismissed && previous?.onDismiss ? previous.onDismiss : previous?.onCancel)?.();
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
      close(true, false, true);
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
  get('programDeleteConfirmDismiss')?.addEventListener('click', () => close(true, false, true));
  overlay.addEventListener('click', event => { if (event.target === overlay) close(true, false, true); });
  acceptButton.addEventListener('click', () => {
    if (!pending) return;
    const { onConfirm } = pending;
    close(false, true);
    onConfirm();
    get('programLibraryMine')?.focus();
  });
  // labels: optional { ru, en } overrides, e.g. the diary's «Удалить из календаря?».
  // tone 'neutral': the same dialog for a non-destructive question (diary «Записать тренировку?»).
  // onDismiss: closed without an answer; without it, dismissing counts as cancel. Returns false when another question is open.
  return function confirmDeletion({ name, trigger, onConfirm, onCancel, onDismiss, labels: custom, tone }) {
    if (pending || typeof onConfirm !== 'function') return false;
    const lang = doc.documentElement.lang === 'en' ? 'en' : 'ru';
    const copy = { ...deleteDialogLabels(lang), ...custom?.[lang] };
    get('programDeleteConfirmTitle').textContent = copy.title;
    get('programDeleteConfirmMessage').textContent = copy.message;
    get('programDeleteConfirmName').textContent = name;
    cancelButton.textContent = copy.cancel;
    acceptButton.textContent = copy.delete;
    overlay.classList?.toggle('is-neutral', tone === 'neutral');
    pending = { trigger, onConfirm, onCancel, onDismiss };
    overlay.hidden = false;
    doc.addEventListener('keydown', onKeyDown);
    cancelButton.focus();
    return true;
  };
}
