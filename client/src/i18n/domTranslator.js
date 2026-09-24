// Translates the rendered page (English → Tamil) without touching components.
//
// While active it walks the page's text nodes and a few attributes, replaces
// each English text with its entry from the dictionary, and keeps watching
// for new or changed text (React renders, route changes). Texts missing from
// the dictionary are sent to the server in batches; it translates them with
// Google Translate, saves them to server/i18n/ta.json and returns them.
//
// Only text node values and attributes are changed (never nodes themselves),
// so React keeps working normally. Mark anything that must stay as typed
// (emails, codes, IDs) with data-no-translate.
import { api } from '../services/api.js';

const ATTRIBUTES = ['placeholder', 'aria-label', 'title', 'alt'];
const SKIP = '[data-no-translate],[translate="no"],script,style,noscript,textarea,code,pre,iframe';
const NUMBER = /\d+(?:[.,:]\d+)*/g;
const CACHE_KEY = (lang) => `aurex26_i18n_${lang}`;
const BATCH = 50;

// "3 of 12 responded" → { key: "{0} of {1} responded", numbers: ["3", "12"] }
export function toKey(text) {
  const numbers = [];
  const key = text.replace(/\s+/g, ' ').replace(NUMBER, (m) => `{${numbers.push(m) - 1}}`);
  return { key, numbers };
}
const fill = (template, numbers) => template.replace(/\{(\d+)\}/g, (m, i) => numbers[i] ?? m);
const LITERAL = [/^\S+@\S+\.\S+$/, /^https?:\/\//i, /^[A-Z0-9][A-Z0-9-]{4,}$/];
const translatable = (text) => /[A-Za-z]/.test(text) && !LITERAL.some((re) => re.test(text));

function readCache(lang) {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY(lang)) || '{}');
  } catch {
    return {};
  }
}
function writeCache(lang, dict) {
  try {
    localStorage.setItem(CACHE_KEY(lang), JSON.stringify(Object.fromEntries(dict)));
  } catch {
    // storage full or unavailable: the dictionary is simply fetched again next time
  }
}

export function createTranslator() {
  let lang = null;
  let dict = new Map();
  let observer = null;
  const textState = new WeakMap(); // Text → { original, applied }
  const attrState = new WeakMap(); // Element → Map(attr → { original, applied })
  const touched = new Set(); // nodes/elements to restore when switching back
  const pending = new Set(); // keys waiting for the server
  const waiting = new Set(); // nodes/elements waiting for those keys
  const failed = new Set(); // keys the server could not translate (don't retry this visit)
  let flushTimer = null;

  const skipped = (el) => !el || Boolean(el.closest(SKIP));

  function lookup(core) {
    const { key, numbers } = toKey(core);
    if (dict.has(key)) return fill(dict.get(key), numbers);
    if (!failed.has(key)) {
      pending.add(key);
      scheduleFlush();
    }
    return null;
  }

  function translateText(node) {
    if (!lang || skipped(node.parentElement)) return;
    const value = node.nodeValue;
    const state = textState.get(node);
    if (state && value === state.applied) return; // our own change
    const core = value.trim();
    if (!core || !translatable(core)) return;
    const translated = lookup(core);
    if (translated === null) {
      textState.set(node, { original: value, applied: null });
      waiting.add(node);
      return;
    }
    const applied = value.replace(core, translated);
    textState.set(node, { original: value, applied });
    touched.add(node);
    if (applied !== value) node.nodeValue = applied;
  }

  function translateAttr(el, name) {
    if (!lang || skipped(el) || !el.hasAttribute(name)) return;
    const value = el.getAttribute(name);
    const states = attrState.get(el) || new Map();
    attrState.set(el, states);
    const state = states.get(name);
    if (state && value === state.applied) return;
    const core = value.trim();
    if (!core || !translatable(core)) return;
    const translated = lookup(core);
    if (translated === null) {
      states.set(name, { original: value, applied: null });
      waiting.add(el);
      return;
    }
    states.set(name, { original: value, applied: translated });
    touched.add(el);
    if (translated !== value) el.setAttribute(name, translated);
  }

  function scan(root) {
    if (root.nodeType === Node.TEXT_NODE) return translateText(root);
    if (root.nodeType !== Node.ELEMENT_NODE || skipped(root)) return undefined;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) translateText(node);
    const els = [root, ...root.querySelectorAll(ATTRIBUTES.map((a) => `[${a}]`).join(','))];
    for (const el of els) for (const name of ATTRIBUTES) if (el.hasAttribute?.(name)) translateAttr(el, name);
    return undefined;
  }

  function scheduleFlush() {
    if (!flushTimer) flushTimer = setTimeout(flush, 120);
  }

  async function flush() {
    flushTimer = null;
    const keys = [...pending];
    pending.clear();
    if (!keys.length || !lang) return;
    const current = lang;
    for (let i = 0; i < keys.length; i += BATCH) {
      const chunk = keys.slice(i, i + BATCH);
      try {
        const result = await api.post(`/i18n/${current}/translate`, { texts: chunk });
        for (const [en, translated] of Object.entries(result)) dict.set(en, translated);
        chunk.filter((k) => !(k in result)).forEach((k) => failed.add(k));
      } catch {
        chunk.forEach((k) => failed.add(k));
      }
    }
    if (lang !== current) return;
    writeCache(current, dict);
    for (const item of touched) if (!item.isConnected) touched.delete(item);
    // Re-apply to everything that was waiting for these keys.
    const again = [...waiting];
    waiting.clear();
    for (const item of again) {
      if (!item.isConnected) continue;
      if (item.nodeType === Node.TEXT_NODE) translateText(item);
      else ATTRIBUTES.forEach((name) => translateAttr(item, name));
    }
  }

  function onMutations(mutations) {
    for (const m of mutations) {
      if (m.type === 'characterData') translateText(m.target);
      else if (m.type === 'attributes') translateAttr(m.target, m.attributeName);
      else m.addedNodes.forEach(scan);
    }
  }

  return {
    async start(nextLang) {
      if (lang === nextLang) return;
      lang = nextLang;
      dict = new Map(Object.entries(readCache(lang)));
      const observe = () => {
        observer = new MutationObserver(onMutations);
        const options = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES };
        observer.observe(document.body, options);
        observer.observe(document.head.querySelector('title'), options);
      };
      if (dict.size) {
        scan(document.head.querySelector('title'));
        scan(document.body);
        observe();
      }
      try {
        const fresh = await api.get(`/i18n/${lang}`);
        if (lang !== nextLang) return;
        dict = new Map(Object.entries(fresh));
        writeCache(lang, dict);
      } catch {
        // offline: keep using the cached dictionary
      }
      if (!observer) observe();
      scan(document.head.querySelector('title'));
      scan(document.body);
    },

    stop() {
      lang = null;
      observer?.disconnect();
      observer = null;
      clearTimeout(flushTimer);
      flushTimer = null;
      pending.clear();
      waiting.clear();
      for (const item of touched) {
        if (item.nodeType === Node.TEXT_NODE) {
          const state = textState.get(item);
          if (state && item.nodeValue === state.applied) item.nodeValue = state.original;
          textState.delete(item);
        } else {
          const states = attrState.get(item);
          states?.forEach((state, name) => {
            if (item.getAttribute(name) === state.applied) item.setAttribute(name, state.original);
          });
          attrState.delete(item);
        }
      }
      touched.clear();
    },
  };
}
