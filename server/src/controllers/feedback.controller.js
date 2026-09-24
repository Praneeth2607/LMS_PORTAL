import * as feedbackService from '../services/feedback.service.js';
import { parseId, validate } from '../validators/validate.js';
import { badRequest } from '../utils/httpError.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

// [{ id?, text }] → validated list (1–10 questions, 5–300 characters each).
function validateQuestions(body) {
  const list = body?.questions;
  if (!Array.isArray(list) || list.length === 0) throw badRequest('Add at least one question');
  if (list.length > feedbackService.MAX_QUESTIONS) {
    throw badRequest(`At most ${feedbackService.MAX_QUESTIONS} questions`);
  }
  const errors = [];
  const questions = list.map((q, index) => {
    const text = typeof q?.text === 'string' ? q.text.trim().replace(/\s+/g, ' ') : '';
    if (text.length < 5 || text.length > 300) {
      errors.push({ field: `questions[${index}]`, message: `Question ${index + 1} must be 5–300 characters` });
    }
    const id = q?.id === undefined || q?.id === null ? null : Number(q.id);
    if (id !== null && !Number.isInteger(id)) errors.push({ field: `questions[${index}]`, message: 'Invalid question id' });
    return { id, text };
  });
  const texts = questions.map((q) => q.text.toLowerCase());
  if (new Set(texts).size !== texts.length) errors.push({ field: 'questions', message: 'Questions must be different' });
  if (errors.length) throw badRequest('Validation failed', errors);
  return questions;
}

// { answers: [{ questionId, rating 1–5 }], comment? }
function validateSubmission(body) {
  const { comment } = validate(body, { comment: { type: 'string', label: 'Feedback', max: 2000 } });
  const answers = Array.isArray(body?.answers) ? body.answers : null;
  if (!answers) throw badRequest('Please answer every question');
  const parsed = answers.map((a) => ({ questionId: Number(a?.questionId), rating: Number(a?.rating) }));
  if (parsed.some((a) => !Number.isInteger(a.questionId) || !Number.isInteger(a.rating) || a.rating < 1 || a.rating > 5)) {
    throw badRequest('Each answer must be one of: Strongly agree, Agree, Neutral, Disagree, Strongly disagree');
  }
  if (new Set(parsed.map((a) => a.questionId)).size !== parsed.length) throw badRequest('Each question can be answered once');
  return { answers: parsed, comment: comment ?? null };
}

export async function getQuestions(req, res) {
  sendSuccess(res, await feedbackService.getQuestions(parseId(req.params.id), req.user));
}

export async function saveQuestions(req, res) {
  const data = await feedbackService.saveQuestions(parseId(req.params.id), validateQuestions(req.body), req.user);
  sendSuccess(res, data, 'Feedback questions saved');
}

export async function workshopFeedback(req, res) {
  sendSuccess(res, await feedbackService.getWorkshopFeedback(parseId(req.params.id), req.user));
}

export async function sessionForm(req, res) {
  sendSuccess(res, await feedbackService.getSessionForm(parseId(req.params.id), req.user));
}

export async function submit(req, res) {
  const data = await feedbackService.submitFeedback(parseId(req.params.id), validateSubmission(req.body), req.user);
  sendCreated(res, data, 'Thanks! Your feedback was sent');
}

export async function pending(req, res) {
  sendSuccess(res, await feedbackService.listPending(req.user));
}
