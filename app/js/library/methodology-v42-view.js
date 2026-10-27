// Preview of the approved V4.2 methodology tree: section → stage → program → exercises.
// A stage with owner trainings (V42_WORKOUTS entries whose stageId is the stage) shows exactly those, in order, as the Tree's
// own lesson card passed in by the app as lessonCard(workout, stageId): no wrapper, no source programs (they stay in the data).
// V58: a training with programId belongs to that unnumbered substage (a book program card): the stage keeps its substage cards. A substage
// with trainings is fully converted (owner-verified), so it shows only them — its book exercises stay in the data, not in the UI.
// Every other stage lists its programs as read-only cards. Format/equipment chips are not shown on program cards: any program can be done
// with a partner, on a bag, at a mirror or as shadowboxing. Old library and tree are untouched.
export const V42_NO_ROUNDS_NOTICE = 'Раунды будут добавлены после проверки методологии';

const el = (doc, tag, cls, text) => {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

// Built only when a <details> opens: 170 programs and ~760 exercise rows stay out of the DOM until asked for.
function lazy(details, build) {
  let done = false;
  details.addEventListener('toggle', () => {
    if (!details.open || done) return;
    done = true;
    details.append(build());
  });
}

function chipRow(doc, values, cls = 'ft-v42-chip') {
  const row = el(doc, 'div', 'ft-v42-chips');
  for (const value of values) row.append(el(doc, 'span', cls, value));
  return row;
}

export const workoutTotalSec = w => w.rounds.reduce((sum, r, i) => sum + r.workSec + (i < w.rounds.length - 1 ? r.restSec : 0), 0);

export function renderProgramBody(doc, program) {
  const body = el(doc, 'div', 'ft-v42-program-body');
  body.append(el(doc, 'p', 'ft-v42-notice', V42_NO_ROUNDS_NOTICE));
  for (const [label, text] of program.criteria) {
    const block = el(doc, 'div', 'ft-v42-criterion');
    block.append(el(doc, 'strong', 'ft-v42-criterion-label', label));
    for (const line of text.split('\n')) block.append(el(doc, 'p', 'ft-v42-criterion-text', line));
    body.append(block);
  }
  body.append(el(doc, 'strong', 'ft-v42-list-label', 'Упражнения · ' + program.exercises.length));
  const list = el(doc, 'ol', 'ft-v42-exercises');
  for (const item of program.exercises) {
    const li = el(doc, 'li', 'ft-v42-exercise' + (item.review ? ' is-review' : ''));
    li.append(el(doc, 'p', 'ft-v42-exercise-text', item.text));
    if (item.review) li.append(chipRow(doc, ['Повторение']));
    const facts = [item.needs, item.equipment && 'Инвентарь: ' + item.equipment].filter(Boolean);
    if (facts.length) li.append(el(doc, 'p', 'ft-v42-exercise-facts', facts.join(' · ')));
    list.append(li);
  }
  body.append(list);
  return body;
}

export function renderMethodologyV42(doc, data, { workouts = {}, lessonCard } = {}) {
  const root = el(doc, 'div', 'ft-route ft-v42');
  // Trainings straight in a stage (no programId) replace its program cards; trainings of a substage sit inside that program card.
  const all = lessonCard ? Object.values(workouts) : [];
  const ownOf = stage => all.filter(w => w.stageId === stage.id && !w.programId);
  const subOf = (stage, program) => all.filter(w => w.stageId === stage.id && w.programId === program.id);
  // Stage and substage chips count executable trainings; a stage without any counts its read-only program cards.
  const countChip = (runs, programs) => {
    const chip = runs
      ? el(doc, 'span', 'ft-v42-stage-count ft-v42-stage-count-run', runs + ' трен.')
      : el(doc, 'span', 'ft-v42-stage-count', programs + ' прогр.');
    chip.title = runs ? 'Тренировок с раундами: ' + runs : 'Программ методики (только чтение): ' + programs;
    chip.setAttribute?.('aria-label', chip.title);
    return chip;
  };
  const stageChip = stage => countChip(all.filter(w => w.stageId === stage.id).length, stage.programs.length);
  data.sections.forEach((section, si) => {
    const group = el(doc, 'details', 'ft-route-section');
    group.dataset.section = section.id;
    const head = el(doc, 'summary', 'ft-route-section-head');
    head.append(el(doc, 'span', 'ft-route-station', String(si + 1).padStart(2, '0')),
      el(doc, 'strong', 'ft-route-section-name', section.title),
      el(doc, 'span', 'ft-v42-count', String(section.stages.length)),
      el(doc, 'span', 'ft-route-chevron', '⌄'));
    group.append(head);
    lazy(group, () => {
      const steps = el(doc, 'div', 'ft-route-steps');
      for (const stage of section.stages) {
        const step = el(doc, 'details', 'ft-route-step');
        step.dataset.stage = stage.id;
        const summary = el(doc, 'summary', 'ft-route-step-head');
        summary.append(el(doc, 'span', 'ft-route-step-dot', String(stage.no)), el(doc, 'span', 'ft-route-step-title', stage.title), stageChip(stage), el(doc, 'span', 'ft-route-chevron', '⌄'));
        step.append(summary);
        lazy(step, () => {
          const content = el(doc, 'div', 'ft-route-lesson-list ft-v42-programs');
          // A stage that already has a training shows its cards straight away, without the stage summary.
          const own = ownOf(stage);
          if (own.length) {
            for (const workout of own) {
              const lesson = lessonCard(workout, stage.id);
              if (!lesson) continue;
              lesson.dataset.program = workout.id;
              content.append(lesson);
            }
            return content;
          }
          if (stage.task) content.append(el(doc, 'p', 'ft-v42-stage-task', stage.task));
          for (const program of stage.programs) {
            const card = el(doc, 'details', 'ft-v42-program');
            card.dataset.program = program.id;
            const top = el(doc, 'summary', 'ft-v42-program-head');
            const sub = subOf(stage, program);
            top.append(el(doc, 'span', 'ft-v42-program-title', program.title + (program.review ? ' · повторение' : '')));
            top.append(el(doc, 'span', 'ft-v42-program-meta', sub.length ? 'Тренировок: ' + sub.length : 'Упражнений: ' + program.exercises.length));
            if (sub.length) { card.className += ' ft-v42-substage'; top.append(countChip(sub.length, 0)); }
            card.append(top);
            lazy(card, () => {
              if (!sub.length) return renderProgramBody(doc, program);
              const box = el(doc, 'div', 'ft-route-lesson-list ft-v42-sub-lessons');
              for (const workout of sub) {
                const lesson = lessonCard(workout, stage.id);
                if (!lesson) continue;
                lesson.dataset.program = workout.id;
                box.append(lesson);
              }
              return box;
            });
            content.append(card);
          }
          return content;
        });
        steps.append(step);
      }
      return steps;
    });
    root.append(group);
  });
  return root;
}
