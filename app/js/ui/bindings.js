export function bindPresetTabs(els, onSelectPreset) {
  els.presetTabs.forEach((button) => {
    button.addEventListener('click', () => {
      onSelectPreset(button.dataset.preset);
    });
  });
}

export function bindControls(els, handlers) {
  els.startBtn.addEventListener('click', handlers.onStart);
  els.pauseBtn.addEventListener('click', handlers.onPause);
  els.resetBtn.addEventListener('click', handlers.onReset);
  els.settingsBtn.addEventListener('click', handlers.onOpenSettings);
  els.closeSettingsBtn.addEventListener('click', handlers.onCloseSettings);
  els.saveSettingsBtn.addEventListener('click', handlers.onSaveSettings);
}
