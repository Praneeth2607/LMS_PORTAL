// Session feedback.
//
// - Organizers set the Likert questions per workshop; they are asked after
//   every session. Answered questions are archived rather than changed, so
//   past statistics always describe the question that was actually asked.
// - A participant may respond once per session, after it has ended, if they
//   were marked PRESENT (so feedback comes from people who attended).
// - Organizers/admins only ever see aggregates (averages and distributions);
//   written comments are shown individually but without the author's identity.
import { withTransaction } from '../db/pool.js';
import * as feedbackRepository from '../repositories/feedback.repository.js';
import * as attendanceRepository from '../repositories/attendance.repository.js';
import * as registrationRepository from '../repositories/registration.repository.js';
import * as sessionRepository from '../repositories/session.repository.js';
import { getSessionContext } from './session.service.js';
import { getManageableWorkshop } from './workshop.service.js';
import { badRequest, conflict, forbidden } from '../utils/httpError.js';

export const SCALE = [
  { value: 5, label: 'Strongly agree' },
  { value: 4, label: 'Agree' },
  { value: 3, label: 'Neutral' },
  { value: 2, label: 'Disagree' },
  { value: 1, label: 'Strongly disagree' },
];
export const MAX_QUESTIONS = 10;

const presentQuestion = (q) => ({ id: q.id, text: q.questionText, position: q.position, isActive: q.isActive });

// ---------------------------------------------------------------- questions (organizer)
export async function getQuestions(workshopId, user) {
  await getManageableWorkshop(workshopId, user);
  const questions = await feedbackRepository.listQuestions(workshopId);
  return { questions: questions.map((q) => ({ ...presentQuestion(q), hasAnswers: q.hasAnswers })), scale: SCALE };
}

// questions: [{ id?, text }] in display order. Replaces the active set.
export async function saveQuestions(workshopId, questions, user) {
  await getManageableWorkshop(workshopId, user);
  await withTransaction(async (db) => {
    const existing = new Map((await feedbackRepository.listQuestions(workshopId, {}, db)).map((q) => [q.id, q]));
    const kept = new Set();

    for (const [index, q] of questions.entries()) {
      const position = index + 1;
      const current = q.id ? existing.get(q.id) : null;
      if (q.id && !current) throw badRequest(`Question ${position} no longer exists. Reload and try again.`);
      if (!current) {
        await feedbackRepository.insertQuestion(workshopId, q.text, position, db);
      } else if (current.questionText !== q.text && current.hasAnswers) {
        // Reworded after people answered: keep the old wording for its stats.
        await feedbackRepository.archiveQuestion(current.id, db);
        await feedbackRepository.insertQuestion(workshopId, q.text, position, db);
        kept.add(current.id);
      } else {
        await feedbackRepository.updateQuestion(current.id, q.text, position, db);
        kept.add(current.id);
      }
    }

    for (const q of existing.values()) {
      if (kept.has(q.id)) continue;
      if (q.hasAnswers) await feedbackRepository.archiveQuestion(q.id, db);
      else await feedbackRepository.deleteQuestion(q.id, db);
    }
  });
  return getQuestions(workshopId, user);
}

// ---------------------------------------------------------------- participant form
async function eligibility(session, workshop, user) {
  if (user.role !== 'PARTICIPANT') return { eligible: false, reason: 'Only participants can give feedback.' };
  if (!(await registrationRepository.isRegistered(workshop.id, user.id))) {
    return { eligible: false, reason: 'You are not registered for this workshop.' };
  }
  if (session.status !== 'COMPLETED') {
    return { eligible: false, reason: 'Feedback opens when the session is over.' };
  }
  const attendance = await attendanceRepository.findOne(session.id, user.id);
  if (attendance?.status !== 'PRESENT') {
    return { eligible: false, reason: 'Only participants who attended this session can give feedback.' };
  }
  return { eligible: true, reason: null };
}

// GET /api/sessions/:id/feedback
export async function getSessionForm(sessionId, user) {
  const { session, workshop } = await getSessionContext(sessionId, user);
  const [check, submission, questions] = await Promise.all([
    eligibility(session, workshop, user),
    user.role === 'PARTICIPANT' ? feedbackRepository.findSubmission(session.id, user.id) : null,
    feedbackRepository.listQuestions(workshop.id),
  ]);
  return {
    session: {
      id: session.id,
      title: session.title,
      sessionDate: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      workshopId: workshop.id,
      workshopTitle: workshop.title,
    },
    questions: questions.map(presentQuestion),
    scale: SCALE,
    eligible: check.eligible && !submission,
    reason: submission ? null : check.reason,
    submitted: Boolean(submission),
    submittedAt: submission?.submittedAt ?? null,
  };
}

// POST /api/sessions/:id/feedback  { answers: [{ questionId, rating }], comment? }
export async function submitFeedback(sessionId, { answers, comment }, user) {
  const { session, workshop } = await getSessionContext(sessionId, user);
  const check = await eligibility(session, workshop, user);
  if (!check.eligible) throw forbidden(check.reason);
  if (await feedbackRepository.findSubmission(session.id, user.id)) {
    throw conflict('You have already given feedback for this session');
  }

  // Every active question must be answered exactly once, 1–5.
  const questions = await feedbackRepository.listQuestions(workshop.id);
  const byId = new Map(answers.map((a) => [a.questionId, a.rating]));
  const errors = questions
    .filter((q) => !byId.has(q.id))
    .map((q) => ({ field: `q${q.id}`, message: `Please answer: "${q.questionText}"` }));
  if (errors.length) throw badRequest('Please answer every question', errors);
  if (answers.length !== questions.length || answers.some((a) => !questions.some((q) => q.id === a.questionId))) {
    throw badRequest('The questions have changed. Reload the page and try again.');
  }

  const created = await withTransaction((db) =>
    feedbackRepository.createSubmission(session.id, user.id, comment || null, answers, db),
  );
  if (!created) throw conflict('You have already given feedback for this session');
  return { submitted: true, submittedAt: created.submittedAt };
}

// GET /api/my-feedback/pending (participant dashboard)
export const listPending = (user) => feedbackRepository.listPendingForParticipant(user.id);

// ---------------------------------------------------------------- statistics (organizer/admin)
const round1 = (n) => Math.round(n * 10) / 10;

// counts: { 1: n, …, 5: n } → average (1–5), share that agreed (4 or 5).
function summarize(counts) {
  const total = [1, 2, 3, 4, 5].reduce((sum, r) => sum + counts[r], 0);
  const score = [1, 2, 3, 4, 5].reduce((sum, r) => sum + r * counts[r], 0);
  return {
    responses: total,
    average: total ? Math.round((score / total) * 100) / 100 : null,
    agreePercent: total ? round1(((counts[4] + counts[5]) * 100) / total) : null,
    counts,
  };
}

const emptyCounts = () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

// GET /api/workshops/:id/feedback
export async function getWorkshopFeedback(workshopId, user) {
  await getManageableWorkshop(workshopId, user);
  const [questions, rows, totals, comments, sessions] = await Promise.all([
    feedbackRepository.listQuestions(workshopId, { includeArchived: true }),
    feedbackRepository.ratingCounts(workshopId),
    feedbackRepository.sessionTotals(workshopId),
    feedbackRepository.listComments(workshopId),
    sessionRepository.listByWorkshop(workshopId),
  ]);

  // Active questions, plus archived ones that still have answers.
  const shown = questions.filter((q) => q.isActive || q.hasAnswers);
  const cell = new Map(); // `${sessionId}:${questionId}` → counts
  const overallCells = new Map(); // questionId → counts
  for (const row of rows) {
    const key = `${row.sessionId}:${row.questionId}`;
    if (!cell.has(key)) cell.set(key, emptyCounts());
    cell.get(key)[row.rating] += row.count;
    if (!overallCells.has(row.questionId)) overallCells.set(row.questionId, emptyCounts());
    overallCells.get(row.questionId)[row.rating] += row.count;
  }

  const combine = (list) =>
    list.reduce((acc, c) => {
      for (const r of [1, 2, 3, 4, 5]) acc[r] += c[r];
      return acc;
    }, emptyCounts());

  const totalsById = new Map(totals.map((t) => [t.sessionId, t]));
  const sessionStats = sessions.map((s) => {
    const perQuestion = shown.map((q) => ({ questionId: q.id, ...summarize(cell.get(`${s.id}:${q.id}`) || emptyCounts()) }));
    const { responses = 0, attendees = 0 } = totalsById.get(s.id) || {};
    const all = summarize(combine(perQuestion.map((p) => p.counts)));
    return {
      id: s.id,
      title: s.title,
      sessionDate: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      attendees,
      responses,
      responseRate: attendees ? round1((responses * 100) / attendees) : null,
      average: all.average,
      agreePercent: all.agreePercent,
      questions: perQuestion,
    };
  });

  const overallQuestions = shown.map((q) => ({ questionId: q.id, ...summarize(overallCells.get(q.id) || emptyCounts()) }));
  const overallAll = summarize(combine(overallQuestions.map((p) => p.counts)));
  const responses = sessionStats.reduce((sum, s) => sum + s.responses, 0);
  const attendees = sessionStats.reduce((sum, s) => sum + (s.status === 'COMPLETED' ? s.attendees : 0), 0);

  return {
    scale: SCALE,
    questions: shown.map(presentQuestion),
    overall: {
      responses,
      attendees,
      responseRate: attendees ? round1((responses * 100) / attendees) : null,
      average: overallAll.average,
      agreePercent: overallAll.agreePercent,
      questions: overallQuestions,
    },
    sessions: sessionStats,
    comments: comments.map((c) => ({
      id: c.id,
      sessionId: c.sessionId,
      sessionTitle: c.sessionTitle,
      sessionDate: c.sessionDate,
      comment: c.comment,
      submittedAt: c.submittedAt,
    })),
  };
}
