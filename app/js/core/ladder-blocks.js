// Block geometry is shared by the time schedule and the visible steppers.
// Intra-block rest and inter-block rest are distinct controls. The timer
// schedules them as successive phases at block boundaries.
export function isBetweenBlocks(config, roundIndex, totalRounds) {
  const perBlock = Math.max(1, Number(config?.rounds) || 1);
  const count = Number(roundIndex) || 1;
  return count % perBlock === 0 && count < totalRounds && config?.intervalMode === 'ladder' && Boolean(config?.blockEnabled);
}

export function ladderLocalIndex(config, roundIndex) {
  const perBlock = Math.max(1, Number(config?.rounds) || 1);
  return (Math.max(1, Number(roundIndex) || 1) - 1) % perBlock;
}

// The ordinary rest is always edited as ordinary rest. A second independently
// configured pause follows it at a block boundary (except after the final block).
export function editableRestField(_config, target) {
  return target;
}
