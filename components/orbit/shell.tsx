'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Bell, Briefcase, Check, ChevronDown, ChevronRight, Menu, Moon, MoreHorizontal, Search, Sparkles, Sun } from 'lucide-react';
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
  notifications,
  unread,
  onNotificationsOpen,
  onNotificationClick,
  onNotificationsClear,
  jobs,
  mode,
  onModeChange,
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
  notifications?: { id: string; at: string; kind: string; title: string; text: string; read: boolean; link?: string | null }[];
  unread?: number;
  onNotificationsOpen?: () => void;
  onNotificationClick?: (n: { id: string; link?: string | null }) => void;
  onNotificationsClear?: () => void;
  jobs?: ReactNode;
  mode?: string;
  onModeChange?: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem('orbit.sidebarCollapsed') === '1'); } catch { /* ignore */ } }, []);
  const toggleCollapse = () => setCollapsed((c) => { const n = !c; try { localStorage.setItem('orbit.sidebarCollapsed', n ? '1' : '0'); } catch { /* ignore */ } return n; });
  const flat = groups.flatMap((g) => g.items);
  let idx = 0;
  const isJobs = mode === 'jobs';
  return (
    <main className={`o-app${dark ? ' dark' : ''}${collapsed ? ' o-collapsed' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
      <aside className="o-sidebar">
        <Brand collapse={toggleCollapse} />
        <div className="o-workspace-wrap">
          <button className="o-workspace" onClick={() => onModeChange && setModeOpen((v) => !v)} aria-label="Switch mode" title={onModeChange ? 'Switch mode' : undefined}>
            <AppIcon size={30} />
            <div>
              <b>{workspace}</b>
              <small>{workspaceSub}</small>
            </div>
            {onModeChange && <ChevronDown size={15} className={`o-muted o-ws-caret${modeOpen ? ' open' : ''}`} />}
          </button>
          {modeOpen && onModeChange && (
            <>
              <div className="o-ws-backdrop" onClick={() => setModeOpen(false)} />
              <div className="o-ws-menu">
                <div className="o-ws-menu-label">Workspace mode</div>
                <button className={`o-ws-opt${!isJobs ? ' active' : ''}`} onClick={() => { setModeOpen(false); if (isJobs) onModeChange('startup'); }}>
                  <Sparkles size={16} />
                  <div><b>Grow a business</b><span>Leads, research, outreach, campaigns</span></div>
                  {!isJobs && <Check size={15} className="o-ws-check" />}
                </button>
                <button className={`o-ws-opt${isJobs ? ' active' : ''}`} onClick={() => { setModeOpen(false); if (!isJobs) onModeChange('jobs'); }}>
                  <Briefcase size={16} />
                  <div><b>Find a job</b><span>Résumé, jobs, applications, follow-ups</span></div>
                  {isJobs && <Check size={15} className="o-ws-check" />}
                </button>
              </div>
            </>
          )}
        </div>
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.label && <div className="o-nav-label">{g.label}</div>}
            <nav className="o-nav">
              {g.items.map((it) => {
                const i = idx++;
                const I = it.icon;
                return (
                  <button key={it.label} title={it.label} className={`o-nav-item${active === i ? ' active' : ''}`} onClick={() => onNavigate(i)}>
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
            {jobs}
            <div className="o-bell-wrap">
              <button className="o-iconbtn" aria-label="Notifications" onClick={() => { setOpen(!open); if (!open) onNotificationsOpen?.(); }}>
                <Bell size={17} />
                {unread ? <em className="o-bell-count">{unread > 9 ? '9+' : unread}</em> : null}
              </button>
              {open && (
                <div className="o-bell-menu">
                  <div className="o-between" style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                    <b style={{ fontSize: 13 }}>Notifications</b>
                    <button className="o-btn o-btn-text" style={{ fontSize: 12 }} onClick={() => { onNotificationsClear?.(); }}>Clear</button>
                  </div>
                  <div className="o-bell-list">
                    {(notifications || []).length ? [...(notifications || [])].reverse().slice(0, 20).map((n) => (
                      <button key={n.id} className={`o-bell-item${n.read ? '' : ' unread'}`} onClick={() => { onNotificationClick?.(n); setOpen(false); }}>
                        <b>{n.title}</b>
                        <span>{n.text}</span>
                        <small>{new Date(n.at).toLocaleString()}</small>
                      </button>
                    )) : <div className="o-muted" style={{ padding: 16, fontSize: 12 }}>No notifications yet</div>}
                  </div>
                </div>
              )}
            </div>
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
