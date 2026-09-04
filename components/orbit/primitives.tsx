'use client';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, MoreVertical, Plus, TrendingDown, TrendingUp } from 'lucide-react';

export type Tone = 'violet' | 'sky' | 'green' | 'orange' | 'coral' | 'neutral';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Icon = any;

/* ---------- Brand (identity fixed: orbit ring mark + "orbit." wordmark + GROWTH OS) ---------- */
export function OrbitMark({ size = 32, dark }: { size?: number; dark?: boolean }) {
  // Ring mark from the brand board. On dark surfaces the inner dot flips to white, ring stays violet.
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-hidden="true" className="o-mark">
      <circle cx="60" cy="70" r="42" stroke="var(--violet)" strokeWidth="12" />
      <circle cx="52" cy="76" r="12" fill={dark ? '#ffffff' : 'var(--ink)'} className="o-mark-dot" />
      <circle cx="92" cy="40" r="11" fill="var(--violet)" />
      <path d="M108 12l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="var(--orange)" />
    </svg>
  );
}

export function AppIcon({ size = 32 }: { size?: number }) {
  // Dark app-icon tile from the brand board.
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-hidden="true">
      <rect width="128" height="128" rx="32" fill="#171723" />
      <circle cx="60" cy="72" r="32" stroke="#6358E8" strokeWidth="10" />
      <circle cx="54" cy="77" r="9" fill="#FFFFFF" />
      <circle cx="84" cy="49" r="8" fill="#FFFFFF" />
      <path d="M100 22l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#EB9944" />
    </svg>
  );
}

export function Brand({ collapse, size = 'md', tagline = true }: { collapse?: () => void; size?: 'md' | 'sm'; tagline?: boolean }) {
  const sm = size === 'sm';
  return (
    <div className={`o-brand${sm ? ' sm' : ''}`}>
      <OrbitMark size={sm ? 28 : 36} />
      <div className="o-wordmark">
        <span className="o-brand-name">
          orbit<i>.</i>
        </span>
        {tagline && <span className="o-brand-tag">Growth OS</span>}
      </div>
      {collapse && (
        <button className="o-brand-collapse" onClick={collapse} aria-label="Collapse sidebar">
          <ChevronLeft size={16} />
        </button>
      )}
    </div>
  );
}

/* ---------- Buttons ---------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'ai' | 'text';
export function Btn({
  variant = 'primary',
  size,
  block,
  icon: I,
  children,
  ...rest
}: {
  variant?: BtnVariant;
  size?: 'sm';
  block?: boolean;
  icon?: Icon;
  children?: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`o-btn o-btn-${variant}${size ? ` o-btn-${size}` : ''}${block ? ' o-btn-block' : ''}`} {...rest}>
      {I && <I size={variant === 'ghost' ? 14 : 16} />}
      {children}
    </button>
  );
}

export function IconTile({ icon: I, tone = 'neutral', size, iconSize = 16 }: { icon: Icon; tone?: Tone; size?: 'lg' | 'xl'; iconSize?: number }) {
  return (
    <div className={`o-icon-tile ${tone}${size ? ` ${size}` : ''}`}>
      <I size={iconSize} />
    </div>
  );
}

export function Chip({ tone = 'neutral', pill, children }: { tone?: Tone; pill?: boolean; children: ReactNode }) {
  return <span className={`o-chip ${tone}${pill ? ' pill' : ''}`}>{children}</span>;
}

export function Trend({ value }: { value?: number | null }) {
  if (value === undefined || value === null) return <Chip tone="neutral">—</Chip>;
  const up = value >= 0;
  return (
    <Chip tone={up ? 'green' : 'coral'}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}
      {value.toFixed(1)}%
    </Chip>
  );
}

export function MoreBtn() {
  return (
    <button className="o-more" aria-label="More">
      <MoreVertical size={15} />
    </button>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="o-progress">
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={`o-switch${on ? ' on' : ''}`} onClick={() => onChange(!on)} />
  );
}

/* ---------- Cards ---------- */
export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`o-card ${className}`} style={style}>
      {children}
    </section>
  );
}

export function CardHead({ title, sub, action, children }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="o-card-head">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
        {children}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ icon, label, value, trend, tone = 'neutral' }: { icon: Icon; label: string; value: string; trend?: number | null; tone?: Tone }) {
  return (
    <Card className="o-stat">
      <div className="o-stat-top">
        <IconTile icon={icon} tone={tone} />
        <span>{label}</span>
        <MoreBtn />
      </div>
      <div className="o-stat-body">
        <b className="o-stat-value">{value}</b>
        <Trend value={trend} />
      </div>
    </Card>
  );
}

export function Tile({ title, big, left, right, progress }: { title: string; big: string; left?: string; right?: string; progress?: number }) {
  return (
    <div className="o-tile">
      <h3>{title}</h3>
      <b className="o-big">{big}</b>
      {(left || right) && (
        <div className="o-meta">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
      {progress !== undefined && <Progress value={progress} />}
    </div>
  );
}

export function Insight({ icon, title, text }: { icon: Icon; title: string; text: string }) {
  return (
    <div className="o-insight">
      <IconTile icon={icon} />
      <div>
        <b>{title}</b>
        <p>{text}</p>
      </div>
    </div>
  );
}

export function Row({ icon, title, meta, right }: { icon?: Icon; title: string; meta?: string; right?: ReactNode }) {
  return (
    <div className="o-row">
      {icon && <IconTile icon={icon} tone="violet" />}
      <div>
        <b>{title}</b>
        {meta && <small>{meta}</small>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: Icon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="o-empty">
      <IconTile icon={icon} tone="violet" size="lg" iconSize={20} />
      <b>{title}</b>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function ViewAll({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button className="o-btn o-btn-text" onClick={onClick}>
      {label}
    </button>
  );
}

/* ---------- Page header ---------- */
export function PageHead({
  eyebrow,
  title,
  sub,
  spark = true,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  spark?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="o-page-head">
      <div>
        {eyebrow && <p className="o-eyebrow">{eyebrow}</p>}
        <h1>
          {title} {spark && <span>✦</span>}
        </h1>
        {sub && <p className="o-sub">{sub}</p>}
      </div>
      {actions && <div className="o-page-actions">{actions}</div>}
    </div>
  );
}

export function PrimaryAction({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <Btn icon={Plus} onClick={onClick}>
      {label}
    </Btn>
  );
}

/* ---------- Table ---------- */
export function Table({ columns, children }: { columns: ReactNode[]; children: ReactNode }) {
  return (
    <div className="o-table-wrap">
      <table className="o-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Avatar({ text, tone, round, size }: { text: string; tone?: 'coral'; round?: boolean; size?: 'lg' }) {
  return <div className={`o-avatar${tone ? ` ${tone}` : ''}${round ? ' round' : ''}${size ? ` ${size}` : ''}`}>{text}</div>;
}

export function ModuleHero({ icon, title, text }: { icon: Icon; title: string; text: string }) {
  return (
    <Card className="o-hero">
      <IconTile icon={icon} tone="violet" size="xl" iconSize={22} />
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </Card>
  );
}

export { ChevronRight };
