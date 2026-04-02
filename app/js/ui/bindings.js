function activateChoice(buttons, matcher) {
  buttons.forEach((button) => {
    const isActive = matcher(button);
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

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

  els.warningChoiceButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.warningSeconds ?? '0';
      els.warningSecondsInput.value = value;
      activateChoice(els.warningChoiceButtons, (candidate) => candidate.dataset.warningSeconds === value);
    });
  });

  els.intervalModeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.intervalMode ?? 'standard';
      els.intervalModeInput.value = value;
      activateChoice(els.intervalModeButtons, (candidate) => candidate.dataset.intervalMode === value);
    });
  });

  els.ladderStepButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      handlers.onAdjustLadderStep({
        target: button.dataset.ladderTarget,
        direction: button.dataset.ladderDirection
      }, event);
    });
  });

  els.cueVariantButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.cueTarget;
      const value = button.dataset.cueValue;
      const input = els[`${target}Input`];
      if (!input || !value) return;
      input.value = value;
      activateChoice(
        els.cueVariantButtons.filter((candidate) => candidate.dataset.cueTarget === target),
        (candidate) => candidate.dataset.cueValue === value
      );
    });
  });

  els.settingsModal.addEventListener('click', (event) => {
    if (event.target === els.settingsModal) {
      handlers.onCloseSettings();
    }
  });
}
