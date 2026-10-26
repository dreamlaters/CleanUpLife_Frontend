function findChartPoint(points, event) {
  const touch = (event.touches || [])[0] || (event.changedTouches || [])[0];
  if (!touch || !Number.isFinite(touch.x) || !Number.isFinite(touch.y)) return null;

  // Canvas touch coordinates and plotted points both use logical pixels, not DPR-scaled pixels.
  let nearest = null;
  let distance = 24;
  for (const point of points) {
    const candidate = Math.hypot(point.x - touch.x, point.y - touch.y);
    if (candidate <= distance) {
      nearest = point;
      distance = candidate;
    }
  }
  return nearest;
}

function drawChartTooltip(ctx, point, lines, width, height) {
  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const inset = 8;
  const padding = 10;
  const lineHeight = 18;
  const boxWidth = Math.min(
    Math.max(...lines.map(line => ctx.measureText(line).width)) + padding * 2,
    width - inset * 2
  );
  const boxHeight = lines.length * lineHeight + padding * 2;
  const left = Math.max(inset, Math.min(point.x - boxWidth / 2, width - boxWidth - inset));
  const above = point.y - boxHeight - 12;
  const top = Math.max(inset, Math.min(
    above >= inset ? above : point.y + 12,
    height - boxHeight - inset
  ));

  ctx.strokeStyle = point.color || '#9f4f3d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(left, top, boxWidth, boxHeight);
  ctx.strokeStyle = '#cdbba8';
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, boxWidth, boxHeight);
  lines.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? '#827267' : '#3f352f';
    ctx.fillText(line, left + padding, top + padding + index * lineHeight, boxWidth - padding * 2);
  });
  ctx.restore();
}

module.exports = { findChartPoint, drawChartTooltip };
