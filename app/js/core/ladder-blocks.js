// Block geometry is shared by the time schedule and the visible steppers.
// Intra-block rest and inter-block rest are distinct controls. The two-phase
// timer cannot play them consecutively on the same boundary.
export function isBetweenBlocks(config, roundIndex, totalRounds) {
  const perBlock = Math.max(1, Number(config?.rounds) || 1);
  const count = Number(roundIndex) || 1;
  return count % perBlock === 0 && count < totalRounds && config?.intervalMode === 'ladder' && Boolean(config?.blockEnabled);
}

export function ladderLocalIndex(config, roundIndex) {
  const perBlock = Math.max(1, Number(config?.rounds) || 1);
  return (Math.max(1, Number(roundIndex) || 1) - 1) % perBlock;
}

// With one round per block the ONLY scheduled rest is between blocks.
// Make the main-screen +/- adjust that effective rest instead of an unused field.
export function editableRestField(config, target) {
  if (target === 'restSec' && config?.intervalMode === 'ladder' && config?.blockEnabled
    && Number(config?.rounds) === 1 && Number(config?.blockCount) > 1) return 'blockRestSec';
  return target;
}
