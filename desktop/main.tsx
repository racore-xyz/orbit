import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Home from './App';
import '../app/globals.css';
import { openUrl } from '@tauri-apps/plugin-opener';

// Inside the Tauri WebView, external links must go through the OS browser.
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (/^https?:\/\//i.test(href)) { e.preventDefault(); void openUrl(href); }
});
window.open = ((url?: string | URL) => { if (url) void openUrl(String(url)); return null; }) as typeof window.open;
createRoot(document.getElementById('root')!).render(<StrictMode><Home /></StrictMode>);
