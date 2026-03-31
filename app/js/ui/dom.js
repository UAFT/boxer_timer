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
    audioStatusBadge: document.getElementById('audioStatusBadge'),
    debugBox: document.getElementById('debugBox'),

    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resetBtn: document.getElementById('resetBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),

    settingsPanel: document.getElementById('settingsPanel'),
    roundsInput: document.getElementById('roundsInput'),
    workSecInput: document.getElementById('workSecInput'),
    restSecInput: document.getElementById('restSecInput'),
    countdownEnabledInput: document.getElementById('countdownEnabledInput'),
    warning10EnabledInput: document.getElementById('warning10EnabledInput'),
    audioEnabledInput: document.getElementById('audioEnabledInput'),

    presetTabs: [...document.querySelectorAll('.preset-tab')]
  };
}
