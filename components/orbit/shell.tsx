'use client';
import type { ReactNode } from 'react';
import { Bell, ChevronDown, ChevronRight, Menu, Moon, MoreHorizontal, Search, Sparkles, Sun } from 'lucide-react';
import { AppIcon, Brand, Btn, type Icon } from './primitives';

export type NavItem = { label: string; icon: Icon; badge?: number | string };
export type NavGroup = { label?: string; items: NavItem[] };

export function AppShell({
  dark,
  rtl,
  groups,
  active,
  onNavigate,
  workspace,
  workspaceSub,
  user,
  userSub,
  status,
  crumbRoot,
  searchPlaceholder,
  topActions,
  aiLabel,
  onAi,
  children,
  footerLeft,
  footerRight,
}: {
  dark: boolean;
  rtl?: boolean;
  groups: NavGroup[];
  active: number;
  onNavigate: (i: number) => void;
  workspace: string;
  workspaceSub: string;
  user: string;
  userSub: string;
  status?: { title: string; sub: string };
  crumbRoot: string;
  searchPlaceholder: string;
  topActions?: ReactNode;
  aiLabel?: string;
  onAi?: () => void;
  children: ReactNode;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
}) {
  const flat = groups.flatMap((g) => g.items);
  let idx = 0;
  return (
    <main className={`o-app${dark ? ' dark' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
      <aside className="o-sidebar">
        <Brand collapse={() => {}} />
        <div className="o-workspace">
          <AppIcon size={30} />
          <div>
            <b>{workspace}</b>
            <small>{workspaceSub}</small>
          </div>
          <ChevronDown size={15} className="o-muted" />
        </div>
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.label && <div className="o-nav-label">{g.label}</div>}
            <nav className="o-nav">
              {g.items.map((it) => {
                const i = idx++;
                const I = it.icon;
                return (
                  <button key={it.label} className={`o-nav-item${active === i ? ' active' : ''}`} onClick={() => onNavigate(i)}>
                    <I size={17} strokeWidth={1.8} />
                    <span>{it.label}</span>
                    {it.badge !== undefined && it.badge !== 0 && <em>{it.badge}</em>}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
        <div className="o-sidebar-bottom">
          {status && (
            <div className="o-status">
              <span className="o-live-dot" />
              <div>
                <b>{status.title}</b>
                <small>{status.sub}</small>
              </div>
            </div>
          )}
          <div className="o-user">
            <div>
              <b>{user}</b>
              <small>{userSub}</small>
            </div>
            <MoreHorizontal size={16} />
          </div>
        </div>
      </aside>

      <section className="o-content">
        <header className="o-topbar">
          <div className="o-flex">
            <button className="o-mobile-menu o-iconbtn" aria-label="Menu">
              <Menu size={18} />
            </button>
            <div className="o-crumb">
              <span>{crumbRoot}</span>
              <ChevronRight size={14} />
              <b>{flat[active]?.label}</b>
            </div>
          </div>
          <div className="o-top-actions">
            <div className="o-search">
              <Search size={16} />
              <input placeholder={searchPlaceholder} />
              <kbd>⌘K</kbd>
            </div>
            <button className="o-iconbtn" aria-label="Notifications">
              <Bell size={17} />
              <i />
            </button>
            {topActions}
            {aiLabel && (
              <Btn variant="ai" icon={Sparkles} onClick={onAi}>
                {aiLabel}
              </Btn>
            )}
          </div>
        </header>
        <div className="o-page">{children}</div>
        {(footerLeft || footerRight) && (
          <footer className="o-footer">
            <span>{footerLeft}</span>
            <span>{footerRight}</span>
          </footer>
        )}
      </section>
    </main>
  );
}

export function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button className="o-iconbtn" onClick={onToggle} aria-label="Toggle theme">
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function LangToggle({ lang, onToggle }: { lang: string; onToggle: () => void }) {
  return (
    <button className="o-iconbtn" style={{ width: 'auto', padding: '0 10px', gap: 5, display: 'flex', fontSize: 12, fontWeight: 700 }} onClick={onToggle}>
      {lang}
      <ChevronDown size={13} />
    </button>
  );
}
