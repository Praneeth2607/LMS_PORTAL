// Admin analytics: session-by-session attendance, activity over time, feedback
// satisfaction and an organizer comparison. Aggregates only.
//
// Filters (query string): workshopId, year ('all' or YYYY), month (1–12, needs a year).
// Without a year the period is the last 12 weeks.
import env from '../config/env.js';
import * as analyticsRepository from '../repositories/analytics.repository.js';
import { badRequest } from '../utils/httpError.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const percent = (part, whole) => (whole > 0 ? Math.round((part * 1000) / whole) / 10 : null);
const iso = (d) => d.toISOString().slice(0, 10);
const todayInTz = () => new Date().toLocaleDateString('en-CA', { timeZone: env.appTimezone }); // YYYY-MM-DD
const addDays = (isoDate, n) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

// Validates the filters and works out the date range + chart buckets.
export async function resolveScope({ workshopId, year, month } = {}) {
  const errors = [];
  const ws = workshopId === undefined || workshopId === '' ? null : Number(workshopId);
  if (ws !== null && (!Number.isInteger(ws) || ws <= 0)) errors.push({ field: 'workshopId', message: 'Invalid workshop' });
  const y = year === undefined || year === '' ? null : year === 'all' ? 'all' : Number(year);
  if (y !== null && y !== 'all' && (!Number.isInteger(y) || y < 2000 || y > 2100)) errors.push({ field: 'year', message: 'Invalid year' });
  const m = month === undefined || month === '' ? null : Number(month);
  if (m !== null && (!Number.isInteger(m) || m < 1 || m > 12)) errors.push({ field: 'month', message: 'Month must be 1–12' });
  if (m !== null && (y === null || y === 'all')) errors.push({ field: 'month', message: 'Choose a year to filter by month' });
  if (errors.length) throw badRequest('Invalid analytics filters', errors);

  const today = todayInTz();
  let from;
  let to;
  let unit;
  let start;
  let label;
  if (y === null) {
    // Last 12 weeks, Monday-based weeks.
    const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    start = addDays(today, -dow - 7 * 11);
    from = start;
    to = today;
    unit = 'week';
    label = 'Last 12 weeks';
  } else if (y === 'all') {
    from = null;
    to = null;
    const first = (await analyticsRepository.firstActivityDate(ws)) || today;
    start = `${first.slice(0, 7)}-01`;
    unit = 'month';
    label = 'All time';
  } else if (m === null) {
    from = `${y}-01-01`;
    to = `${y}-12-31`;
    start = from;
    unit = 'month';
    label = String(y);
  } else {
    from = `${y}-${String(m).padStart(2, '0')}-01`;
    to = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, -1);
    start = from;
    unit = 'day';
    label = `${MONTHS[m - 1]} ${y}`;
  }
  const end = to ?? today;
  return { workshopId: ws, year: y, month: m, from, to, unit, start, end, label };
}

export async function getAnalytics(filters = {}) {
  const scope = await resolveScope(filters);
  const [sessionRows, buckets, feedbackWorkshops, lowest, organizers, options] = await Promise.all([
    analyticsRepository.sessionAttendance(scope),
    analyticsRepository.activity(scope),
    analyticsRepository.feedbackByWorkshop(scope),
    analyticsRepository.lowestStatements(scope, 5, 3),
    analyticsRepository.organizerComparison(scope),
    analyticsRepository.filterOptions(),
  ]);

  // Group finished sessions by workshop (numbers = position in the full schedule).
  const byWorkshop = new Map();
  for (const row of sessionRows) {
    if (!byWorkshop.has(row.workshopId)) {
      byWorkshop.set(row.workshopId, { workshopId: row.workshopId, title: row.workshopTitle, registered: row.registered, sessions: [] });
    }
    byWorkshop.get(row.workshopId).sessions.push({
      number: row.number,
      id: row.sessionId,
      title: row.title,
      sessionDate: row.sessionDate,
      startTime: row.startTime,
      present: row.present,
      registered: row.registered,
      rate: percent(row.present, row.registered),
    });
  }
  const sessionAttendance = [...byWorkshop.values()].filter((w) => w.registered > 0);
  const allSessions = sessionAttendance.flatMap((w) => w.sessions);
  const activity = buckets.map((b) => ({ start: b.bucketStart, registrations: b.registrations, checkIns: b.checkIns }));
  const feedback = {
    workshops: feedbackWorkshops.map((w) => ({ workshopId: w.id, title: w.title, responses: w.responses, average: w.average, agreePercent: w.agreePercent })),
    lowestStatements: lowest.map((q) => ({
      questionId: q.id,
      text: q.questionText,
      workshopId: q.workshopId,
      workshopTitle: q.workshopTitle,
      answers: q.answers,
      average: q.average,
      agreePercent: q.agreePercent,
    })),
  };
  const organizerRows = organizers.map((o) => ({
    id: o.id,
    name: o.name,
    role: o.role,
    workshops: o.workshops,
    completedSessions: o.completedSessions,
    attendanceRate: percent(o.present, o.possible),
    feedbackAverage: o.feedbackAverage,
    feedbackAnswers: o.feedbackAnswers,
    certificates: o.certificates,
  }));

  // Headline numbers for the selected scope.
  const totalResponses = feedback.workshops.reduce((s, w) => s + w.responses, 0);
  const weighted = feedback.workshops.reduce((s, w) => s + w.average * w.responses, 0);
  const summary = {
    registrations: activity.reduce((s, b) => s + b.registrations, 0),
    checkIns: activity.reduce((s, b) => s + b.checkIns, 0),
    sessionsHeld: allSessions.length,
    attendanceRate: percent(
      allSessions.reduce((s, x) => s + x.present, 0),
      allSessions.reduce((s, x) => s + x.registered, 0),
    ),
    feedbackResponses: totalResponses,
    feedbackAverage: totalResponses ? Math.round((weighted / totalResponses) * 100) / 100 : null,
    certificates: organizerRows.reduce((s, o) => s + o.certificates, 0),
  };

  const workshopTitle = scope.workshopId ? options.workshops.find((w) => w.id === scope.workshopId)?.title ?? null : null;
  return {
    scope: {
      workshopId: scope.workshopId,
      workshopTitle,
      year: scope.year,
      month: scope.month,
      from: scope.from,
      to: scope.to,
      unit: scope.unit,
      label: scope.label,
    },
    options: { workshops: options.workshops.map((w) => ({ id: w.id, title: w.title })), years: options.years },
    summary,
    sessionAttendance,
    activity,
    feedback,
    organizers: organizerRows,
  };
}
