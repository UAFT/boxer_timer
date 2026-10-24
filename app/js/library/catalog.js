import { BOXING_LIBRARY, SHARED_SHADOW_BAG_IDS } from './boxing-149.js';
/* Editable launch library. Boxing entries are drafts: owner programs remain untouched. */
const make = (id, category, name, mode, tasks, opts={}) => ({
  id, category, name, mode, tasks, rounds: opts.rounds || 1,
  work: opts.work || 20, rest: opts.rest ?? 20, duration: opts.duration || 0,
  equipment: opts.equipment || '', note: opts.note || '', source: opts.source || 'UAFT draft'
});
export const CATEGORIES = [
  ['warmup','Разминка'], ['boxing','Бокс'], ['two_phase','Двухфазные'],
  ['interval','Интервальные 20/20'], ['amrap','AMRAP'], ['afap','AFAP'],
  ['emom','EMOM'], ['tabata','Tabata'], ['cardio','Кардио'], ['abs','Пресс'], ['cooldown','Заминка']
];
// Two-phase library exercises use the existing two-phase stage and per-round
// override fields. Each catalog entry is independent of the user's presets.
const makeTwoPhase = (id,name,first,rounds,work,rest,opts={}) => ({
  ...make(id,'two_phase',name,'two_phase',opts.tasks || [first,'Бой с тенью'],
    {rounds,work,rest,equipment:opts.equipment || '',source:'Fight Tech owner · 2026-10-22'}),
  phaseOneName:first,
  phaseTwoName:'Бой с тенью',
  phaseTwoSec:60,
  phaseOneOverrides:opts.phaseOneOverrides || [],
  roundTimingOverrides:opts.roundTimingOverrides || []
});
export const LIBRARY = [
  make('W01','warmup','Скакалка','interval',['Свободная скакалка'],{rounds:3,work:180,rest:60}),
  make('W02','warmup','Суставная гимнастика','interval',['Плечи и руки','Таз и корпус','Колени и голеностоп','Лёгкие движения'],{work:60,rest:0}),
  make('W03','warmup','Работа ног','interval',['Шаги вперёд и назад','Шаги в стороны','Движение по кругу','Свободные передвижения'],{work:60,rest:0}),
  make('W04','warmup','Динамическая разминка','interval',['Лёгкий бег','Движения руками','Приставные шаги','Лёгкий бой с тенью'],{work:60,rest:0}),
  make('B01','boxing','Комплекс 1','interval',['Работа в челноке','Защита + комбинация ударов','Боковые одиночные и сдвоенные','Одиночные акцентированные удары в корпус','Ближний бой','Вольный бой'],{work:60,rest:30,note:'Черновая копия заданий со скриншота; оригинальная личная программа не меняется.'}),
  make('B02','boxing','Комплекс 2','interval',['Акцентированные одиночные','Любые двойки','Любые тройки','Серия, акцент корпус','Вольная работа','Вольная работа, акцент корпус'],{work:60,rest:30,note:'Черновая копия заданий со скриншота; оригинальная личная программа не меняется.'}),
  make('B05','boxing','Работа с гантелями','interval',['Прямые удары','Боковые удары','Удары снизу','Защитные действия','Свободный стиль в сильной стойке','Свободный стиль в слабой стойке','Ускорение'],{work:120,rest:60,equipment:'Гантели',source:'Owner-approved training 2026-10-21'}),
  makeTwoPhase('TP01','Сила + лёгкость','Кувалда',5,60,60,{equipment:'Кувалда'}),
  makeTwoPhase('TP02','Сила + лёгкость 2','Медицинбол',5,60,60,{equipment:'Медицинбол'}),
  makeTwoPhase('TP03','Сила + лёгкость — микс','Кувалда',6,30,40,{
    equipment:'Кувалда, медицинбол',
    tasks:['Раунды 1–3: кувалда 00:30 → бой с тенью 01:00',
      'Раунды 4–6: медицинбол 01:00 → бой с тенью 01:00'],
    phaseOneOverrides:['','','','Медицинбол','Медицинбол','Медицинбол'],
    roundTimingOverrides:[null,null,null,{workSec:60},{workSec:60},{workSec:60}]
  }),
  make('I01','interval','Собственный вес 20/20','interval',['Отжимания','Приседания','Ситапы'],{rounds:4}),
  make('I02','interval','Скакалка и корпус 20/20','interval',['Скакалка','Отжимания','Ситапы'],{rounds:4}),
  make('I03','interval','Гиря 20/20','interval',['Махи гирей','Отжимания','Ситапы'],{rounds:4,equipment:'Гиря'}),
  make('I04','interval','Взрывные ноги 20/20','interval',['Разножка','Выпрыгивания','Боковые прыжки'],{rounds:4}),
  make('A01','amrap','Cindy','amrap',['5 подтягиваний','10 отжиманий','15 приседаний'],{duration:1200,source:'CrossFit benchmark'}),
  make('A02','amrap','Короткий круг','amrap',['5 подтягиваний','10 приседаний','10 ситапов'],{duration:720}),
  make('A03','amrap','Гиря и корпус','amrap',['10 махов гирей','8 отжиманий','12 ситапов'],{duration:720,equipment:'Гиря'}),
  make('A04','amrap','Смешанный круг','amrap',['8 тяг гантелей','12 приседаний','10 отжиманий'],{duration:900,equipment:'Гантели'}),
  make('F01','afap','Три движения','afap',['4 круга','10 отжиманий','15 приседаний','15 ситапов']),
  make('F02','afap','Тяга — ноги — корпус','afap',['4 круга','8 подтягиваний','15 приседаний','15 ситапов']),
  make('F03','afap','Гиря For Time','afap',['4 круга','12 махов гирей','10 отжиманий','15 ситапов'],{equipment:'Гиря'}),
  make('F04','afap','Лестница 15–12–9','afap',['15–12–9','Приседания','Отжимания','Ситапы']),
  make('E01','emom','Базовый EMOM','emom',['10 отжиманий','15 приседаний','15 ситапов'],{rounds:4}),
  make('E02','emom','EMOM с гирей','emom',['12 махов гирей','10 отжиманий','15 ситапов'],{rounds:4,equipment:'Гиря'}),
  make('E03','emom','EMOM с гантелями','emom',['10 тяг гантелей','12 приседаний','10 отжиманий'],{rounds:4,equipment:'Гантели'}),
  make('E04','emom','Ноги и кардио','emom',['20 секунд скакалки','10 приседаний','8 выпрыгиваний'],{rounds:4}),
  make('T01','tabata','Классическая Tabata','tabata',['Велотренажёр / Air Bike'],{rounds:8}),
  make('T02','tabata','Tabata приседания','tabata',['Приседания'],{rounds:8}),
  make('T03','tabata','Tabata скакалка','tabata',['Скакалка'],{rounds:8}),
  make('T04','tabata','Tabata Something Else','tabata',['Подтягивания','Отжимания','Ситапы','Приседания'],{rounds:8,source:'CrossFit benchmark'}),
  make('C01','cardio','Скакалка 3 × 3','interval',['Скакалка'],{rounds:3,work:180,rest:60}),
  make('C02','cardio','Бег по кругу','interval',['Лёгкий бег','Бег в среднем темпе','Лёгкий бег'],{work:180,rest:0}),
  make('C03','cardio','Battle ropes','interval',['Чередующиеся волны','Одновременные волны','Удары канатами'],{rounds:3,work:20,rest:40,equipment:'Тренировочные канаты'}),
  make('C04','cardio','Гребля / Air Bike','interval',['Работа на тренажёре'],{rounds:10,work:30,rest:30,equipment:'Гребной тренажёр или Air Bike'}),
  make('P01','abs','Пресс · один подход','interval',['50 ситапов (или свой норматив)'],{rounds:1,work:180,rest:0,note:'Временное окно 3 минуты; счёт повторений вручную'}),
  make('P02','abs','Пресс · интервалы 20/20','interval',['Ситап + прямые удары','Наклоны к пяткам','Велосипед','Скалолаз','Парашютист','Аквалангист'],{rounds:1,work:20,rest:20}),
  make('P03','abs','Пресс · EMOM 25','emom',['25 ситапов; остаток минуты — отдых'],{rounds:3}),
  make('P04','abs','Пресс · круг из 6 упражнений','interval',['Ситап + прямые удары','Наклоны к пяткам','Велосипед','Скалолаз','Парашютист','Аквалангист'],{rounds:1,work:30,rest:15}),
  make('D01','cooldown','Свободная растяжка','interval',['Самостоятельная растяжка'],{work:300,rest:0}),
  make('D02','cooldown','Восстановление','interval',['Лёгкая ходьба','Свободная растяжка'],{work:150,rest:0})
];
export function findWorkout(id) { return LIBRARY.find(x=>x.id===id); }
export function buildSteps(workout) {
  if (!workout) return [];
  if (workout.mode==='two_phase') {
    const steps=[];
    for(let i=0;i<workout.rounds;i++) {
      const overrides=workout.roundTimingOverrides?.[i] || {};
      const oneName=workout.phaseOneOverrides?.[i] || workout.phaseOneName;
      const twoName=workout.phaseTwoOverrides?.[i] || workout.phaseTwoName;
      steps.push({kind:'work',phase:1,round:i+1,title:oneName,seconds:overrides.workSec ?? workout.work});
      steps.push({kind:'work',phase:2,round:i+1,title:twoName,seconds:overrides.phaseTwoSec ?? workout.phaseTwoSec});
      if(i<workout.rounds-1)steps.push({kind:'rest',round:i+1,title:'Отдых',seconds:overrides.restSec ?? workout.rest});
    }
    return steps;
  }
  if (workout.mode==='afap') return [{kind:'afap',title:workout.name,seconds:0,description:workout.tasks.join(' → ')}];
  if (workout.mode==='amrap') return [{kind:'work',title:workout.name,seconds:workout.duration,description:'Повторяй круги: '+workout.tasks.join(' → ')}];
  const steps=[];
  const count=workout.mode==='emom'?workout.rounds*workout.tasks.length:workout.mode==='tabata'?workout.rounds*workout.tasks.length:workout.rounds*workout.tasks.length;
  for(let i=0;i<count;i++) {
    const task=workout.tasks[Math.floor(i/(workout.mode==='tabata'?workout.rounds:1))%workout.tasks.length];
    const work=workout.mode==='emom'?60:workout.mode==='tabata'?20:workout.work;
    const rest=workout.mode==='emom'?0:workout.mode==='tabata'?10:workout.rest;
    steps.push({kind:'work',title:task,seconds:work,description:workout.mode==='emom'?'Выполни повторения; остаток минуты — отдых':workout.name});
    if(rest>0 && i<count-1)steps.push({kind:'rest',title:'Отдых',seconds:rest,description:'Следующее: '+workout.tasks[Math.floor((i+1)/(workout.mode==='tabata'?workout.rounds:1))%workout.tasks.length]});
  }
  return steps;
}
export function buildSequence(ids, pauseSec=60) {
  const steps=[];
  ids.forEach((id,i)=>{
    const w=findWorkout(id);if(!w)return;
    if(i>0 && pauseSec>0)steps.push({kind:'rest',title:'Отдых между программами',seconds:pauseSec,description:w.name});
    steps.push(...buildSteps(w).map(step=>({...step,programId:id,programName:w.name})));
  });
  return steps;
}

// Keep existing workout IDs and legacy categories; add the approved boxing catalog.
const SHADOW_FOLDER = 'Работа перед зеркалом / Бой с тенью';
LIBRARY.push(...BOXING_LIBRARY.map(x=>({id:x.id,category:'boxing',folder:x.folder,subfolder:x.subfolder||'',
  alsoIn:SHARED_SHADOW_BAG_IDS.includes(x.id)?[{folder:SHADOW_FOLDER,subfolder:'Общие с работой на мешке'}]:[],
  name:x.name,mode:'boxing_sequence',sourceMode:x.mode,rounds:x.rounds,note:'',methodology:x.methodology,
  // Bag rounds repeat in the weak stance: list each task once.
  tasks:[...new Set(x.rounds.map(r=>r.name))]})));
