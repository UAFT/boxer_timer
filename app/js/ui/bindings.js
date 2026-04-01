export function bindPresetTabs(els, onSelectPreset) {
  els.presetTabs.forEach((button) => {
    button.addEventListener('click', () => {
      onSelectPreset(button.dataset.preset);
    });
  });
}

export function bindControls(els, handlers) {
  els.startBtn.addEventListener('click', handlers.onToggleRun);
  els.resetBtn.addEventListener('click', handlers.onReset);
  els.settingsBtn.addEventListener('click', handlers.onOpenSettings);
  els.closeSettingsBtn.addEventListener('click', handlers.onCloseSettings);
  els.saveSettingsBtn.addEventListener('click', handlers.onSaveSettings);
  els.metronomeToggleBtn.addEventListener('click', handlers.onToggleMetronome);
  els.metronomeCardToggleBtn.addEventListener('click', handlers.onOpenMetronomeCard);

  els.metronomeModeButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      handlers.onSelectMetronomeMode(button.dataset.metronomeMode);
    });
  });

  els.stepperButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      handlers.onAdjustValue({
        target: button.dataset.adjustTarget,
        direction: button.dataset.adjustDirection
      }, event);
    });
  });

  els.settingsModal.addEventListener('click', (event) => {
    if (event.target === els.settingsModal) {
      handlers.onCloseSettings();
    }
  });
}
