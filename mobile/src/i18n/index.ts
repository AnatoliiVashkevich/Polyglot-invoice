// Screen language. Every visible text goes through t(); keys are the English text.
// English first; Spanish, Portuguese, Russian and Ukrainian are filled in before release (build plan step 9).

export type Lang = 'en' | 'es' | 'pt' | 'ru' | 'uk';

export const LANGUAGES: Record<Lang, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
  ru: 'Русский',
  uk: 'Українська',
};

const LOCALES: Record<Lang, string> = { en: 'en-US', es: 'es-US', pt: 'pt-BR', ru: 'ru-RU', uk: 'uk-UA' };

const dictionaries: Record<Exclude<Lang, 'en'>, Record<string, string>> = { es: {}, pt: {}, ru: {}, uk: {} };

let current: Lang = 'en';

export function setLanguage(lang: Lang) {
  current = lang;
}

export const locale = () => LOCALES[current];

export function t(text: string, vars?: Record<string, string | number>): string {
  let out = current === 'en' ? text : dictionaries[current][text] ?? text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return out;
}
