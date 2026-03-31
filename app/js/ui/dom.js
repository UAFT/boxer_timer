export function getDomRefs() {
  return {
    mainTime: document.getElementById('mainTime'),
    phaseLabel: document.getElementById('phaseLabel'),
    roundLabel: document.getElementById('roundLabel'),
    phaseCaption: document.getElementById('phaseCaption'),
    countdownCaption: document.getElementById('countdownCaption'),
    progressFill: document.getElementById('progressFill'),
    metricWork: document.getElementById('metricWork'),
    metricRest: document.getElementById('metricRest'),
    metricRounds: document.getElementById('metricRounds'),
    metricTotal: document.getElementById('metricTotal'),
    metricRemaining: document.getElementById('metricRemaining'),
    metricMetronome: document.getElementById('metricMetronome'),
    metronomeStatus: document.getElementById('metronomeStatus'),

    startBtn: document.getElementById('startBtn'),
    resetBtn: document.getElementById('resetBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),

    settingsModal: document.getElementById('settingsModal'),
    roundsInput: document.getElementById('roundsInput'),
    workSecInput: document.getElementById('workSecInput'),
    restSecInput: document.getElementById('restSecInput'),
    countdownEnabledInput: document.getElementById('countdownEnabledInput'),
    warning10EnabledInput: document.getElementById('warning10EnabledInput'),
    audioEnabledInput: document.getElementById('audioEnabledInput'),
    metronomeEnabledInput: document.getElementById('metronomeEnabledInput'),
    metronomeBpmInput: document.getElementById('metronomeBpmInput'),

    presetTabs: [...document.querySelectorAll('.preset-tab')],
    stepperButtons: [...document.querySelectorAll('.stepper-btn')]
  };
}
