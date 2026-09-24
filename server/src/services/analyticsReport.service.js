// Admin analytics as a PDF report with vector charts (pdf-lib, standard fonts).
// Same data and colours as the dashboard; every workshop with finished sessions
// gets its own session-by-session chart.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import env from '../config/env.js';
import * as analyticsService from './analytics.service.js';

const hex = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  ink: hex('#141413'),
  slate: hex('#696969'),
  grid: hex('#ece8e3'),
  axis: hex('#d1cdc7'),
  panel: hex('#f7f5f3'),
  series1: hex('#cf4500'), // brand orange (same tokens as the dashboard charts)
  series2: hex('#2a78d6'),
  track: hex('#f6ddd0'),
  white: rgb(1, 1, 1),
};
const PAGE = { w: 595.28, h: 841.89 }; // A4
const M = 48; // page margin
const CONTENT_W = PAGE.w - M * 2;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Standard PDF fonts only cover Latin text; anything else becomes "?" instead of failing.
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function safe(text) {
  return String(text ?? '')
    .replace(/→/g, '->')
    .replace(/−/g, '-')
    .replace(/[^ -~ -ÿ]/g, (ch) => (WIN_ANSI_EXTRA.includes(ch) ? ch : '?'));
}

class Report {
  constructor(pdf, fonts) {
    this.pdf = pdf;
    this.fonts = fonts;
    this.pages = [];
    this.newPage();
  }

  newPage() {
    this.page = this.pdf.addPage([PAGE.w, PAGE.h]);
    this.pages.push(this.page);
    this.y = PAGE.h - M;
  }

  ensure(height) {
    if (this.y - height < M + 20) this.newPage();
  }

  width(text, size, bold = false) {
    return (bold ? this.fonts.bold : this.fonts.regular).widthOfTextAtSize(safe(text), size);
  }

  text(text, x, y, { size = 10, bold = false, color = C.ink, align = 'left', maxWidth } = {}) {
    let t = safe(text);
    const font = bold ? this.fonts.bold : this.fonts.regular;
    if (maxWidth) while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) t = `${t.slice(0, -2)}…`;
    const w = font.widthOfTextAtSize(t, size);
    const dx = align === 'right' ? -w : align === 'center' ? -w / 2 : 0;
    this.page.drawText(t, { x: x + dx, y, size, font, color });
  }

  // Wrapped paragraph; returns the height used.
  paragraph(text, x, y, { size = 10, color = C.slate, maxWidth = CONTENT_W, lineHeight = 1.35, bold = false } = {}) {
    const words = safe(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (this.width(next, size, bold) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => this.text(l, x, y - i * size * lineHeight, { size, color, bold }));
    return lines.length * size * lineHeight;
  }

  heading(title, subtitle) {
    this.ensure(70);
    this.page.drawCircle({ x: M + 3, y: this.y - 3, size: 3, color: C.series1 });
    this.text(title, M + 12, this.y - 7, { size: 15, bold: true });
    this.y -= 22;
    if (subtitle) this.y -= this.paragraph(subtitle, M, this.y - 4, { size: 9.5 }) + 4;
    this.y -= 8;
  }

  // ---------------------------------------------------------------- line chart
  lineChart({ x, top, w, h, labels, series, ticks, fmt = String, valueFmt = fmt, labelPoints }) {
    const p = this.page;
    const m = { l: 34, r: 30, t: 10, b: 20 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const n = labels.length;
    const maxTick = ticks[ticks.length - 1] || 1;
    const px = (i) => x + m.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
    const py = (v) => top - m.t - ih + (v / maxTick) * ih;

    for (const t of ticks) {
      p.drawLine({ start: { x: x + m.l, y: py(t) }, end: { x: x + m.l + iw, y: py(t) }, thickness: 0.6, color: t === 0 ? C.axis : C.grid });
      this.text(fmt(t), x + m.l - 6, py(t) - 3, { size: 7.5, color: C.slate, align: 'right' });
    }
    const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 44))));
    labels.forEach((label, i) => {
      if ((n - 1 - i) % every === 0) this.text(label, px(i), top - h + 4, { size: 7.5, color: C.slate, align: 'center' });
    });

    for (const s of series) {
      const pts = s.values.map((v, i) => [px(i), py(v)]);
      if (s.area && pts.length > 1) {
        // SVG path in local coordinates (y grows downward from `top`).
        const d = [
          ...pts.map(([ax, ay], i) => `${i ? 'L' : 'M'}${ax - x},${top - ay}`),
          `L${pts[pts.length - 1][0] - x},${top - py(0)}`,
          `L${pts[0][0] - x},${top - py(0)} Z`,
        ].join(' ');
        p.drawSvgPath(d, { x, y: top, color: s.color, opacity: 0.1, borderWidth: 0 });
      }
      for (let i = 1; i < pts.length; i++) {
        p.drawLine({ start: { x: pts[i - 1][0], y: pts[i - 1][1] }, end: { x: pts[i][0], y: pts[i][1] }, thickness: 1.6, color: s.color });
      }
      if (n <= 24) for (const [cx, cy] of pts) p.drawCircle({ x: cx, y: cy, size: 2.6, color: s.color, borderColor: C.white, borderWidth: 1.2 });
      for (const i of labelPoints?.(s) ?? [s.values.length - 1]) {
        const end = i === n - 1;
        const [lx, ly] = pts[i];
        const isMin = s.values[i] === Math.min(...s.values);
        if (end) this.text(valueFmt(s.values[i]), lx + 6, ly - 3, { size: 7.5, bold: true });
        else this.text(valueFmt(s.values[i]), lx, isMin ? ly - 12 : ly + 6, { size: 7.5, bold: true, align: 'center' });
      }
    }
  }

  legend(items, x, y) {
    let cx = x;
    for (const it of items) {
      this.page.drawLine({ start: { x: cx, y: y + 3 }, end: { x: cx + 12, y: y + 3 }, thickness: 1.6, color: it.color });
      this.text(it.label, cx + 16, y, { size: 8.5, color: C.ink });
      cx += 16 + this.width(it.label, 8.5) + 18;
    }
  }

  meter(x, y, w, value, max) {
    this.page.drawRectangle({ x, y, width: w, height: 3.5, color: C.track });
    if (value !== null && value !== undefined) {
      this.page.drawRectangle({ x, y, width: Math.max(0, Math.min(1, value / max)) * w, height: 3.5, color: C.series1 });
    }
  }
}

const niceTicks = (max) => {
  if (!(max > 0)) return [0, 1, 2, 3, 4];
  const raw = max / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * power).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  const out = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
};
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const pct = (v) => (v === null || v === undefined ? '-' : `${Math.round(v)}%`);
const score = (v) => (v === null || v === undefined ? '-' : v.toFixed(1));

// Activity labels per bucket unit: weeks "13 Jul", months "Jan" (one year) or
// "Jul '25" (all time), days "1".."31".
function bucketLabel(isoDate, unit, spansYears) {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (unit === 'day') return String(d);
  if (unit === 'week') return `${d} ${MONTHS[m - 1]}`;
  return spansYears ? `${MONTHS[m - 1]} '${String(y).slice(2)}` : MONTHS[m - 1];
}
const UNIT_TEXT = { day: 'per day', week: 'per week', month: 'per month' };

// filters: { workshopId, year, month } (same as GET /api/admin/analytics)
export async function analyticsReport(filters = {}) {
  const data = await analyticsService.getAnalytics(filters);
  const { scope, summary } = data;

  const pdf = await PDFDocument.create();
  pdf.setTitle('CICT Workshops · Portal analytics');
  pdf.setAuthor('CICT Workshops · Aurex26');
  const r = new Report(pdf, {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  });

  // ---------------------------------------------------------------- header
  r.text('CICT WORKSHOPS · AUREX26', M, r.y - 8, { size: 8, bold: true, color: C.slate });
  r.text('Portal analytics', M, r.y - 38, { size: 26, bold: true });
  const scopeLine = `Period: ${scope.label}${scope.workshopTitle ? `  ·  Workshop: ${scope.workshopTitle}` : '  ·  All workshops'}`;
  r.text(scopeLine, M, r.y - 58, { size: 10.5, bold: true, maxWidth: CONTENT_W });
  const generated = new Date().toLocaleString('en-GB', {
    timeZone: env.appTimezone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  r.text(`Generated ${generated} (${env.appTimezone})`, M, r.y - 73, { size: 8.5, color: C.slate });
  r.y -= 94;

  // Headline numbers for the selected period / workshop.
  const tiles = [
    ['Registrations', String(summary.registrations), 'new sign-ups in this period'],
    ['Check-ins', String(summary.checkIns), `across ${plural(summary.sessionsHeld, 'finished session')}`],
    ['Avg. attendance', pct(summary.attendanceRate), 'present ÷ registered, finished sessions'],
    ['Avg. feedback', summary.feedbackAverage === null ? '-' : `${score(summary.feedbackAverage)} / 5`, plural(summary.feedbackResponses, 'response')],
    ['Certificates', String(summary.certificates), 'issued in this period'],
  ];
  const gap = 8;
  const tw = (CONTENT_W - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach(([label, value, hint], i) => {
    const tx = M + i * (tw + gap);
    r.page.drawRectangle({ x: tx, y: r.y - 70, width: tw, height: 70, color: C.panel });
    r.text(label, tx + 9, r.y - 16, { size: 8, color: C.slate, maxWidth: tw - 18 });
    r.text(value, tx + 9, r.y - 41, { size: 18, bold: true, maxWidth: tw - 18 });
    r.paragraph(hint, tx + 9, r.y - 55, { size: 6.8, maxWidth: tw - 18, lineHeight: 1.25 });
  });
  r.y -= 96;

  // ---------------------------------------------------------------- activity
  const buckets = data.activity;
  const spansYears = new Set(buckets.map((b) => b.start.slice(0, 4))).size > 1;
  r.heading(
    'Activity over time',
    `Registrations and attendance check-ins ${UNIT_TEXT[scope.unit]}, ${scope.label.toLowerCase() === 'all time' ? 'all time' : scope.label}: ${summary.registrations} registrations, ${summary.checkIns} check-ins.`,
  );
  r.ensure(190);
  r.legend([{ label: 'Registrations', color: C.series1 }, { label: 'Check-ins', color: C.series2 }], M, r.y - 8);
  r.y -= 18;
  const maxValue = Math.max(0, ...buckets.flatMap((b) => [b.registrations, b.checkIns]));
  r.lineChart({
    x: M,
    top: r.y,
    w: CONTENT_W,
    h: 160,
    labels: buckets.map((b) => bucketLabel(b.start, scope.unit, spansYears)),
    series: [
      { color: C.series1, values: buckets.map((b) => b.registrations) },
      { color: C.series2, values: buckets.map((b) => b.checkIns) },
    ],
    ticks: niceTicks(maxValue),
  });
  r.y -= 186;

  // ---------------------------------------------------------------- session attendance
  r.heading(
    'Attendance session by session',
    'Share of registered participants marked present at each completed session, per workshop. A falling line shows where interest drops.',
  );
  if (!data.sessionAttendance.length) {
    r.text('No completed sessions yet.', M, r.y - 10, { size: 10, color: C.slate });
    r.y -= 28;
  }
  for (const w of data.sessionAttendance) {
    r.ensure(200);
    const rates = w.sessions.map((s) => s.rate);
    const average = rates.reduce((a, b) => a + b, 0) / rates.length;
    let drop = { size: 0, at: 0 };
    for (let i = 1; i < rates.length; i++) if (rates[i - 1] - rates[i] > drop.size) drop = { size: rates[i - 1] - rates[i], at: i };
    const insight =
      drop.size >= 10
        ? `Biggest drop: session ${drop.at} -> ${drop.at + 1} (-${Math.round(drop.size)} points)`
        : rates.length > 1
          ? `Attendance held between ${pct(Math.min(...rates))} and ${pct(Math.max(...rates))}`
          : '';
    r.text(w.title, M, r.y - 10, { size: 11, bold: true, maxWidth: CONTENT_W - 150 });
    r.text(`Average ${pct(average)} · ${w.registered} registered`, M + CONTENT_W, r.y - 10, { size: 9, color: C.slate, align: 'right' });
    if (insight) r.text(insight, M, r.y - 24, { size: 8.5, color: C.slate });
    r.y -= 32;
    const lowest = rates.indexOf(Math.min(...rates));
    r.lineChart({
      x: M,
      top: r.y,
      w: CONTENT_W,
      h: 140,
      labels: w.sessions.map((s) => String(s.number)),
      series: [{ color: C.series1, values: rates, area: true }],
      ticks: [0, 25, 50, 75, 100],
      fmt: (v) => `${v}%`,
      valueFmt: pct,
      // Label the end, plus the low point only when it is a real dip (not the start of a flat line).
      labelPoints: () => (lowest > 0 && rates[lowest] < rates[rates.length - 1] ? [lowest, rates.length - 1] : [rates.length - 1]),
    });
    r.text('Session', M + CONTENT_W / 2, r.y - 152, { size: 7.5, color: C.slate, align: 'center' });
    r.y -= 172;
  }

  // ---------------------------------------------------------------- feedback
  const fb = data.feedback;
  r.heading('Feedback satisfaction', 'Average rating per workshop (1 = Strongly disagree, 5 = Strongly agree) and the share who agreed.');
  if (!fb.workshops.length) {
    r.text('No feedback yet.', M, r.y - 10, { size: 10, color: C.slate });
    r.y -= 28;
  } else {
    const labelW = 200;
    const scaleX = M + labelW + 16;
    const scaleW = CONTENT_W - labelW - 16 - 50;
    const sx = (v) => scaleX + ((v - 1) / 4) * scaleW;
    for (const w of fb.workshops) {
      r.ensure(52);
      // Title wraps (up to the label column width); the scale sits beside its first line.
      const titleH = r.paragraph(w.title, M, r.y - 10, { size: 9.5, bold: true, color: C.ink, maxWidth: labelW, lineHeight: 1.25 });
      r.text(`${pct(w.agreePercent)} agree · ${plural(w.responses, 'response')}`, M, r.y - 10 - titleH - 1, { size: 8, color: C.slate });
      const ly = r.y - 12;
      r.page.drawLine({ start: { x: scaleX, y: ly }, end: { x: scaleX + scaleW, y: ly }, thickness: 0.6, color: C.axis });
      for (let t = 1; t <= 5; t++) r.page.drawLine({ start: { x: sx(t), y: ly - 3 }, end: { x: sx(t), y: ly + 3 }, thickness: 0.6, color: C.axis });
      if (w.average !== null) r.page.drawCircle({ x: sx(w.average), y: ly, size: 4, color: C.series1, borderColor: C.white, borderWidth: 1.2 });
      r.text(`${score(w.average)} / 5`, M + CONTENT_W, ly - 3, { size: 10, bold: true, align: 'right' });
      r.y -= Math.max(34, titleH + 24);
    }
    for (let t = 1; t <= 5; t++) r.text(String(t), sx(t), r.y + 2, { size: 7.5, color: C.slate, align: 'center' });
    r.y -= 16;

    r.ensure(40);
    r.text('Lowest-rated statements', M, r.y - 10, { size: 11, bold: true });
    r.text('Across all workshops, with at least 3 answers.', M, r.y - 23, { size: 8.5, color: C.slate });
    r.y -= 32;
    if (!fb.lowestStatements.length) {
      r.text('Not enough answers yet.', M, r.y - 8, { size: 9, color: C.slate });
      r.y -= 22;
    }
    for (const q of fb.lowestStatements) {
      r.ensure(36);
      r.page.drawLine({ start: { x: M, y: r.y }, end: { x: M + CONTENT_W, y: r.y }, thickness: 0.5, color: C.grid });
      r.text(q.text, M, r.y - 13, { size: 9.5, maxWidth: CONTENT_W - 70 });
      r.text(`${q.workshopTitle} · ${q.answers} answers · ${pct(q.agreePercent)} agree`, M, r.y - 25, { size: 7.5, color: C.slate, maxWidth: CONTENT_W - 70 });
      r.text(`${score(q.average)} / 5`, M + CONTENT_W, r.y - 16, { size: 10, bold: true, align: 'right' });
      r.y -= 34;
    }
    r.y -= 12;
  }

  // ---------------------------------------------------------------- organizers
  r.heading('Organizer comparison', 'Attendance counts completed sessions of published workshops; feedback is the average rating out of 5.');
  const cols = [
    { label: 'Organizer', x: M, w: 150 },
    { label: 'Workshops', x: M + 158, w: 50, align: 'right' },
    { label: 'Sessions held', x: M + 216, w: 60, align: 'right' },
    { label: 'Avg. attendance', x: M + 292, w: 80 },
    { label: 'Avg. feedback', x: M + 384, w: 70 },
    { label: 'Certificates', x: M + CONTENT_W - 50, w: 50, align: 'right' },
  ];
  const headerRow = () => {
    for (const c of cols) r.text(c.label.toUpperCase(), c.align === 'right' ? c.x + c.w : c.x, r.y - 10, { size: 7, bold: true, color: C.slate, align: c.align || 'left' });
    r.y -= 16;
    r.page.drawLine({ start: { x: M, y: r.y }, end: { x: M + CONTENT_W, y: r.y }, thickness: 0.6, color: C.axis });
  };
  r.ensure(40);
  headerRow();
  if (!data.organizers.length) {
    r.text('No organizers yet.', M, r.y - 14, { size: 9, color: C.slate });
    r.y -= 24;
  }
  for (const o of data.organizers) {
    if (r.y - 32 < M + 20) {
      r.newPage();
      headerRow();
    }
    const cy = r.y - 16;
    r.text(o.name, cols[0].x, cy, { size: 9.5, bold: true, maxWidth: cols[0].w });
    r.text(String(o.workshops), cols[1].x + cols[1].w, cy, { size: 9.5, align: 'right' });
    r.text(String(o.completedSessions), cols[2].x + cols[2].w, cy, { size: 9.5, align: 'right' });
    r.text(pct(o.attendanceRate), cols[3].x, cy + 2, { size: 9.5 });
    r.meter(cols[3].x, cy - 7, cols[3].w, o.attendanceRate, 100);
    r.text(o.feedbackAverage === null ? '-' : `${score(o.feedbackAverage)} / 5`, cols[4].x, cy + 2, { size: 9.5 });
    r.meter(cols[4].x, cy - 7, cols[4].w, o.feedbackAverage, 5);
    r.text(String(o.certificates), cols[5].x + cols[5].w, cy, { size: 9.5, align: 'right' });
    r.y -= 30;
    r.page.drawLine({ start: { x: M, y: r.y }, end: { x: M + CONTENT_W, y: r.y }, thickness: 0.5, color: C.grid });
  }

  // ---------------------------------------------------------------- footers
  r.pages.forEach((page, i) => {
    r.page = page;
    r.text('CICT Workshops · Portal analytics', M, 26, { size: 7.5, color: C.slate });
    r.text(`Page ${i + 1} of ${r.pages.length}`, PAGE.w - M, 26, { size: 7.5, color: C.slate, align: 'right' });
  });

  const stamp = new Date().toLocaleDateString('en-CA', { timeZone: env.appTimezone });
  return { buffer: Buffer.from(await pdf.save()), filename: `cict-analytics-${stamp}.pdf` };
}

export function sendPdf(res, { buffer, filename }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}
