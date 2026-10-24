// Library navigation: section → folder → subfolder → workouts. Only a section whose
// workouts carry folders gets the extra levels; every other section lists its workouts
// directly, as before. A workout may also be shown in other folders (alsoIn) but is
// stored and counted once.
export const UNFILED = 'Ранее добавленные';
const places = w => [{ folder: w.folder || UNFILED, subfolder: w.subfolder || '' }, ...(w.alsoIn || [])];
const unique = values => [...new Set(values)];

export function libraryLevel(library, categories, path = {}) {
  const { category = null, folder = null, subfolder = null } = path;
  if (!category) return { title: 'Разделы', back: false, items: categories.map(([key, label]) =>
    ({ kind: 'category', key, label, count: library.filter(w => w.category === key).length })) };
  const label = categories.find(([key]) => key === category)?.[1] || 'Библиотека';
  const inCategory = library.filter(w => w.category === category);
  if (!inCategory.some(w => w.folder)) return { title: label, back: true, items: inCategory.map(workout => ({ kind: 'workout', workout })) };
  // Folders in catalog order; workouts added before folders existed come last.
  const folders = unique(inCategory.flatMap(w => places(w).map(p => p.folder))).sort((a, b) => (a === UNFILED) - (b === UNFILED));
  if (!folder) return { title: label, back: true, items: folders.map(key =>
    ({ kind: 'folder', key, label: key, count: inCategory.filter(w => places(w).some(p => p.folder === key)).length })) };
  const here = w => places(w).filter(p => p.folder === folder);
  const inFolder = inCategory.filter(w => here(w).length);
  if (subfolder) return { title: subfolder, back: true,
    items: inFolder.filter(w => here(w).some(p => p.subfolder === subfolder)).map(workout => ({ kind: 'workout', workout })) };
  // Own subfolders first, then the ones holding workouts shown here from another folder.
  const subfolders = unique([...inFolder.map(w => places(w)[0]).filter(p => p.folder === folder),
    ...inFolder.flatMap(w => (w.alsoIn || []).filter(p => p.folder === folder))].map(p => p.subfolder).filter(Boolean));
  const loose = inFolder.filter(w => here(w).some(p => !p.subfolder));
  // A lone subfolder is no choice: its workouts are listed straight away.
  if (subfolders.length === 1 && !loose.length) return { title: folder, back: true, items: inFolder.map(workout => ({ kind: 'workout', workout })) };
  return { title: folder, back: true, items: [
    ...subfolders.map(key => ({ kind: 'subfolder', key, label: key, count: inFolder.filter(w => here(w).some(p => p.subfolder === key)).length })),
    ...loose.map(workout => ({ kind: 'workout', workout }))
  ] };
}

// One step up: subfolder → folder → section → section list.
export function libraryUp(path = {}) {
  if (path.subfolder) return { category: path.category, folder: path.folder };
  if (path.folder) return { category: path.category };
  return {};
}

// Opening an item from a level gives the path of the next level.
export function libraryOpen(path, item) {
  if (item.kind === 'category') return { category: item.key };
  if (item.kind === 'folder') return { category: path.category, folder: item.key };
  if (item.kind === 'subfolder') return { ...path, subfolder: item.key };
  return path;
}
