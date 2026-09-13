import { state, roadPoint, clamp } from './state.js';

function quad(ctx, a, b, c, d, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

export function drawRoad(ctx, w, h, horizon) {
  const slices = state.fpsSmoother < 43 ? 58 : 82;
  const speedN = clamp(state.speed / 138, 0, 1);

  for (let i = 0; i < slices; i++) {
    const p1 = roadPoint(i / slices, w, h, horizon);
    const p2 = roadPoint((i + 1) / slices, w, h, horizon);
    const alternating = Math.floor(state.roadPhase * 0.09 + i * 1.35) % 2 === 0;
    const roadColor = state.time === 'night'
      ? (alternating ? '#14181d' : '#181c21')
      : (alternating ? '#303438' : '#34393d');
    const shoulder = state.environment === 'coast' ? '#878078'
      : state.environment === 'city' ? '#494d50' : '#5d5d55';

    quad(ctx,
      { x: 0, y: p1.y }, { x: p1.x - p1.halfWidth, y: p1.y },
      { x: p2.x - p2.halfWidth, y: p2.y }, { x: 0, y: p2.y }, shoulder);
    quad(ctx,
      { x: p1.x + p1.halfWidth, y: p1.y }, { x: w, y: p1.y },
      { x: w, y: p2.y }, { x: p2.x + p2.halfWidth, y: p2.y }, shoulder);
    quad(ctx,
      { x: p1.x - p1.halfWidth, y: p1.y }, { x: p1.x + p1.halfWidth, y: p1.y },
      { x: p2.x + p2.halfWidth, y: p2.y }, { x: p2.x - p2.halfWidth, y: p2.y }, roadColor);

    if (i > 3) {
      const e1 = Math.max(0.8, p1.halfWidth * 0.021);
      const e2 = Math.max(1, p2.halfWidth * 0.021);
      quad(ctx,
        { x: p1.x - p1.halfWidth, y: p1.y }, { x: p1.x - p1.halfWidth + e1, y: p1.y },
        { x: p2.x - p2.halfWidth + e2, y: p2.y }, { x: p2.x - p2.halfWidth, y: p2.y }, 'rgba(238,240,236,.92)');
      quad(ctx,
        { x: p1.x + p1.halfWidth - e1, y: p1.y }, { x: p1.x + p1.halfWidth, y: p1.y },
        { x: p2.x + p2.halfWidth, y: p2.y }, { x: p2.x + p2.halfWidth - e2, y: p2.y }, 'rgba(238,240,236,.92)');
    }

    const dashPeriod = 10 - speedN * 2.6;
    const dash = (state.roadPhase * 0.19 + i * 2.55) % dashPeriod;
    if (dash < dashPeriod * 0.5 && i > 5) {
      for (const lane of [-1, 1]) {
        const x1 = p1.x + p1.halfWidth * lane / 3;
        const x2 = p2.x + p2.halfWidth * lane / 3;
        const width1 = Math.max(0.55, p1.halfWidth * 0.0075);
        const width2 = Math.max(0.8, p2.halfWidth * 0.0085);
        quad(ctx,
          { x: x1 - width1, y: p1.y }, { x: x1 + width1, y: p1.y },
          { x: x2 + width2, y: p2.y }, { x: x2 - width2, y: p2.y }, 'rgba(248,248,242,.94)');
      }
    }
  }

  if (speedN > 0.48) {
    ctx.save();
    ctx.globalAlpha = (speedN - 0.48) * 0.42;
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1;
    const count = state.fpsSmoother < 43 ? 8 : 13;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const y = h * (0.52 + t * 0.42);
      const spread = w * (0.42 + t * 0.52);
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - spread, y);
      ctx.lineTo(w * 0.5 - spread - w * 0.08 * speedN, y + 7 + speedN * 16);
      ctx.moveTo(w * 0.5 + spread, y);
      ctx.lineTo(w * 0.5 + spread + w * 0.08 * speedN, y + 7 + speedN * 16);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (state.weather === 'rain') {
    const p = roadPoint(0.72, w, h, horizon);
    const gradient = ctx.createLinearGradient(0, p.y, 0, h);
    gradient.addColorStop(0, 'rgba(180,210,225,0)');
    gradient.addColorStop(1, state.time === 'night' ? 'rgba(120,170,205,.26)' : 'rgba(210,230,238,.2)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(p.x - p.halfWidth, p.y);
    ctx.lineTo(p.x + p.halfWidth, p.y);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  }
}
