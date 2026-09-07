'use client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const tones = {
  violet: 'var(--chart-1)',
  sky: 'var(--chart-2)',
  orange: 'var(--chart-3)',
  green: 'var(--chart-4)',
  coral: 'var(--chart-5)',
};
type ToneKey = keyof typeof tones;

export type Series = { key: string; label: string; tone: ToneKey };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OrbitTooltip({ active, payload, label, series }: any) {
  if (!active || !payload?.length) return null;
  // Pie/Donut: the slice name is on the payload item (nameKey), not `label`. Show name, value and %.
  const isPie = label == null && (series?.length ?? 0) === 0 && payload[0]?.name != null;
  if (isPie) {
    const p = payload[0];
    const pct = typeof p.percent === 'number' ? ` · ${Math.round(p.percent * 100)}%` : '';
    return (
      <div className="o-tooltip">
        <b>{p.name}</b>
        <span style={{ color: p.payload?.fill ?? p.color }}>{p.value}{pct}</span>
      </div>
    );
  }
  return (
    <div className="o-tooltip">
      {label != null && <b>{label}</b>}
      {payload.map((p: { dataKey: string; name?: string; value: number; color: string }) => {
        const s = series?.find((x: Series) => x.key === p.dataKey);
        return (
          <span key={p.dataKey ?? p.name} style={{ color: p.color }}>
            {s?.label ?? p.name ?? p.dataKey} : {p.value}
          </span>
        );
      })}
    </div>
  );
}

const axis = { fontSize: 11, fill: 'var(--muted-2)' } as const;

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="o-legend">
      {series.map((s) => (
        <span key={s.key}>
          <i style={{ background: tones[s.tone] }} /> {s.label}
        </span>
      ))}
    </div>
  );
}

export function StepLines({ data, series, x = 'x', small }: { data: Record<string, number | string>[]; series: Series[]; x?: string; small?: boolean }) {
  return (
    <div className={`o-chart${small ? ' sm' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<OrbitTooltip series={series} />} cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '4 4' }} />
          {series.map((s, i) => (
            <Area key={s.key} type="stepAfter" dataKey={s.key} stroke={tones[s.tone]} strokeWidth={i === 0 ? 2 : 1.6} fill={i === 0 ? tones[s.tone] : 'transparent'} fillOpacity={0.06} dot={false} activeDot={{ r: 4 }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Bars({ data, dataKey, x = 'x', highlight, small }: { data: Record<string, number | string>[]; dataKey: string; x?: string; highlight?: string; small?: boolean }) {
  return (
    <div className={`o-chart${small ? ' sm' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ ...d, fill: highlight && d[x] === highlight ? tones.violet : 'var(--chart-track)' }))} margin={{ top: 10, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<OrbitTooltip series={[{ key: dataKey, label: dataKey, tone: 'violet' }]} />} cursor={{ fill: 'var(--surface-3)' }} />
          <Bar dataKey={dataKey} radius={[8, 8, 8, 8]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, centerLabel, centerValue }: { data: { name: string; value: number }[]; centerLabel?: string; centerValue?: string }) {
  const palette = [tones.violet, 'var(--chart-track)', 'var(--surface-3)', 'var(--primary-soft-2)', tones.sky];
  return (
    <div className="o-chart" style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data.map((d, i) => ({ ...d, fill: palette[i % palette.length] }))} dataKey="value" nameKey="name" innerRadius="30%" outerRadius="95%" paddingAngle={2} stroke="var(--surface)" strokeWidth={3} />
          <Tooltip content={<OrbitTooltip series={[]} />} />
        </PieChart>
      </ResponsiveContainer>
      {centerValue && (
        <div className="o-donut-center">
          <div style={{ background: 'var(--surface)', borderRadius: '50%', width: 96, height: 96, display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-card)' }}>
            <div>
              <small>{centerLabel}</small>
              <b>{centerValue}</b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
