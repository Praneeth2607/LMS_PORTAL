import { Router } from 'express';
import * as translationService from '../services/translation.service.js';
import { HttpError } from '../utils/httpError.js';
import { sendSuccess } from '../utils/response.js';

// Mounted at /api/i18n. Public: visitors can switch language before signing in.
const router = Router();

// Simple per-IP limit so the public endpoint can't be used to burn the
// translation quota. Normal browsing sends a handful of requests per page.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const entry = hits.get(req.ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(req.ip, { start: now, count: 1 });
    if (hits.size > 10_000) hits.clear();
    return next();
  }
  entry.count++;
  if (entry.count > MAX_REQUESTS) return next(new HttpError(429, 'Too many translation requests. Please wait a minute.'));
  return next();
}

// GET /api/i18n/:lang → the whole dictionary { "English": "translation" }
router.get('/:lang', async (req, res) => {
  res.set('Cache-Control', 'no-cache');
  sendSuccess(res, await translationService.getDictionary(req.params.lang));
});

// POST /api/i18n/:lang/translate { texts: [...] } → { "English": "translation" }
// Texts missing from the dictionary are translated with Google Translate and saved.
router.post('/:lang/translate', rateLimit, async (req, res) => {
  sendSuccess(res, await translationService.translate(req.params.lang, req.body?.texts));
});

export default router;
