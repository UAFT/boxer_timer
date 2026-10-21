import { CATEGORIES, LIBRARY } from '../library/catalog.js';

// View-only parsing of known library labels. Stored titles are left untouched.
const savedTitleLookup = new Map();
const legacyBoxingLabels = ['Основная работа', 'Основная тренировка · мешок'];
for (const workout of LIBRARY) {
  const category = CATEGORIES.find(([id]) => id === workout.category)?.[1];
  if (!category) continue;
  const variants = workout.category === 'boxing' ? [category, ...legacyBoxingLabels] : [category];
  for (const label of variants) savedTitleLookup.set(label + ' — ' + workout.name, { category, workout: workout.name });
}

export function stageTitleParts(title) {
  const source = typeof title === 'string' ? title : '';
  return savedTitleLookup.get(source) || { category: null, workout: source };
}

export function renderStageTitle(doc, index, title) {
  const group = doc.createElement('div');
  group.className = 'program-stage-title-stack';
  const number = doc.createElement('span');
  number.className = 'program-stage-number';
  number.textContent = 'Этап ' + index;
  group.append(number);
  const parts = stageTitleParts(title);
  if (parts.category) {
    const category = doc.createElement('span');
    category.className = 'program-stage-category';
    category.textContent = parts.category;
    group.append(category);
  }
  if (parts.workout) {
    const name = doc.createElement('strong');
    name.className = 'program-stage-workout';
    name.textContent = parts.workout;
    group.append(name);
  }
  return group;
}
