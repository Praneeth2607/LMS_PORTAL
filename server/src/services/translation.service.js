// English → Tamil translation dictionary for the website.
//
// The dictionary lives in server/i18n/<lang>.json ({ "English text": "தமிழ்" })
// and is committed with the code. When the website shows text that is not in
// the dictionary yet, the browser asks this service for it: the text is
// translated with Google Translate once, added to the JSON file and served
// from the file from then on.
//
// Numbers are replaced by placeholders before lookup ("3 of 5 responded" →
// "{0} of {1} responded"), so one entry covers every count, date and time.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import env from '../config/env.js';
import { HttpError, badRequest } from '../utils/httpError.js';

export const SUPPORTED_LANGUAGES = ['ta'];
const DICTIONARY_DIR = env.translate.dictionaryDir
  ? path.resolve(env.translate.dictionaryDir)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../i18n');
const MAX_TEXT_LENGTH = 1000;
const MAX_TEXTS_PER_REQUEST = 60;

const dictionaries = new Map(); // lang → Map(english → translated)
const saveTimers = new Map();
const inFlight = new Map(); // `${lang}:${text}` → Promise<string|null>

const fileFor = (lang) => path.join(DICTIONARY_DIR, `${lang}.json`);

function assertLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) throw badRequest(`Unsupported language "${lang}"`);
}

async function load(lang) {
  if (dictionaries.has(lang)) return dictionaries.get(lang);
  let entries = {};
  try {
    entries = JSON.parse(await fs.readFile(fileFor(lang), 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const dict = new Map(Object.entries(entries));
  dictionaries.set(lang, dict);
  return dict;
}

// Writes are batched (many texts arrive together) and keys are sorted so the
// JSON file diffs cleanly in git.
function scheduleSave(lang) {
  clearTimeout(saveTimers.get(lang));
  saveTimers.set(
    lang,
    setTimeout(async () => {
      const dict = dictionaries.get(lang);
      const sorted = Object.fromEntries([...dict.entries()].sort(([a], [b]) => a.localeCompare(b)));
      await fs.mkdir(DICTIONARY_DIR, { recursive: true });
      const tmp = `${fileFor(lang)}.tmp`;
      await fs.writeFile(tmp, `${JSON.stringify(sorted, null, 2)}\n`);
      await fs.rename(tmp, fileFor(lang));
    }, 500),
  );
}

// ---------------------------------------------------------------- Google Translate
// Google Cloud Translation API (v2), with GOOGLE_TRANSLATE_API_KEY.
export const isConfigured = () => Boolean(env.translate.apiKey);

async function translateWithGoogle(texts, lang) {
  if (!isConfigured()) throw new Error('GOOGLE_TRANSLATE_API_KEY is not set');
  const res = await fetch(`${env.translate.apiBase}?key=${encodeURIComponent(env.translate.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, source: 'en', target: lang, format: 'text' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data.data.translations.map((t) => t.translatedText);
}

// Keeps a translation only if every {n} placeholder survived.
function placeholdersIntact(source, translated) {
  const wanted = source.match(/\{\d+\}/g) || [];
  return wanted.every((p) => translated.includes(p));
}

// ---------------------------------------------------------------- public API
export async function getDictionary(lang) {
  assertLanguage(lang);
  return Object.fromEntries(await load(lang));
}

// texts: English strings (already normalised by the browser). Returns
// { text: translation } for every text that could be translated.
export async function translate(lang, texts) {
  assertLanguage(lang);
  if (!Array.isArray(texts) || texts.length === 0) throw badRequest('texts must be a non-empty array');
  if (texts.length > MAX_TEXTS_PER_REQUEST) throw badRequest(`At most ${MAX_TEXTS_PER_REQUEST} texts per request`);
  const clean = [...new Set(texts.filter((t) => typeof t === 'string').map((t) => t.trim()))].filter(
    (t) => t && t.length <= MAX_TEXT_LENGTH && /[A-Za-z]/.test(t),
  );

  const dict = await load(lang);
  const result = {};
  const missing = [];
  for (const text of clean) {
    if (dict.has(text)) result[text] = dict.get(text);
    else missing.push(text);
  }

  // Texts another request is already translating are awaited, not re-sent.
  const mine = missing.filter((t) => !inFlight.has(`${lang}:${t}`));
  if (mine.length && isConfigured()) {
    const job = translateWithGoogle(mine, lang).then(
      (translated) => {
        let added = 0;
        mine.forEach((text, i) => {
          const value = translated[i]?.trim();
          if (value && placeholdersIntact(text, value)) {
            dict.set(text, value);
            added++;
          }
        });
        if (added) scheduleSave(lang);
      },
      (err) => {
        console.error(`Google Translate failed (${mine.length} texts): ${err.message}`);
      },
    );
    for (const text of mine) inFlight.set(`${lang}:${text}`, job);
    job.finally(() => mine.forEach((text) => inFlight.delete(`${lang}:${text}`)));
  }
  await Promise.all(missing.map((t) => inFlight.get(`${lang}:${t}`)));

  for (const text of missing) if (dict.has(text)) result[text] = dict.get(text);
  if (missing.length && !Object.keys(result).length) {
    throw new HttpError(isConfigured() ? 502 : 503, 'The translation service is not available right now');
  }
  return result;
}
