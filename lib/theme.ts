'use client';
import { useEffect, useState } from 'react';

const KEY = 'orbit-theme';
const LANG_KEY = 'orbit-lang';

export type Lang = 'EN' | 'AR';

/** Shared theme + language state for the web app and the desktop app. */
export function useTheme() {
  const [dark, setDark] = useState(false);
  const [lang, setLang] = useState<Lang>('EN');
  const [ready, setReady] = useState(false);

  // Hydration-safe: read persisted preferences after mount so SSR and client match.
  /* oxlint-disable react/react-compiler */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setDark(stored === 'dark');
      else setDark(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
      const l = localStorage.getItem(LANG_KEY);
      if (l === 'AR' || l === 'EN') setLang(l);
    } catch {}
    setReady(true);
  }, []);
  /* oxlint-enable react/react-compiler */

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.setAttribute('dir', lang === 'AR' ? 'rtl' : 'ltr');
    root.setAttribute('lang', lang === 'AR' ? 'ar' : 'en');
    try {
      localStorage.setItem(KEY, dark ? 'dark' : 'light');
      localStorage.setItem(LANG_KEY, lang);
    } catch {}
  }, [dark, lang, ready]);

  const rtl = lang === 'AR';
  const t = (en: string, ar: string) => (rtl ? ar : en);
  return { dark, setDark, toggleDark: () => setDark((d) => !d), lang, setLang, toggleLang: () => setLang((l) => (l === 'EN' ? 'AR' : 'EN')), rtl, t, ready };
}
