function pad2(n) { return String(n).padStart(2, "0"); }
function isoDateUTC(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function lerp(a, b, t) { return a + (b - a) * t; }

export function generate({
  year,
  todayStr,                 // "YYYY-MM-DD" in UTC
  width = 1179,             // iPhone 15 Pro
  height = 2556,

  // Safe areas / positioning
  marginX = 80,
  marginTop = 320,
  marginBottom = 160,

  // Dot field shape (life-calendar look)
  cols = 19,
  rows = 20,

  // Spacing + dot sizing
  gapRatio = 0.55,          // gap = dotDiameter * gapRatio
  dotFillRatio = 0.78,      // radius = (dotD/2) * dotFillRatio

  // Today emphasis
  todayScale = 1.35,
  ringWidth = 3,

  // Subtle progress tint
  enableProgressRamp = true,

  // Footer text
  showFooter = true,
  footerGapRatio = 1.6,     // distance under grid = dotD * footerGapRatio
  footerSize = 34,          // px
  footerMutedSize = 28      // px
}) {
  const daysInYear = isLeapYear(year) ? 366 : 365;
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dec31 = new Date(Date.UTC(year, 11, 31));
  const today = new Date(`${todayStr}T00:00:00Z`);

  // day-of-year index for today (0-based). Clamp if todayStr is outside the year.
  const msPerDay = 24 * 60 * 60 * 1000;
  const rawIndex = Math.round((today.getTime() - jan1.getTime()) / msPerDay);
  const todayIndex = clamp(rawIndex, 0, daysInYear - 1);

  const daysCompleted = todayIndex + 1;
  const daysLeft = daysInYear - daysCompleted;
  const percent = Math.round((daysCompleted / daysInYear) * 1000) / 10; // 1 decimal

  const usableW = width - 2 * marginX;
  const usableH = height - marginTop - marginBottom;

  // Fit dot diameter to fill area:
  const denomW = cols + (cols - 1) * gapRatio;
  const denomH = rows + (rows - 1) * gapRatio;

  const dotD = Math.floor(Math.min(usableW / denomW, usableH / denomH));
  const gap = Math.floor(dotD * gapRatio);

  const fieldW = cols * dotD + (cols - 1) * gap;
  const fieldH = rows * dotD + (rows - 1) * gap;

  const x0 = marginX + Math.floor((usableW - fieldW) / 2);
  const y0 = marginTop + Math.floor((usableH - fieldH) / 2);

  const fieldCenterX = x0 + fieldW / 2;
  const fieldBottomY = y0 + fieldH;

  const rBase = (dotD / 2) * dotFillRatio;

  let dots = "";

  for (let i = 0; i < cols * rows; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;

    const cx = x0 + c * (dotD + gap) + dotD / 2;
    const cy = y0 + r * (dotD + gap) + dotD / 2;

    if (i >= daysInYear) {
      // unused slots -> invisible
      continue;
    }

    const d = new Date(jan1);
    d.setUTCDate(jan1.getUTCDate() + i);
    const dateStr = isoDateUTC(d);
    const isToday = dateStr === todayStr;

    const isPastOrToday = i <= todayIndex;

    let opacity;
    if (!enableProgressRamp) {
      opacity = isPastOrToday ? 0.18 : 0.10;
    } else {
      const progress = clamp01(i / Math.max(1, daysInYear - 1));
      const pastOpacity = lerp(0.14, 0.26, progress);
      const futureOpacity = 0.09;
      opacity = isPastOrToday ? pastOpacity : futureOpacity;
    }

    if (isToday) {
      const rToday = rBase * todayScale;
      dots += `
    <g class="todayGlow">
      <circle class="todayFill" cx="${cx}" cy="${cy}" r="${rToday}" />
      <circle class="todayRing" cx="${cx}" cy="${cy}" r="${rToday}" />
    </g>`;
    } else {
      dots += `\n    <circle class="dot" cx="${cx}" cy="${cy}" r="${rBase}" fill-opacity="${opacity}" />`;
    }
  }

  // Footer placement
  const footerY1 = Math.floor(fieldBottomY + dotD * footerGapRatio);
  const footerY2 = footerY1 + Math.floor(footerSize * 1.1);

  const footer = showFooter ? `
  <text class="footer" x="${fieldCenterX}" y="${footerY1}" text-anchor="middle">
    ${daysLeft} days left
  </text>
  <text class="footerMuted" x="${fieldCenterX}" y="${footerY2}" text-anchor="middle">
    ${percent}% completed
  </text>` : "";

  // If todayStr is not within the same year, you may want to show a warning or clamp logic
  // Here we simply clamp the metrics to [Jan1..Dec31] and still highlight only if exact todayStr matches a tile.

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      :root {
        --bg0: #070A0F;
        --bg1: #0B1220;

        --dot: #FFFFFF;

        --accent: #7DD3FC;
        --todayFill: rgba(255,255,255,0.22);
        --ringW: ${ringWidth}px;
      }

      .bg { fill: url(#bgGrad); }

      .dot { fill: var(--dot); }

      .todayFill { fill: var(--todayFill); }
      .todayRing { fill: none; stroke: var(--accent); stroke-width: var(--ringW); }
      .todayGlow { filter: drop-shadow(0 0 18px rgba(125, 211, 252, 0.35)); }

      .footer {
        fill: rgba(255,255,255,0.80);
        font-family: ui-sans-serif, -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial;
        font-weight: 700;
        font-size: ${footerSize}px;
        letter-spacing: 0.5px;
      }
      .footerMuted {
        fill: rgba(255,255,255,0.52);
        font-family: ui-sans-serif, -apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial;
        font-weight: 600;
        font-size: ${footerMutedSize}px;
        letter-spacing: 0.3px;
      }
    </style>

    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--bg0)" />
      <stop offset="100%" stop-color="var(--bg1)" />
    </linearGradient>
  </defs>

  <rect class="bg" x="0" y="0" width="${width}" height="${height}"/>

  <g id="dots">
    ${dots}
  </g>

  ${footer}
</svg>`;
}

// ---- Configure (CLI usage) ----
if (typeof process !== "undefined" && process?.argv?.[1]?.endsWith("generate-year-wallpaper.mjs")) {
  const { default: fs } = await import("node:fs");

  const year = 2026;

  // Set this to the day you want highlighted (UTC date)
  const todayStr = "2026-01-18";

  const svg = generate({
    year,
    todayStr,
    width: 1179,
    height: 2556,
    marginX: 80,
    marginTop: 320,
    marginBottom: 160,
    cols: 19,
    rows: 20,
    gapRatio: 0.55,
    dotFillRatio: 0.78,
    todayScale: 1.35,
    ringWidth: 3,
    enableProgressRamp: true,
    showFooter: true,
    footerGapRatio: 1.6,
    footerSize: 34,
    footerMutedSize: 28
  });

  fs.writeFileSync(`year-dots-only-${year}-iphone15pro.svg`, svg, "utf8");
  console.log(`Wrote year-dots-only-${year}-iphone15pro.svg (today=${todayStr})`);
}
