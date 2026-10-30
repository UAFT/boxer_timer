import { installCustomLanguageSelect } from './custom-language-select.js';
import { LIBRARY_EN } from './library-en.js';
export const LANGUAGE_KEY = 'fighttech.language.v1';
export function resolveLanguage(preference, device) {
  return preference === 'ru' || preference === 'en' ? preference : /^ru\b|^ru-/i.test(device) ? 'ru' : 'en';
}
const pairs = [
['Прямой отсчёт от 00:00 без ограничения времени','Count up from 00:00 with no time limit'],['Завершить этап','Finish stage'],['Таймер','Count Up'],['ДВЕ ФАЗЫ','TWO PHASES'],['Две фазы','Two phases'],['Фаза 1','Phase 1'],['Фаза 2','Phase 2'],['Время фазы 2','Phase 2 duration'],['Редактирование раунда','Edit round'],['Название упражнения','Exercise name'],['Отдых между блоками','Rest between blocks'],
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
['Подписка','Subscription'],
['Пробный период действует до','Trial access is available until'],
['Подключитесь к интернету, чтобы проверить доступ.','Connect to the internet to verify access.'],
['Пробный период закончился.','The trial period has ended.'],
['Подписка активна до','Subscription active until'],
['Проблема с оплатой — обновите способ оплаты в Google Play.','Payment issue — update your payment method in Google Play.'],
['Подписка отменена, действует до','Subscription canceled; access continues until'],
['Платёж не прошёл.','Payment failed.'],
['Подписка приостановлена.','Subscription paused.'],
['Оплата ожидает подтверждения.','Payment is awaiting confirmation.'],
['Подписка закончилась.','Subscription has ended.'],
['Подключитесь к интернету, чтобы проверить подписку.','Connect to the internet to verify your subscription.'],
['Не удалось проверить подписку в Google Play. Попробуйте позже.','Could not verify the subscription with Google Play. Try again later.'],
['Проверьте дату и время на телефоне.','Check the date and time on your phone.'],
['Доступ активен до','Access is active until'],
['Статус подписки недоступен.','Subscription status is unavailable.'],
['Покупка через Google Play недоступна для этого аккаунта или региона.','Google Play purchase is unavailable for this account or region.'],
['Оформить подписку','Subscribe'],['Восстановить покупки','Restore purchases'],
['Управлять в Google Play','Manage in Google Play'],
['Тестовая сборка: доступ не ограничивается.','Test build: access is not restricted.'],
['в месяц','per month'],['в год','per year'],
['Режим интервалов','Interval mode'],['Схема','Mode'],
['Лестница: каждый следующий раунд и отдых могут становиться длиннее или короче на выбранный шаг. Количество раундов, длительность первого раунда и исходное время отдыха задаются на главном экране выбранного профиля.','Ladder: each subsequent round and rest can get longer or shorter by the chosen step. Set rounds, initial work and rest on the preset main screen.'],
['Шаг работы по раундам','Work step per round'],['Шаг отдыха по раундам','Rest step per round'],
['Отрицательный шаг сокращает каждый следующий раунд, положительный — удлиняет. Изменение по 5 секунд.','Negative steps shorten the next round; positive steps lengthen it. Adjust in 5-second increments.'],
['Отрицательный шаг сокращает отдых, положительный — удлиняет. Нулевой шаг сохраняет одинаковый отдых.','Negative steps shorten rest; positive steps lengthen it. Zero keeps rest unchanged.'],
['Лестница + Блок','Ladder + Block'],['Количество блоков','Number of blocks'],
['Отдых между блоками','Rest between blocks'],['Предупреждение до конца этапа','End-of-phase warning'],
['Нет','None'],['5 сек','5 sec'],['10 сек','10 sec'],['10 сек — метроном недоступен','10 sec — metronome unavailable'],
['Сохранить','Save'],['Предварительный просмотр','Preview'],
['Названия, описания и время задаются для первых 200 раундов','Names, descriptions and times can be set for the first 200 rounds'],
['Оба шага равны нулю: все раунды будут одинаковыми.','Both steps are zero: all rounds will be equal.'],
['без шага','no step'],['мин','min'],['сек','sec'],['из','of'],['блоков','blocks'],['блока','blocks'],['блок','block'],['раундов','rounds'],['раунда','rounds'],['раунд','round'],
['Скоростной','Speed'],['Язык интерфейса','Interface language'],['Развернуть лестницу','Expand ladder'],['Свернуть лестницу','Collapse ladder'],
['Увеличить длину раунда','Increase round duration'],['Уменьшить длину раунда','Decrease round duration'],
['Увеличить время отдыха','Increase rest duration'],['Уменьшить время отдыха','Decrease rest duration'],
['Увеличить количество раундов','Increase rounds'],['Уменьшить количество раундов','Decrease rounds'],
['Включить или выключить метроном','Toggle metronome'],['Управление метрономом','Metronome controls'],
['Лестница раундов','Round ladder'],['Показаны первые','Showing first'],['все раунды','all rounds'],
['Скоростной · 20/20 · 24 раунда','Speed · 20/20 · 24 rounds'],
['Здесь появятся ваши программы. Соберите тренировку на главном экране или добавьте упражнения из Библиотеки и нажмите «Сохранить».','Your programs will appear here. Build a workout on the main screen or add exercises from the Library, then tap Save.'],
// Remaining interface strings (shared with the Play MVP).
['Обычный таймер','Standard timer'],
['Остановить программу','Stop program'],
['Время этого раунда','This round time'],
['После последнего раунда отдых задаётся между этапами.','After the last round, rest is set between stages.'],
['Вернуть по лестнице','Reset to ladder'],
['Отмена','Cancel'],
['Мои','Mine'],
['Библиотека','Library'],
['Импорт программы','Import program'],
['Сохранить в «Мои»','Save to Mine'],
['Программа будет удалена без возможности восстановления.','The program will be deleted permanently.'],
['Удалить','Delete'],
['Редактирование этапа','Edit stage'],
['Режим','Mode'],
['Шаг работы (сек.)','Work step (sec)'],
['Шаг отдыха (сек.)','Rest step (sec)'],
['Шаг фазы 2 (сек.)','Phase 2 step (sec)'],
['Использовать блоки','Use blocks'],
['Обновить программу','Update program'],
['Название новой программы','New program name'],
['Сохранить новую программу','Save new program'],

['Авто / Auto','Auto'],
['Шаг фазы 2 по раундам','Phase 2 step per round'],
['Развернуть таймер','Expand timer'],
['Свернуть таймер','Collapse timer'],
['Выбор рабочей фазы','Choose work phase'],
['Увеличить удары в минуту','Increase BPM'],
['Уменьшить удары в минуту','Decrease BPM'],
['Время работы ММ:СС','Work time MM:SS'],
['Время фазы 2 ММ:СС','Phase 2 time MM:SS'],
['Отдых ММ:СС','Rest MM:SS'],
['Назад','Back'],
['Закрыть окно','Close'],
['Импортировать','Import'],
['Совместить две фазы и лестницу','Combine two phases and ladder'],
['Минуты второй фазы','Phase 2 minutes'],
['Секунды второй фазы','Phase 2 seconds'],
['Минуты работы','Work minutes'],
['Секунды работы','Work seconds'],
['Минуты отдыха','Rest minutes'],
['Секунды отдыха','Rest seconds'],
['Закрыть настройки','Close settings'],
['Разделы','Sections'],
['Ранее добавленные','Previously added'],
['Повторяй круги','Repeat the circuit'],
['Выполни повторения; остаток минуты — отдых','Do the reps; rest for the rest of the minute'],
['Описание упражнения','Exercise description'],
['Настройки этапа','Stage settings'],
['Без названия','Untitled'],
['Название раунда','Round name'],
['Описание раунда','Round description'],
['Программа слишком длинная: больше 1000 раундов. Уменьшите число раундов, блоков или циклов.','The program is too long: more than 1000 rounds. Reduce rounds, blocks or cycles.'],
['Поделиться','Share'],
['Выбери файл .ftworkout из «Загрузок»','Choose a .ftworkout file from Downloads'],
['Этапов','Stages'],
['Циклов','Cycles'],
['Программа сохранена в «Мои программы».','Program saved to My Programs.'],
['Файл создан. Его можно отправить через Telegram.','File created. You can send it via Telegram.'],
['Не удалось отправить файл. Попробуй ещё раз.','Could not send the file. Try again.'],
['Файл не является программой Fight Tech или повреждён.','This file is not a Fight Tech program or it is damaged.'],
['Версия файла не поддерживается.','This file version is not supported.'],
['Файл слишком большой (максимум 128 КБ).','The file is too large (128 KB max).'],
['Программа слишком длинная (максимум 1000 раундов).','The program is too long (1000 rounds max).'],
['Лимит: 100 сохранённых программ.','Limit: 100 saved programs.'],
['Не удалось прочитать файл.','Could not read the file.'],
['Не удалось сохранить: память приложения заполнена.','Could not save: app storage is full.'],
['Не удалось сохранить: память приложения заполнена. Удалите ненужные программы и повторите.','Could not save: app storage is full. Delete programs you no longer need and try again.'],
['Следующий этап не запущен','Next stage not started'],
['На нуле: старт отдыха','At zero: rest starts'],
['Идёт рабочий интервал','Work interval running'],
['На нуле: старт следующего раунда','At zero: next round starts'],
['Идёт отдых','Resting'],
['Прямой отсчёт','Count up'],
['На нуле: старт первого раунда','At zero: first round starts'],
['Идёт фаза 2','Phase 2 running'],
['Серия завершена','Series complete'],
['Это действие нельзя отменить.','This cannot be undone.'],
['Завершено','Complete'],
['Запустить тренировку','Start workout'],
['Таймер · прямой отсчёт','Timer · count up'],
['без лимита','no limit'],
['всего','total'],
['работа','work'],
['Отрицательный шаг сокращает фазу 1 в каждом следующем раунде, положительный — удлиняет. Изменение по 5 секунд.','Negative steps shorten phase 1 in each next round; positive steps lengthen it. Adjust in 5-second increments.'],
['минута','minute'],
['минуты','minutes'],
['минут','minutes'],
['секунда','second'],
['секунды','seconds'],
['секунд','seconds'],
['Циклы:','Cycles:'],
['пауза между циклами:','rest between cycles:'],
['Позиции в программе:','Positions in the program:'],
['Между блоками','Between blocks'],
['Формат ММ:СС, не более 60:00','Format MM:SS, up to 60:00'],
['Уменьшить','Decrease'],
['Увеличить','Increase'],
['Прямой отсчёт · без ограничения времени','Count up · no time limit'],
['лестница','ladder'],
['индивидуально','custom'],
['фаза 1','phase 1'],
['фаза 2','phase 2'],
['отдых между блоками','rest between blocks'],
['Основная работа','Main work'],
['Основная тренировка · мешок','Main workout · bag'],
['Показать план','Show plan'],
['Вариант 1','Option 1'],
['Вариант 2','Option 2'],
// Tree and Methodology interface labels (their content stays in the owner's Russian).
['Дерево','Tree'],
['Методика','Methodology'],
['Путь обучения','Learning path'],
['Все ступени','All stages'],
['Пройдено','Completed'],
['Текущее','Current'],
['Отметить пройденным','Mark as completed'],
['Уроки пока не назначены','No lessons assigned yet'],
['Не удалось открыть методику.','Could not open the methodology.'],
['Загрузка…','Loading…'],
['Техника:','Technique:'],
['Тактика:','Tactics:'],
['Особенности выполнения:','Execution notes:'],
['Типичные ошибки:','Common mistakes:']
].sort((a,b)=>b[0].length-a[0].length);
// Every timer tick re-visits every text node: compile once and remember each string's result.
// One pass over UI and Library phrases together: at each position the longest known phrase wins, so a Library
// name («Работа ног») is never split by a shorter UI word («Работа»). UI wording wins when both define a phrase.
const dictionary = new Map([...LIBRARY_EN, ...pairs]);
const phrase = new RegExp('(?<![А-Яа-яЁё])(?:'+[...dictionary.keys()].sort((a,b)=>b.length-a.length).map(ru=>ru.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&')).join('|')+')(?![А-Яа-яЁё])','g');
const translated = new Map();
export function translateText(text, lang) {
  if (lang !== 'en') return text;
  let result = translated.get(text);
  if (result !== undefined) return result;
  result = text.replace(phrase, ru => dictionary.get(ru));
  // ponytail: a full reset bounds memory; a workout yields a few thousand distinct strings.
  if (translated.size >= 5000) translated.clear();
  translated.set(text,result);
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
      let en = translateText(source,'en');
      // Tree, Methodology and card descriptions hold the owner's and the book's own wording:
      // English only when every word is known, never half-translated.
      if (/[А-Яа-яЁё]/.test(en) && node.parentElement?.closest('.ft-route,.ft-card-section-text')) en = source;
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
  const languageDropdown = document.getElementById('languageSelect');
  if (languageDropdown) {
    languageDropdown.value = preference;
    languageDropdown.addEventListener('change', () => {
      const chosen = languageDropdown.value;
      if (!['ru','en','auto'].includes(chosen)) return;
      preference = chosen;
      localStorage.setItem(LANGUAGE_KEY,preference);
      lang = resolveLanguage(preference,navigator.language);
      syncButtons();
      refresh();
    });
  }
  installCustomLanguageSelect(languageDropdown);
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
