/**
 * admin-charts.js — line graph renderers (no external library)
 */

/* shared helpers */
function _chartPts(data, W, H, pad) {
  const max = Math.max(...data, 1);
  return data.map((v, i) => ({
    x: pad.l + i * (W - pad.l - pad.r) / Math.max(data.length - 1, 1),
    y: H - pad.b - (v / max) * (H - pad.t - pad.b)
  }));
}

function _drawGrid(ctx, W, H, pad, steps) {
  ctx.strokeStyle = '#C9BC9A'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= steps; i++) {
    const y = pad.t + (H - pad.t - pad.b) * i / steps;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
  }
}

function _drawYLabels(ctx, max, H, pad, steps) {
  ctx.fillStyle = '#5C5548'; ctx.font = '9px Space Mono,monospace'; ctx.textAlign = 'right';
  for (let i = 0; i <= steps; i++) {
    const y = pad.t + (H - pad.t - pad.b) * i / steps;
    const val = Math.round(max * (steps - i) / steps);
    ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val, pad.l - 4, y + 3);
  }
}

function _drawXLabels(ctx, labels, pts, H, pad) {
  const step = Math.ceil(labels.length / 7);
  ctx.fillStyle = '#5C5548'; ctx.font = '9px Space Mono,monospace'; ctx.textAlign = 'center';
  labels.forEach((l, i) => { if (i % step === 0) ctx.fillText(l, pts[i].x, H - pad.b + 13); });
}

function _drawLineSeries(ctx, pts, color, W, H, pad, fill) {
  const max = Math.max(...pts.map(p => p.y)); // raw y — unused; fill uses bottom
  // area fill
  if (fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, H - pad.b);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, H - pad.b);
    ctx.closePath();
    ctx.fillStyle = color + '22'; ctx.fill();
  }
  // line
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  // dots
  pts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#F1EAD6'; ctx.lineWidth = 1.5; ctx.stroke();
  });
}

/* ── Single-series line chart ── */
function drawLine(canvasId, labels, data, color = '#1F3A2E') {
  const c = $(canvasId); if (!c) return;
  const W = c.parentElement.clientWidth - 40 || 400;
  const H = parseInt(c.getAttribute('height') || 160);
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const pad = { t: 10, r: 14, b: 28, l: 46 };
  const max = Math.max(...data, 1);
  const pts = _chartPts(data, W, H, pad);

  ctx.clearRect(0, 0, W, H);
  _drawGrid(ctx, W, H, pad, 4);
  _drawYLabels(ctx, max, H, pad, 4);
  _drawLineSeries(ctx, pts, color, W, H, pad, true);
  _drawXLabels(ctx, labels, pts, H, pad);
}

/* ── Multi-series line chart (e.g. payment methods over time) ── */
function drawMultiLine(canvasId, labels, seriesArr, colors, seriesLabels) {
  const c = $(canvasId); if (!c) return;
  const W = c.parentElement.clientWidth - 40 || 400;
  const H = parseInt(c.getAttribute('height') || 160);
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const legendH = seriesLabels.length * 14 + 6;
  const pad = { t: 10, r: 14, b: 28 + legendH, l: 46 };

  const allValues = seriesArr.flat();
  const max = Math.max(...allValues, 1);

  ctx.clearRect(0, 0, W, H);
  _drawGrid(ctx, W, H, pad, 4);
  _drawYLabels(ctx, max, H, pad, 4);

  seriesArr.forEach((data, si) => {
    const pts = data.map((v, i) => ({
      x: pad.l + i * (W - pad.l - pad.r) / Math.max(data.length - 1, 1),
      y: H - pad.b - (v / max) * (H - pad.t - pad.b)
    }));
    _drawLineSeries(ctx, pts, colors[si], W, H, pad, false);
    if (si === 0) _drawXLabels(ctx, labels, pts, H, pad);
  });

  // legend below chart
  const legendY = H - legendH + 6;
  ctx.font = '9px Space Mono,monospace'; ctx.textAlign = 'left';
  seriesLabels.forEach((label, i) => {
    const lx = pad.l + i * 80;
    ctx.fillStyle = colors[i]; ctx.fillRect(lx, legendY + i * 14, 9, 9);
    ctx.fillStyle = '#5C5548'; ctx.fillText(label, lx + 13, legendY + i * 14 + 8);
  });
}
