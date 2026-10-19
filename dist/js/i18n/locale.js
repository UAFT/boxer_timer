export const LANGUAGE_KEY = 'fighttech.language.v1';
export function resolveLanguage(preference, device) {
  return preference === 'ru' || preference === 'en' ? preference : /^ru\b|^ru-/i.test(device) ? 'ru' : 'en';
}
const pairs = [
['ПЛАН ТРЕНИРОВКИ','WORKOUT PLAN'],['План тренировки','Workout Plan'],['Мои программы','My Programs'],['Готовые','Templates'],['Открыть','Open'],['Сохранить программу','Save program'],['Сохранить изменения','Save changes'],['Сохранить как новую','Save as new'],['Название программы','Program name'],['Название этапа','Stage name'],['Удалить программу','Delete program'],['Циклы программы','Program cycles'],['Отдых между циклами','Rest between cycles'],['Цикл','Cycle'],['Таймер спортсмена','Training Timer'],['Настройки','Settings'],['Пресеты таймера','Timer presets'],
['Готово','Finished'],['Готов','Ready'],['Работа','Work'],['Отдых','Rest'],['Отсчёт','Countdown'],['Пауза','Pause'],
['Вся программа','Full program'],['Текущий раунд','Current round'],['Программа готова','Program ready'],['Всего','Total'],['Осталось','Remaining'],['Старт','Start'],['Продолжить','Resume'],['Сброс','Reset'],
['Длина раунда','Round duration'],['Время отдыха','Rest duration'],['Раунды','Rounds'],
['Метроном','Metronome'],['Прямой','Straight'],['Дробный','Subdivision'],['уд/мин','BPM'],
['Вкл','On'],['Выкл','Off'],['Недоступно','Unavailable'],
['ЛЕСТНИЦА','LADDER'],['ПРОГРАММА','PROGRAM'],['Лестница','Ladder'],['Обычный','Standard'],
['Программа','Program'],['Этап','Stage'],['Блок','Block'],['Раунд','Round'],['отдых','rest'],
['Очистить','Clear'],['Запустить программу','Start program'],['Выйти из программы','Exit program'],
['Отдых между этапами','Rest between stages'],['Удалить этап','Remove stage'],['Поднять этап','Move stage up'],['Опустить этап','Move stage down'],
['Удерживай пресет, чтобы добавить этап. Повторное удержание добавит его ещё раз.','Press and hold a preset to add a stage. Hold it again to repeat it.'],
['Звук и сигналы','Sound and signals'],
['Работа, отдых, раунды и метроном управляются с главной панели.','Work, rest, rounds and metronome are controlled on the main screen.'],
['Закрыть','Close'],['Общее','General'],['Сигналы таймера','Timer sounds'],
['Режим интервалов','Interval mode'],['Схема','Mode'],
['Лестница: каждый следующий раунд и отдых могут становиться длиннее или короче на выбранный шаг. Количество раундов, длительность первого раунда и исходное время отдыха задаются на главном экране выбранного профиля.','Ladder: each subsequent round and rest can get longer or shorter by the chosen step. Set rounds, initial work and rest on the preset main screen.'],
['Шаг работы по раундам','Work step per round'],['Шаг отдыха по раундам','Rest step per round'],
['Отрицательный шаг сокращает каждый следующий раунд, положительный — удлиняет. Изменение по 5 секунд.','Negative steps shorten the next round; positive steps lengthen it. Adjust in 5-second increments.'],
['Отрицательный шаг сокращает отдых, положительный — удлиняет. Нулевой шаг сохраняет одинаковый отдых.','Negative steps shorten rest; positive steps lengthen it. Zero keeps rest unchanged.'],
['Лестница + Блок','Ladder + Block'],['Количество блоков','Number of blocks'],
['Отдых между блоками','Rest between blocks'],['Предупреждение до конца этапа','End-of-phase warning'],
['Нет','None'],['4 сек','4 sec'],['10 сек','10 sec'],['10 сек — метроном недоступен','10 sec — metronome unavailable'],
['Сохранить','Save'],['Предварительный просмотр','Preview'],
['Оба шага равны нулю: все раунды будут одинаковыми.','Both steps are zero: all rounds will be equal.'],
['без шага','no step'],['мин','min'],['сек','sec'],['из','of'],['блоков','blocks'],['блока','blocks'],['блок','block'],['раундов','rounds'],['раунда','rounds'],['раунд','round'],
['Скоростной','Speed'],['Язык интерфейса','Interface language'],['Развернуть лестницу','Expand ladder'],['Свернуть лестницу','Collapse ladder'],
['Увеличить длину раунда','Increase round duration'],['Уменьшить длину раунда','Decrease round duration'],
['Увеличить время отдыха','Increase rest duration'],['Уменьшить время отдыха','Decrease rest duration'],
['Увеличить количество раундов','Increase rounds'],['Уменьшить количество раундов','Decrease rounds'],
['Включить или выключить метроном','Toggle metronome'],['Управление метрономом','Metronome controls'],
['Лестница раундов','Round ladder'],['Показаны первые','Showing first'],['все раунды','all rounds'],
['Скоростной · 20/20 · 24 раунда','Speed · 20/20 · 24 rounds']
].sort((a,b)=>b[0].length-a[0].length);
export function translateText(text, lang) {
  if (lang !== 'en') return text;
  let result = text;
  for (const [ru,en] of pairs) {
    const pattern = new RegExp('(?<![А-Яа-яЁё])'+ru.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&')+'(?![А-Яа-яЁё])','g');
    result = result.replace(pattern,en);
  }
  return result;
}
export function installLocalization(buttons) {
  const originals = new WeakMap();
  let preference = ['ru','en','auto'].includes(localStorage.getItem(LANGUAGE_KEY)) ? localStorage.getItem(LANGUAGE_KEY) : 'auto';
  let lang = resolveLanguage(preference,navigator.language);
  const attributes = ['aria-label','title','placeholder'];
  function visit(node) {
    if (node.nodeType === 3) {
      if (!node.nodeValue.trim()) return;
      const previous = originals.get(node);
      const source = previous && (node.nodeValue === previous.ru || node.nodeValue === previous.en) ? previous.ru : node.nodeValue;
      const en = translateText(source,'en');
      originals.set(node,{ru:source,en});
      const desired = lang === 'en' ? en : source;
      if (node.nodeValue !== desired) node.nodeValue = desired;
    } else if (node.nodeType === 1) {
      for (const attr of attributes) if (node.hasAttribute(attr)) {
        const key = 'i18n'+attr.replace(/-/g,'');
        const current = node.getAttribute(attr);
        const prior = node.dataset[key];
        const source = prior && (current === prior || current === translateText(prior,'en')) ? prior : current;
        node.dataset[key] = source;
        const desired = translateText(source,lang);
        if (current !== desired) node.setAttribute(attr,desired);
      }
      for (const child of node.childNodes) visit(child);
    }
  }
  function refresh() { document.documentElement.lang = lang; visit(document.body); document.title = 'FightTech Interval Timer'; }
  function syncButtons() {
    for (const button of buttons) {
      const active = button.dataset.language === preference;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    }
  }
  for (const button of buttons) button.addEventListener('click', () => {
    preference = button.dataset.language;
    localStorage.setItem(LANGUAGE_KEY,preference);
    lang = resolveLanguage(preference,navigator.language);
    syncButtons();
    refresh();
  });
  syncButtons();
  window.addEventListener('languagechange',()=>{if(preference==='auto'){lang=resolveLanguage(preference,navigator.language);refresh();}});
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(()=>{pending=false;refresh();});
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  refresh();
}
