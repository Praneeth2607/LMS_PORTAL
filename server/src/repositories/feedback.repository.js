import env from '../config/env.js';
import { query } from '../db/pool.js';
import { sessionEnded } from '../utils/sql.js';
import { camelize, camelizeRows } from '../utils/case.js';

export const DEFAULT_QUESTIONS = [
  'The session content was clear and easy to understand.',
  'I understood the key concepts covered in this session.',
  'I can apply what I learned in this session.',
  'The pace of the session was right for me.',
];

// ---------------------------------------------------------------- questions
// has_answers tells the service whether a question may still be edited/deleted
// in place or must be archived to keep past statistics correct.
export async function listQuestions(workshopId, { includeArchived = false } = {}, db) {
  const { rows } = await query(
    `SELECT q.id, q.question_text, q.position, q.is_active,
            EXISTS (SELECT 1 FROM feedback_answers fa WHERE fa.question_id = q.id) AS has_answers
     FROM feedback_questions q
     WHERE q.workshop_id = $1 AND ($2 OR q.is_active)
     ORDER BY q.is_active DESC, q.position, q.id`,
    [workshopId, includeArchived],
    db,
  );
  return camelizeRows(rows);
}

export async function insertQuestion(workshopId, text, position, db) {
  await query(
    'INSERT INTO feedback_questions (workshop_id, question_text, position) VALUES ($1, $2, $3)',
    [workshopId, text, position],
    db,
  );
}

export async function updateQuestion(id, text, position, db) {
  await query('UPDATE feedback_questions SET question_text = $2, position = $3 WHERE id = $1', [id, text, position], db);
}

export async function archiveQuestion(id, db) {
  await query('UPDATE feedback_questions SET is_active = FALSE WHERE id = $1', [id], db);
}

export async function deleteQuestion(id, db) {
  await query('DELETE FROM feedback_questions WHERE id = $1', [id], db);
}

export async function insertDefaultQuestions(workshopId, db) {
  for (const [index, text] of DEFAULT_QUESTIONS.entries()) {
    await insertQuestion(workshopId, text, index + 1, db);
  }
}

// ---------------------------------------------------------------- submissions
export async function findSubmission(sessionId, participantId) {
  const { rows } = await query(
    'SELECT id, submitted_at FROM session_feedback WHERE session_id = $1 AND participant_id = $2',
    [sessionId, participantId],
  );
  return camelize(rows[0]) || null;
}

// Returns null if this participant already submitted (unique constraint).
export async function createSubmission(sessionId, participantId, comment, answers, db) {
  const { rows } = await query(
    `INSERT INTO session_feedback (session_id, participant_id, comment)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id, participant_id) DO NOTHING
     RETURNING id, submitted_at`,
    [sessionId, participantId, comment],
    db,
  );
  if (!rows[0]) return null;
  await query(
    `INSERT INTO feedback_answers (feedback_id, question_id, rating)
     SELECT $1, a.question_id, a.rating
     FROM jsonb_to_recordset($2::jsonb) AS a(question_id INT, rating SMALLINT)`,
    [rows[0].id, JSON.stringify(answers.map((a) => ({ question_id: a.questionId, rating: a.rating })))],
    db,
  );
  return camelize(rows[0]);
}

// ---------------------------------------------------------------- statistics
// Rating counts per session and question (aggregated; no participant data).
export async function ratingCounts(workshopId) {
  const { rows } = await query(
    `SELECT sf.session_id, fa.question_id, fa.rating, COUNT(*)::int AS count
     FROM feedback_answers fa
     JOIN session_feedback sf ON sf.id = fa.feedback_id
     JOIN sessions s ON s.id = sf.session_id
     WHERE s.workshop_id = $1
     GROUP BY sf.session_id, fa.question_id, fa.rating`,
    [workshopId],
  );
  return camelizeRows(rows);
}

// Per session: submissions and participants marked PRESENT (who may respond).
export async function sessionTotals(workshopId) {
  const { rows } = await query(
    `SELECT s.id AS session_id,
            (SELECT COUNT(*)::int FROM session_feedback sf WHERE sf.session_id = s.id) AS responses,
            (SELECT COUNT(*)::int FROM attendance a WHERE a.session_id = s.id AND a.status = 'PRESENT') AS attendees
     FROM sessions s
     WHERE s.workshop_id = $1`,
    [workshopId],
  );
  return camelizeRows(rows);
}

// Written comments, newest first. Deliberately without participant identity.
export async function listComments(workshopId) {
  const { rows } = await query(
    `SELECT sf.id, sf.session_id, s.title AS session_title, s.session_date, sf.comment, sf.submitted_at
     FROM session_feedback sf
     JOIN sessions s ON s.id = sf.session_id
     WHERE s.workshop_id = $1 AND sf.comment IS NOT NULL AND sf.comment <> ''
     ORDER BY sf.submitted_at DESC, sf.id DESC`,
    [workshopId],
  );
  return camelizeRows(rows);
}

// Finished sessions the participant attended but hasn't given feedback on.
export async function listPendingForParticipant(participantId) {
  const { rows } = await query(
    `SELECT s.id AS session_id, s.title AS session_title, s.session_date,
            to_char(s.start_time, 'HH24:MI') AS start_time, to_char(s.end_time, 'HH24:MI') AS end_time,
            w.id AS workshop_id, w.title AS workshop_title
     FROM attendance a
     JOIN sessions s ON s.id = a.session_id
     JOIN workshops w ON w.id = s.workshop_id
     JOIN registrations r ON r.workshop_id = w.id AND r.participant_id = a.participant_id AND r.status = 'REGISTERED'
     WHERE a.participant_id = $1 AND a.status = 'PRESENT'
       AND ${sessionEnded('s', '$2')}
       AND EXISTS (SELECT 1 FROM feedback_questions q WHERE q.workshop_id = w.id AND q.is_active)
       AND NOT EXISTS (SELECT 1 FROM session_feedback sf WHERE sf.session_id = s.id AND sf.participant_id = a.participant_id)
     ORDER BY s.session_date DESC, s.end_time DESC`,
    [participantId, env.appTimezone],
  );
  return camelizeRows(rows);
}

