'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  ChevronRight,
  CircleHelp,
  Clock,
  Compass,
  Database,
  Filter,
  Globe2,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  Mail,
  Send,
  Settings2,
  Sparkles,
  Target,
  Users,
  Wifi,
  Workflow,
  Zap,
} from 'lucide-react';
import {
  AppShell,
  Avatar,
  Bars,
  Brand,
  Btn,
  Card,
  CardHead,
  Chip,
  Donut,
  EmptyState,
  IconTile,
  Insight,
  LangToggle,
  Legend,
  ModuleHero,
  MoreBtn,
  PageHead,
  Row,
  StatCard,
  StepLines,
  Table,
  ThemeToggle,
  Tile,
  ViewAll,
  useTheme,
  type NavGroup,
} from '@/components/orbit';

type T = (en: string, ar: string) => string;
type Lead = { company: string; industry: string; signal: 'High intent' | 'Warm' | 'New signal'; time: string; initials: string };
type Campaign = { name: string; status: 'Active' | 'Scheduled' | 'Completed'; sent: number; opens: number };

const signalTone = { 'High intent': 'green', Warm: 'sky', 'New signal': 'orange' } as const;
const statusTone = { Active: 'green', Scheduled: 'violet', Completed: 'neutral' } as const;

export default function Home() {
  const { dark, toggleDark, lang, toggleLang, rtl, t } = useTheme();
  const [active, setActive] = useState(0);
  const [onboard, setOnboard] = useState(false);
  const [workspace, setWorkspace] = useState('My workspace');
  const [form, setForm] = useState({ name: '', company: '', role: 'Founder', website: '', email: '', provider: 'Gmail' });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns] = useState<Campaign[]>([]);
  const [connected, setConnected] = useState<string[]>([]);

  // Hydration-safe: read persisted workspace after mount so SSR and client match.
  /* oxlint-disable react/react-compiler */
  useEffect(() => {
    const w = localStorage.getItem('orbit-workspace');
    if (w) {
      const x = JSON.parse(w);
      setForm(x);
      setWorkspace(x.company || x.name || 'My workspace');
    } else setOnboard(true);
    setConnected(JSON.parse(localStorage.getItem('orbit-integrations') || '[]'));
    setLeads(JSON.parse(localStorage.getItem('orbit-leads') || '[]'));
  }, []);
  /* oxlint-enable react/react-compiler */

  const finish = () => {
    localStorage.setItem('orbit-workspace', JSON.stringify(form));
    setWorkspace(form.company || form.name || 'My workspace');
    setOnboard(false);
  };
  const addLead = () => {
    const next: Lead[] = [{ company: 'New prospect', industry: 'SaaS', signal: 'New signal', time: t('just now', 'الآن'), initials: 'NP' }, ...leads];
    setLeads(next);
    localStorage.setItem('orbit-leads', JSON.stringify(next));
  };
  const toggle = (name: string) => {
    const n = connected.includes(name) ? connected.filter((x) => x !== name) : [...connected, name];
    setConnected(n);
    localStorage.setItem('orbit-integrations', JSON.stringify(n));
  };

  const groups: NavGroup[] = [
    {
      label: t('Workspace', 'مساحة العمل'),
      items: [
        { label: t('Dashboard', 'لوحة التحكم'), icon: LayoutDashboard },
        { label: t('Lead Finder', 'البحث عن العملاء'), icon: Target, badge: leads.length },
        { label: t('CRM', 'إدارة العملاء'), icon: Users },
        { label: t('Campaigns', 'الحملات'), icon: Send },
        { label: t('Automations', 'الأتمتة'), icon: Workflow },
        { label: t('Analytics', 'التحليلات'), icon: BarChart3 },
        { label: t('AI Agents', 'وكلاء الذكاء الاصطناعي'), icon: Bot },
        { label: t('Market Research', 'أبحاث السوق'), icon: Compass },
        { label: t('Integrations', 'التكاملات'), icon: Wifi },
      ],
    },
    {
      label: t('System', 'النظام'),
      items: [
        { label: t('Settings', 'الإعدادات'), icon: Settings2 },
        { label: t('Help center', 'مركز المساعدة'), icon: CircleHelp },
      ],
    },
  ];

  const firstName = form.name?.split(' ')[0] || t('there', 'بك');

  return (
    <>
      <AppShell
        dark={dark}
        rtl={rtl}
        groups={groups}
        active={active}
        onNavigate={setActive}
        workspace={workspace}
        workspaceSub={t('Growth team', 'فريق النمو')}
        user={form.name || t('Workspace owner', 'مالك المساحة')}
        userSub={t('Pro plan', 'الخطة الاحترافية')}
        status={{ title: t('Autopilot is live', 'التشغيل التلقائي نشط'), sub: t('Ready for integrations', 'جاهز للتكاملات') }}
        crumbRoot={t('Workspace', 'مساحة العمل')}
        searchPlaceholder={t('Search here...', 'ابحث هنا...')}
        topActions={
          <>
            <ThemeToggle dark={dark} onToggle={toggleDark} />
            <LangToggle lang={lang} onToggle={toggleLang} />
          </>
        }
        aiLabel={t('Get AI Insight', 'رؤية ذكية')}
        onAi={() => setActive(6)}
        footerLeft={`© 2026 orbit. growth OS`}
        footerRight={
          <>
            {t('Built for focused growth teams', 'مصمم لفرق النمو المركزة')} · <Globe2 size={13} /> {lang}
          </>
        }
      >
        {active === 0 && <Overview t={t} name={firstName} leads={leads} campaigns={campaigns} addLead={addLead} go={setActive} />}
        {active === 1 && <LeadFinder t={t} leads={leads} addLead={addLead} />}
        {active === 2 && <SimpleModule t={t} title={t('CRM', 'إدارة العملاء')} icon={Users} text={t('Manage contacts, stages, notes and next actions.', 'إدارة جهات الاتصال والمراحل والملاحظات والإجراءات التالية.')} />}
        {active === 3 && <Campaigns t={t} campaigns={campaigns} />}
        {active === 4 && <SimpleModule t={t} title={t('Automations', 'الأتمتة')} icon={Workflow} text={t('Trigger sequences, follow-ups and CRM updates automatically.', 'تشغيل التسلسلات والمتابعات وتحديثات CRM تلقائياً.')} />}
        {active === 5 && <SimpleModule t={t} title={t('Analytics', 'التحليلات')} icon={BarChart3} text={t('Track delivery, opens, replies and pipeline attribution.', 'تتبع التسليم والفتح والردود وإسناد خط الأنابيب.')} />}
        {active === 6 && <SimpleModule t={t} title={t('AI Agents', 'وكلاء الذكاء الاصطناعي')} icon={Bot} text={t('Choose a provider and model for research, outreach and CRM actions.', 'اختر المزوّد والنموذج للبحث والتواصل وإجراءات CRM.')} />}
        {active === 7 && <SimpleModule t={t} title={t('Market Research', 'أبحاث السوق')} icon={Compass} text={t('Search public web, YouTube, GitHub, RSS and configured channels.', 'ابحث في الويب العام ويوتيوب وجيت هاب وRSS والقنوات المهيأة.')} />}
        {active === 8 && <Integrations t={t} connected={connected} toggle={toggle} />}
        {active === 9 && <SimpleModule t={t} title={t('Settings', 'الإعدادات')} icon={Settings2} text={t('Workspace, members, billing and security.', 'مساحة العمل والأعضاء والفوترة والأمان.')} />}
        {active === 10 && <SimpleModule t={t} title={t('Help center', 'مركز المساعدة')} icon={CircleHelp} text={t('Guides, shortcuts and support.', 'الأدلة والاختصارات والدعم.')} />}
      </AppShell>
      {onboard && <Onboarding t={t} form={form} setForm={setForm} finish={finish} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
function Overview({ t, name, leads, campaigns, addLead, go }: { t: T; name: string; leads: Lead[]; campaigns: Campaign[]; addLead: () => void; go: (i: number) => void }) {
  const sent = campaigns.reduce((a, c) => a + c.sent, 0);
  const opens = campaigns.reduce((a, c) => a + c.opens, 0);
  const openRate = sent ? `${((opens / sent) * 100).toFixed(1)}%` : '—';
  const series = [
    { key: 'opens', label: t('Opens', 'الفتح'), tone: 'violet' as const },
    { key: 'clicks', label: t('Clicks', 'النقرات'), tone: 'sky' as const },
    { key: 'conversions', label: t('Conversions', 'التحويلات'), tone: 'orange' as const },
  ];
  const perf = useMemo(() => (campaigns.length ? campaigns.map((c) => ({ x: c.name, opens: c.opens, clicks: 0, conversions: 0 })) : []), [campaigns]);
  const types = useMemo(() => {
    const m = new Map<string, number>();
    campaigns.forEach((c) => m.set(c.status, (m.get(c.status) || 0) + 1));
    return [...m].map(([name, value]) => ({ name, value }));
  }, [campaigns]);
  const growth = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach((l) => m.set(l.industry, (m.get(l.industry) || 0) + 1));
    return [...m].map(([x, leads]) => ({ x, leads }));
  }, [leads]);

  return (
    <>
      <PageHead
        title={t(`Welcome back, ${name}!`, `مرحباً بعودتك، ${name}!`)}
        spark={false}
        sub={t("Welcome back! Here's what's happening today.", 'مرحباً بعودتك! إليك ما يحدث اليوم.')}
        actions={
          <>
            <Btn variant="secondary" onClick={() => go(3)}>
              {t('New Campaign', 'حملة جديدة')}
            </Btn>
            <Btn onClick={() => go(4)}>{t('Create Automation', 'إنشاء أتمتة')}</Btn>
          </>
        }
      />

      <div className="o-grid o-grid-4">
        <StatCard icon={Send} label={t('Total Campaigns', 'إجمالي الحملات')} value={String(campaigns.length)} trend={null} />
        <StatCard icon={Users} label={t('Active Contacts', 'جهات الاتصال النشطة')} value={leads.length.toLocaleString()} trend={null} />
        <StatCard icon={Activity} label={t('Avg. Open Rate', 'متوسط معدل الفتح')} value={openRate} trend={null} />
        <StatCard icon={Zap} label={t('Pipeline (MTD)', 'خط الأنابيب (الشهر)')} value="$0" trend={null} />
      </div>

      <div className="o-grid o-grid-main">
        <Card>
          <CardHead title={t('Campaign Performance', 'أداء الحملات')} sub={t('Last 30 days overview', 'نظرة على آخر ٣٠ يوماً')} action={<Legend series={series} />} />
          {perf.length ? (
            <StepLines data={perf} series={series} />
          ) : (
            <EmptyState icon={BarChart3} title={t('No campaign data yet', 'لا توجد بيانات حملات بعد')} text={t('Send your first campaign and opens, clicks and conversions will appear here.', 'أرسل حملتك الأولى وستظهر هنا بيانات الفتح والنقر والتحويل.')} action={<Btn variant="secondary" size="sm" onClick={() => go(3)}>{t('Create campaign', 'إنشاء حملة')}</Btn>} />
          )}
        </Card>
        <Card>
          <CardHead title={t('Campaign Types', 'أنواع الحملات')} sub={t('Distribution', 'التوزيع')} />
          {types.length ? (
            <Donut data={types} centerLabel={types[0].name} centerValue={`${Math.round((types[0].value / campaigns.length) * 100)}%`} />
          ) : (
            <EmptyState icon={Compass} title={t('Nothing to distribute', 'لا يوجد ما يُوزّع')} text={t('Campaign types show up once you have at least one campaign.', 'تظهر الأنواع عند وجود حملة واحدة على الأقل.')} />
          )}
        </Card>
        <Card>
          <CardHead title={t('Top Automations', 'أفضل الأتمتة')} sub={t('Best performers', 'الأعلى أداءً')} action={<ViewAll label={t('View All', 'عرض الكل')} onClick={() => go(4)} />} />
          <Tile title={t('Welcome Series', 'سلسلة الترحيب')} big="—" left={t('0 triggered', '٠ مُشغّل')} right={t('0 completed', '٠ مكتمل')} progress={0} />
          <Tile title={t('Re-engagement', 'إعادة التفاعل')} big="—" left={t('0 triggered', '٠ مُشغّل')} right={t('0 completed', '٠ مكتمل')} progress={0} />
        </Card>
      </div>

      <div className="o-grid o-grid-wide">
        <Card>
          <CardHead title={t('Audience Growth', 'نمو الجمهور')} sub={t('Leads by industry', 'العملاء حسب المجال')} action={<Btn variant="ghost" icon={Filter}>{t('Filter', 'تصفية')}</Btn>} />
          {growth.length ? <Bars data={growth} dataKey="leads" highlight={growth[0].x} /> : <EmptyState icon={Users} title={t('No audience yet', 'لا يوجد جمهور بعد')} text={t('Run Lead Finder to start building your audience.', 'شغّل البحث عن العملاء لبدء بناء جمهورك.')} action={<Btn variant="secondary" size="sm" onClick={addLead}>{t('Find leads', 'ابحث عن عملاء')}</Btn>} />}
        </Card>
        <Card>
          <CardHead title={t('Recent Campaigns', 'أحدث الحملات')} action={<ViewAll label={t('View All', 'عرض الكل')} onClick={() => go(3)} />} />
          <CampaignTable t={t} campaigns={campaigns.slice(0, 4)} />
        </Card>
        <Card>
          <CardHead title={t('AI Insights', 'رؤى الذكاء الاصطناعي')} />
          <Insight icon={Clock} title={t('Best Send Time', 'أفضل وقت للإرسال')} text={t('Available after your first 100 sends.', 'متاح بعد أول ١٠٠ إرسال.')} />
          <Insight icon={Lightbulb} title={t('Subject Line Tip', 'نصيحة عنوان الرسالة')} text={t('Connect a mailbox to unlock suggestions.', 'اربط صندوق بريد لتفعيل الاقتراحات.')} />
          <div className="o-mt">
            <Btn variant="ai" icon={Sparkles} block onClick={() => go(6)}>
              {t('Open AI Assistant', 'فتح المساعد الذكي')}
            </Btn>
          </div>
        </Card>
      </div>

      <div className="o-grid o-grid-2">
        <Card>
          <CardHead title={t('Lead activity', 'نشاط العملاء')} sub={t('Latest prospects added to your queue.', 'أحدث العملاء المضافين إلى قائمتك.')} action={<ViewAll label={t('View All', 'عرض الكل')} onClick={() => go(1)} />} />
          <LeadTable t={t} leads={leads.slice(0, 5)} onAdd={addLead} />
        </Card>
        <Card>
          <CardHead title={t('Autopilot activity', 'نشاط التشغيل التلقائي')} sub={t('orbit. is working while you focus.', 'orbit. يعمل بينما تركز أنت.')} action={<Chip tone="green" pill>ON</Chip>} />
          {leads.length ? (
            <>
              <Row icon={Compass} title={t(`Found ${leads.length} new leads`, `تم العثور على ${leads.length} عميلاً`)} meta={leads[0].time} right={<Chip tone="green">✓</Chip>} />
              <Row icon={Mail} title={t('Waiting for a connected mailbox', 'بانتظار ربط صندوق بريد')} meta={t('Connect Gmail or SMTP', 'اربط Gmail أو SMTP')} right={<Chip tone="orange">{t('Pending', 'معلّق')}</Chip>} />
              <Row icon={Database} title={t('CRM sync ready', 'مزامنة CRM جاهزة')} meta={t('No records changed', 'لا توجد سجلات متغيرة')} right={<Chip tone="neutral">—</Chip>} />
            </>
          ) : (
            <EmptyState icon={Bot} title={t('Autopilot is idle', 'التشغيل التلقائي في وضع الانتظار')} text={t('Activity appears here as agents find leads, send follow-ups and update records.', 'يظهر النشاط هنا عندما يجد الوكلاء عملاء ويرسلون متابعات ويحدّثون السجلات.')} />
          )}
        </Card>
      </div>
    </>
  );
}

function CampaignTable({ t, campaigns }: { t: T; campaigns: Campaign[] }) {
  if (!campaigns.length) return <EmptyState icon={Inbox} title={t('No campaigns yet', 'لا توجد حملات بعد')} text={t('Your sent and scheduled campaigns will be listed here.', 'ستُعرض هنا حملاتك المرسلة والمجدولة.')} />;
  return (
    <Table columns={[t('Campaign', 'الحملة'), t('Status', 'الحالة'), t('Sent', 'المرسل'), t('Opens', 'الفتح'), '']}>
      {campaigns.map((c) => (
        <tr key={c.name}>
          <td>{c.name}</td>
          <td>
            <Chip tone={statusTone[c.status]}>{c.status}</Chip>
          </td>
          <td>{c.sent.toLocaleString()}</td>
          <td>{c.opens.toLocaleString()}</td>
          <td>
            <MoreBtn />
          </td>
        </tr>
      ))}
    </Table>
  );
}

function LeadTable({ t, leads, onAdd }: { t: T; leads: Lead[]; onAdd: () => void }) {
  if (!leads.length) return <EmptyState icon={Target} title={t('No leads yet', 'لا يوجد عملاء بعد')} text={t('Run Lead Finder to add qualified prospects to your queue.', 'شغّل البحث عن العملاء لإضافة عملاء مؤهلين إلى قائمتك.')} action={<Btn size="sm" onClick={onAdd}>{t('Find leads', 'ابحث عن عملاء')}</Btn>} />;
  return (
    <Table columns={[t('Company', 'الشركة'), t('Industry', 'المجال'), t('Signal', 'الإشارة'), t('Added', 'أضيف'), '']}>
      {leads.map((x) => (
        <tr key={x.company + x.time}>
          <td>
            <div className="o-company">
              <Avatar text={x.initials} />
              {x.company}
            </div>
          </td>
          <td>{x.industry}</td>
          <td>
            <Chip tone={signalTone[x.signal]}>{x.signal}</Chip>
          </td>
          <td>{x.time}</td>
          <td>
            <MoreBtn />
          </td>
        </tr>
      ))}
    </Table>
  );
}

function LeadFinder({ t, leads, addLead }: { t: T; leads: Lead[]; addLead: () => void }) {
  return (
    <>
      <PageHead eyebrow={<><span className="o-live-dot" /> {t('Live', 'مباشر')} · {t('Workspace module', 'وحدة مساحة العمل')}</>} title={t('Lead Finder', 'البحث عن العملاء')} sub={t('Review and add qualified prospects to your CRM.', 'راجع العملاء المؤهلين وأضفهم إلى CRM.')} actions={<Btn icon={Target} onClick={addLead}>{t('Find leads', 'ابحث عن عملاء')}</Btn>} />
      <div className="o-grid o-grid-3">
        <StatCard icon={Target} label={t('In queue', 'في القائمة')} value={String(leads.length)} trend={null} tone="violet" />
        <StatCard icon={Activity} label={t('High intent', 'نية عالية')} value={String(leads.filter((l) => l.signal === 'High intent').length)} trend={null} tone="green" />
        <StatCard icon={Users} label={t('Added to CRM', 'أُضيف إلى CRM')} value="0" trend={null} tone="sky" />
      </div>
      <Card>
        <CardHead title={t('Lead queue', 'قائمة العملاء')} sub={t('Sources include URL, timestamp, channel and consent status.', 'تشمل المصادر الرابط والوقت والقناة وحالة الموافقة.')} action={<Chip tone="green" pill>{leads.length} {t('ready', 'جاهز')}</Chip>} />
        <LeadTable t={t} leads={leads} onAdd={addLead} />
      </Card>
    </>
  );
}

function Campaigns({ t, campaigns }: { t: T; campaigns: Campaign[] }) {
  return (
    <>
      <PageHead title={t('Campaigns', 'الحملات')} sub={t('Create sequences, schedule follow-ups and monitor replies.', 'أنشئ التسلسلات وجدول المتابعات وراقب الردود.')} actions={<Btn icon={Send}>{t('New Campaign', 'حملة جديدة')}</Btn>} />
      <div className="o-grid o-grid-4">
        <StatCard icon={Send} label={t('Total', 'الإجمالي')} value={String(campaigns.length)} trend={null} />
        <StatCard icon={Activity} label={t('Active', 'نشطة')} value={String(campaigns.filter((c) => c.status === 'Active').length)} trend={null} tone="green" />
        <StatCard icon={Clock} label={t('Scheduled', 'مجدولة')} value={String(campaigns.filter((c) => c.status === 'Scheduled').length)} trend={null} tone="violet" />
        <StatCard icon={Inbox} label={t('Completed', 'مكتملة')} value={String(campaigns.filter((c) => c.status === 'Completed').length)} trend={null} tone="sky" />
      </div>
      <Card>
        <CardHead title={t('All campaigns', 'كل الحملات')} />
        <CampaignTable t={t} campaigns={campaigns} />
      </Card>
    </>
  );
}

function Integrations({ t, connected, toggle }: { t: T; connected: string[]; toggle: (x: string) => void }) {
  const items = [
    ['Gmail', Mail, t('OAuth inbox sync and email sending', 'مزامنة البريد والإرسال عبر OAuth')],
    ['SMTP Server', Send, t('Transactional email through your server', 'بريد معاملات عبر خادمك')],
    ['Webhooks', Zap, t('Push events to your automation stack', 'إرسال الأحداث إلى منظومة الأتمتة')],
    ['Lead provider', Database, t('Lead sources and enrichment', 'مصادر العملاء والإثراء')],
  ] as const;
  return (
    <>
      <PageHead title={t('Integrations', 'التكاملات')} sub={t('Connect services with explicit approval. Credentials stay local.', 'اربط الخدمات بموافقة صريحة. بيانات الاعتماد تبقى محلياً.')} actions={<Btn icon={Mail} onClick={() => toggle('Gmail')}>{t('Connect Gmail', 'ربط Gmail')}</Btn>} />
      <div className="o-grid o-grid-2">
        {items.map(([name, I, detail]) => {
          const on = connected.includes(name);
          return (
            <Card key={name} className="o-integration">
              <IconTile icon={I} tone="violet" size="lg" iconSize={20} />
              <div>
                <h2>{name}</h2>
                <p>{detail}</p>
              </div>
              <Chip tone={on ? 'green' : 'neutral'} pill>{on ? t('Connected', 'متصل') : t('Ready', 'جاهز')}</Chip>
              <Btn variant={on ? 'secondary' : 'primary'} size="sm" onClick={() => toggle(name)}>
                {on ? t('Disconnect', 'فصل') : t('Connect', 'اتصال')}
              </Btn>
            </Card>
          );
        })}
      </div>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SimpleModule({ t, title, icon, text }: { t: T; title: string; icon: any; text: string }) {
  return (
    <>
      <PageHead eyebrow={t('Workspace module', 'وحدة مساحة العمل')} title={title} sub={text} actions={<Btn icon={Sparkles}>{t('Create new', 'إنشاء جديد')}</Btn>} />
      <ModuleHero icon={icon} title={t(`${title} is ready for your workflow`, `${title} جاهزة لسير عملك`)} text={t('This module starts empty until you connect a source or add a record.', 'تبدأ هذه الوحدة فارغة حتى تربط مصدراً أو تضيف سجلاً.')} />
      <div className="o-grid o-grid-3">
        <StatCard icon={Activity} label={t('Active workflows', 'سير العمل النشط')} value="0" trend={null} tone="violet" />
        <StatCard icon={Zap} label={t('Completed today', 'المكتمل اليوم')} value="0" trend={null} tone="green" />
        <StatCard icon={Users} label={t('Records synced', 'السجلات المتزامنة')} value="0" trend={null} tone="sky" />
      </div>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Onboarding({ t, form, setForm, finish }: { t: T; form: any; setForm: any; finish: () => void }) {
  const fields = [
    ['name', t('Your name', 'اسمك'), 'Ahmed Mohamed'],
    ['company', t('Company / workspace', 'الشركة / مساحة العمل'), 'Acme'],
    ['website', t('Company website', 'موقع الشركة'), 'https://acme.com'],
    ['email', t('Work email', 'بريد العمل'), 'you@company.com'],
  ];
  return (
    <div className="o-backdrop">
      <div className="o-modal">
        <div className="o-banner">
          <Brand size="sm" />
          <Sparkles size={18} className="o-spark" />
          <i className="o-planet" />
          <span className="o-banner-copy">{t('Discover, engage, learn, repeat.', 'اكتشف، تواصل، تعلّم، كرّر.')}</span>
        </div>
        <div className="o-modal-top">
          <span className="o-eyebrow" style={{ margin: 0 }}>{t('Setup', 'الإعداد')}</span>
          <span>1 / 3</span>
        </div>
        <div className="o-progress" style={{ marginBottom: 24 }}>
          <i style={{ width: '33%' }} />
        </div>
        <p className="o-eyebrow">{t('Welcome to orbit.', 'مرحباً بك في orbit.')}</p>
        <h2>{t('Let’s set up your growth workspace', 'لنجهّز مساحة النمو الخاصة بك')}</h2>
        <p className="o-sub">{t('These details help orbit. find better leads, personalize outreach, and organize your CRM.', 'هذه المعلومات تساعد orbit. على إيجاد عملاء أفضل وتخصيص الرسائل وتنظيم CRM.')}</p>
        <div className="o-form-grid">
          {fields.map(([k, label, ph]) => (
            <label className="o-field" key={k}>
              {label}
              <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={ph} />
            </label>
          ))}
          <label className="o-field">
            {t('Role', 'الدور')}
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option>Founder</option>
              <option>Growth lead</option>
              <option>Sales</option>
              <option>Marketing</option>
            </select>
          </label>
        </div>
        <div className="o-modal-split">
          <div>
            <b>{t('Connect email now', 'اربط البريد الآن')}</b>
            <small>{t('Optional. Gmail or SMTP can be connected later.', 'اختياري. يمكن ربط Gmail أو SMTP لاحقاً.')}</small>
          </div>
          <Btn variant={form.provider === 'Gmail' ? 'secondary' : 'ghost'} size="sm" icon={Mail} onClick={() => setForm({ ...form, provider: 'Gmail' })}>
            Gmail
          </Btn>
          <Btn variant={form.provider === 'SMTP' ? 'secondary' : 'ghost'} size="sm" onClick={() => setForm({ ...form, provider: 'SMTP' })}>
            SMTP
          </Btn>
        </div>
        <div className="o-modal-foot">
          <Btn onClick={finish}>
            {t('Create workspace', 'إنشاء مساحة العمل')} <ChevronRight size={16} />
          </Btn>
        </div>
      </div>
    </div>
  );
}
