function createDateAxis(sortedDates, left, width, measureText) {
  // Use UTC calendar days so time zones and daylight saving cannot distort spacing.
  const timestamps = sortedDates.map(date => {
    const [year, month, day] = date.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  });
  const start = timestamps[0];
  const span = timestamps[timestamps.length - 1] - start;
  const positions = timestamps.map(time =>
    span === 0 ? left + width / 2 : left + ((time - start) / span) * width
  );
  const candidates = sortedDates.map((date, index) => {
    const [, month, day] = date.split('-').map(Number);
    const text = `${month}/${day}`;
    const halfWidth = measureText(text) / 2;
    const x = Math.max(left + halfWidth, Math.min(left + width - halfWidth, positions[index]));
    return { text, x, left: x - halfWidth, right: x + halfWidth };
  });
  const labels = [];
  const last = candidates[candidates.length - 1];
  const gap = 8;
  candidates.forEach((label, index) => {
    const previous = labels[labels.length - 1];
    if (previous && label.left < previous.right + gap) return;
    // Reserve room for the final date before adding intermediate labels.
    if (index > 0 && label !== last && label.right + gap > last.left) return;
    labels.push(label);
  });
  return { positions, labels };
}

module.exports = { createDateAxis };
