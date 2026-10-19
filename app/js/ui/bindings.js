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

// One tap = one step; holding repeats after a short delay. Pointer cancellation,
// release and blur always stop repetition. The subsequent click is suppressed
// only if the hold actually repeated, preventing an extra increment.
function bindRepeatButton(button, action) {
  let delay = null;
  let interval = null;
  let repeated = false;
  let pointerActive = false;
  const stop = () => {
    clearTimeout(delay);
    clearInterval(interval);
    delay = null;
    interval = null;
    pointerActive = false;
  };
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || button.disabled) return;
    stop();
    pointerActive = true;
    repeated = false;
    delay = setTimeout(() => {
      if (!pointerActive) return;
      repeated = true;
      action();
      interval = setInterval(action, 75);
    }, 420);
  });
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', () => { stop(); repeated = true; });
  button.addEventListener('pointerleave', stop);
  button.addEventListener('blur', stop);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (repeated) { event.preventDefault(); repeated = false; return; }
    action();
  });
  button.addEventListener('contextmenu', (event) => event.preventDefault());
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
    bindRepeatButton(button, () => handlers.onAdjustValue({
      target: button.dataset.adjustTarget,
      direction: button.dataset.adjustDirection
    }));
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
      els.blockSettings.hidden = value !== 'ladder';
      handlers.onPreviewChange?.();
    });
  });

  els.blockEnabledInput.addEventListener('change', () => handlers.onPreviewChange?.());
  els.blockStepButtons.forEach((button) => {
    bindRepeatButton(button, () => {
      const target = button.dataset.blockTarget;
      const input = target === 'blockCount' ? els.blockCountInput : els.blockRestSecInput;
      const step = target === 'blockCount' ? 1 : 5;
      const max = target === 'blockCount' ? 99 : 3600;
      const delta = button.dataset.blockDirection === 'down' ? -step : step;
      input.value = String(Math.max(target === 'blockCount' ? 1 : 0, Math.min(max, Number(input.value) + delta)));
      els.blockCountDisplay.textContent = els.blockCountInput.value;
      els.blockRestSecDisplay.textContent = String(Math.floor(Number(els.blockRestSecInput.value) / 60)).padStart(2,'0') + ':' + String(Number(els.blockRestSecInput.value) % 60).padStart(2,'0');
      handlers.onPreviewChange?.();
    });
  });

  els.ladderStepButtons.forEach((button) => {
    bindRepeatButton(button, () => handlers.onAdjustLadderStep({
      target: button.dataset.ladderTarget,
      direction: button.dataset.ladderDirection
    }));
  });

  (els.cueVariantButtons || []).forEach((button) => {
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
