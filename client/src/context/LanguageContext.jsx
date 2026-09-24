import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createTranslator } from '../i18n/domTranslator.js';

// Site language (English or Tamil). The choice is remembered per browser.
export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ta', label: 'தமிழ்', name: 'Tamil' },
];
const STORAGE_KEY = 'aurex26_lang';
const translator = createTranslator();

function readLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((l) => l.code === saved) ? saved : 'en';
  } catch {
    return 'en';
  }
}

const LanguageContext = createContext({ language: 'en', setLanguage: () => {} });

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(readLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // not remembered, still switches for this visit
    }
    if (language === 'en') translator.stop();
    else translator.start(language);
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);

// EN | தமிழ் switch. Never translated itself.
export function LanguageToggle({ className = '' }) {
  const { language, setLanguage } = useLanguage();
  return (
    <div
      role="group"
      aria-label="Language / மொழி"
      data-no-translate
      className={`inline-flex shrink-0 items-center rounded-full border border-ink/15 bg-canvas p-1 ${className}`}
    >
      {LANGUAGES.map((l) => {
        const active = language === l.code;
        return (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            aria-pressed={active}
            title={l.name}
            onClick={() => setLanguage(l.code)}
            className={`min-h-9 rounded-full px-2.5 text-[14px] sm:px-3 font-medium transition-colors ${
              active ? 'bg-ink text-canvas' : 'text-slate hover:text-ink'
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
