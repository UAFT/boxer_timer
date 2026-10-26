// Read-only preview of the approved V4.2 methodology tree: section → stage → program → exercises.
// No rounds exist yet, so nothing here can start, add to or change the timer; old library and tree are untouched.
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

export function programChips(program) {
  const chips = [...program.formats];
  for (const item of program.exercises) {
    if (item.review) continue;
    for (const label of item.labels) if (label === 'Имитация без партнёра' && !chips.includes(label)) chips.push(label);
  }
  return chips;
}

function chipRow(doc, values, cls = 'ft-v42-chip') {
  const row = el(doc, 'div', 'ft-v42-chips');
  for (const value of values) row.append(el(doc, 'span', cls, value));
  return row;
}

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
    const tags = [...item.formats, ...item.labels];
    if (item.review) tags.unshift('Повторение');
    if (tags.length) li.append(chipRow(doc, tags));
    const facts = [item.needs, item.equipment && 'Инвентарь: ' + item.equipment].filter(Boolean);
    if (facts.length) li.append(el(doc, 'p', 'ft-v42-exercise-facts', facts.join(' · ')));
    list.append(li);
  }
  body.append(list);
  return body;
}

export function renderMethodologyV42(doc, data) {
  const root = el(doc, 'div', 'ft-route ft-v42');
  root.append(el(doc, 'p', 'ft-v42-intro', 'Рекомендуемый порядок обучения. Все ступени открыты; к пройденному можно возвращаться. ' + V42_NO_ROUNDS_NOTICE + '.'));
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
        summary.append(el(doc, 'span', 'ft-route-step-dot', String(stage.no)), el(doc, 'span', 'ft-route-step-title', stage.title), el(doc, 'span', 'ft-route-chevron', '⌄'));
        step.append(summary);
        lazy(step, () => {
          const content = el(doc, 'div', 'ft-route-lesson-list ft-v42-programs');
          if (stage.task) content.append(el(doc, 'p', 'ft-v42-stage-task', stage.task));
          for (const program of stage.programs) {
            const card = el(doc, 'details', 'ft-v42-program');
            card.dataset.program = program.id;
            const top = el(doc, 'summary', 'ft-v42-program-head');
            top.append(el(doc, 'span', 'ft-v42-program-title', program.title + (program.review ? ' · повторение' : '')));
            const chips = programChips(program);
            if (chips.length) top.append(chipRow(doc, chips));
            top.append(el(doc, 'span', 'ft-v42-program-meta', 'Упражнений: ' + program.exercises.length));
            card.append(top);
            lazy(card, () => renderProgramBody(doc, program));
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
