import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { siAnthropic, siFacebook, siGooglegemini, siInstagram, siMistralai, siOpenrouter, siReddit, siTiktok, siX, siYoutube } from 'simple-icons';
import { Activity, BarChart3, Bot, Briefcase, Check, ChevronRight, Clock, Compass, Copy, Download, ExternalLink, FileCheck, FileText, GitCompare, Globe2, History, Inbox, KeyRound, Lightbulb, MapPin, Radio, Mail, MessageSquare, Plug, RefreshCw, Search, Send, Settings2, Shield, Sparkles, Target, Trash2, Upload, Users, X, Zap } from 'lucide-react';
import {
  AppShell,
  Avatar,
  Btn,
  Card,
  CardHead,
  Chip,
  EmptyState,
  IconTile,
  LangToggle,
  Bars,
  Donut,
  MoreBtn,
  StepLines,
  Legend,
  Insight,
  Brand,
  PageHead,
  Progress,
  Row,
  StatCard,
  Switch,
  Table,
  Tile,
  ViewAll,
  ThemeToggle,
  useTheme,
  type Icon,
  type NavGroup,
  type Tone,
} from '@/components/orbit';


type T = (en: string, ar: string) => string;
let __seq = 0;
function jobSeq() { __seq += 1; return `${__seq}-${Math.random().toString(36).slice(2, 8)}`; }
const TAB = { dashboard: 0, leads: 1, research: 2, social: 3, outreach: 4, templates: 5, crm: 6, campaigns: 7, integrations: 8, history: 9, settings: 10, logs: 11 } as const;

export default function DesktopApp() {
  const { dark, toggleDark, lang, toggleLang, rtl, t } = useTheme();
  const [tab, setTab] = useState(0);
  const [ws, setWs] = useState<WsSummary | null>(null);
  const jobsMode = ws?.mode === 'jobs';
  const reloadWs = async () => { try { setWs(await invoke<WsSummary>('workspace_get')); } catch { /* first run */ } };
  /* oxlint-disable react/react-compiler -- load the workspace once; refresh when the tab changes */
  useEffect(() => { void reloadWs(); }, [tab]);
  /* oxlint-enable react/react-compiler */
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [guideStep, setGuideStep] = useState(0);
  const [job, setJob] = useState<{ id: string; label: string; percent: number; index?: number; total?: number; done?: boolean } | null>(null);
  const jobUnlisten = useRef<UnlistenFn | null>(null);
  const startAutodraft = async () => {
    const id = `autodraft-${Date.now()}`;
    try { if (!(await isPermissionGranted())) await requestPermission(); } catch { /* ignore */ }
    jobUnlisten.current?.();
    jobUnlisten.current = await listen<Record<string, unknown>>(`jobs://${id}`, (ev) => {
      const e = ev.payload as { type: string; percent?: number; label?: string; index?: number; total?: number; done?: number; failed?: number; provider?: string; rpm?: number };
      if (e.type === 'start') setJob({ id, label: t(`Auto-drafting ${e.total} contacts via ${e.provider} (${e.rpm}/min)`, `صياغة تلقائية لـ ${e.total} جهة عبر ${e.provider} (${e.rpm}/دقيقة)`), percent: 0, total: e.total });
      else if (e.type === 'progress' || e.type === 'item') setJob({ id, label: e.label || '', percent: e.percent ?? 0, index: e.index, total: e.total });
      else if (e.type === 'done' || e.type === 'cancelled') { setJob({ id, label: e.type === 'done' ? t(`${e.done} drafts ready`, `${e.done} مسودة جاهزة`) : t('Cancelled', 'أُلغي'), percent: 100, done: true }); jobUnlisten.current?.(); jobUnlisten.current = null; void reloadWs(); setTimeout(() => setJob((j) => (j?.id === id ? null : j)), 8000); }
    });
    try { await invoke('outreach_autodraft_start', { jobId: id, limit: 50 }); } catch (e) { setJob({ id, label: String(e), percent: 100, done: true }); }
  };
  const unread = ws?.workspace.notifications?.filter((n) => !n.read).length || 0;
  const [guideHidden, setGuideHidden] = useState(false);
  const endDemo = async () => { try { await invoke('workspace_demo_clear'); } finally { setGuideHidden(true); setGuideStep(0); setTab(TAB.dashboard); await reloadWs(); } };
  const openSavedRun = (id: string, mode: string) => { setOpenRun(id); if (mode === 'jobs') setTab(2 /* JT.find */); else setTab(mode === 'research' ? TAB.research : mode === 'reddit' ? TAB.social : TAB.leads); };
  const [outreachSeed, setOutreachSeed] = useState<Lead[] | null>(null);
  const sendToOutreach = (leads: Lead[]) => { setOutreachSeed(leads); setTab(TAB.outreach); };
  const [agentic, setAgentic] = useState(() => localStorage.getItem('orbit.agenticMode') !== 'off');
  const [connected, setConnected] = useState<string[]>(() => JSON.parse(localStorage.getItem('orbit.connected') || '[]'));

  const groups: NavGroup[] = jobsMode ? [
    {
      label: t('Job search', 'البحث عن عمل'),
      items: [
        { label: t('Dashboard', 'لوحة التحكم'), icon: BarChart3 },
        { label: t('Resume & ATS', 'السيرة والـ ATS'), icon: FileCheck },
        { label: t('Find Jobs', 'ابحث عن وظائف'), icon: Briefcase },
        { label: t('Applications', 'التقديمات'), icon: Send },
        { label: t('Job Map', 'خريطة الوظائف'), icon: Globe2 },
        { label: t('Integrations', 'التكاملات'), icon: Plug },
        { label: t('History', 'السجل'), icon: History },
      ],
    },
    { label: t('System', 'النظام'), items: [{ label: t('Settings', 'الإعدادات'), icon: Settings2 }, { label: t('Log Center', 'مركز السجلات'), icon: Activity }] },
  ] : [
    {
      label: t('Workspace', 'مساحة العمل'),
      items: [
        { label: t('Dashboard', 'لوحة التحكم'), icon: BarChart3 },
        { label: t('Lead Finder', 'البحث عن العملاء'), icon: Search },
        { label: t('Market Research', 'أبحاث السوق'), icon: Compass },
        { label: t('Social Media', 'وسائل التواصل'), icon: Radio },
        { label: t('Outreach', 'التواصل'), icon: MessageSquare },
        { label: t('Templates', 'القوالب'), icon: FileText },
        { label: t('CRM', 'إدارة العملاء'), icon: Users },
        { label: t('Campaigns', 'الحملات'), icon: Send },
        { label: t('Integrations', 'التكاملات'), icon: Plug },
        { label: t('History', 'سجل البحث'), icon: History },
      ],
    },
    { label: t('System', 'النظام'), items: [{ label: t('Settings', 'الإعدادات'), icon: Settings2 }, { label: t('Log Center', 'مركز السجلات'), icon: Activity }] },
  ];
  const JT = { dashboard: 0, resume: 1, find: 2, applications: 3, map: 4, integrations: 5, history: 6, settings: 7, logs: 8 } as const;

  return (
    <>
    <AppShell
      dark={dark}
      rtl={rtl}
      groups={groups}
      active={tab}
      onNavigate={setTab}
      workspace={ws?.workspace.profile.company || t('My workspace', 'مساحة عملي')}
      workspaceSub={ws ? `${ws.progress.percent}% ${t('set up', 'مكتمل')} · ${ws.workspace.id}` : t('Growth team', 'فريق النمو')}
      user={ws?.workspace.profile.name || t('Workspace owner', 'مالك المساحة')}
      userSub={ws?.workspace.profile.role || t('Desktop', 'سطح المكتب')}
      status={{ title: t('Agentic mode ready', 'الوضع الوكيلي جاهز'), sub: t('Approval required for external actions', 'الإجراءات الخارجية تتطلب موافقة') }}
      crumbRoot={t('Workspace', 'مساحة العمل')}
      searchPlaceholder={t('Search workspace...', 'ابحث في مساحة العمل...')}
      topActions={
        <>
          <ThemeToggle dark={dark} onToggle={toggleDark} />
          <LangToggle lang={lang} onToggle={toggleLang} />
        </>
      }
      notifications={ws?.workspace.notifications || []}
      unread={unread}
      onNotificationsOpen={() => { void invoke('notifications_mark', { ids: [], read: true }).then(() => reloadWs()); }}
      onNotificationClick={(n) => { if (n.link === 'outreach') setTab(TAB.outreach); else if (n.link === 'history') setTab(TAB.history); }}
      onNotificationsClear={() => { void invoke('notifications_mark', { ids: [], read: true, clear: true }).then(() => reloadWs()); }}
      jobs={job ? <div className={`o-job${job.done ? ' done' : ''}`} title={job.label}><span className={`o-spinner${job.done ? ' done' : ''}`} /><span className="o-job-label">{job.label}</span><b>{job.percent}%</b>{!job.done && <button onClick={() => void invoke('job_cancel', { jobId: job.id })} aria-label="Cancel">✕</button>}</div> : null}
      mode={ws?.mode || 'startup'}
      onModeChange={(m) => { if (!ws) return; setTab(0); void invoke('workspace_save', { workspace: { ...ws.workspace, mode: m } }).then(() => reloadWs()); }}
    >
      {!jobsMode && (<>
      {tab === TAB.dashboard && <Dashboard t={t} go={setTab} ws={ws} onAutodraft={startAutodraft} jobRunning={!!job && !job.done} />}
      {tab === TAB.leads && <LeadFinder t={t} openRunId={openRun} onOpened={() => setOpenRun(null)} onOutreach={sendToOutreach} />}
      {tab === TAB.crm && <CrmPage t={t} go={setTab} />}
      {tab === TAB.campaigns && <CampaignsPage t={t} />}
      {tab === TAB.outreach && <Outreach t={t} seed={outreachSeed} onSeeded={() => setOutreachSeed(null)} />}
      {tab === TAB.templates && <TemplatesPage t={t} />}
      {tab === TAB.research && <LeadFinder t={t} mode="research" openRunId={openRun} onOpened={() => setOpenRun(null)} onOutreach={sendToOutreach} />}
      {tab === TAB.social && <SocialPage t={t} openRunId={openRun} onOpened={() => setOpenRun(null)} />}
      {tab === TAB.integrations && <Integrations t={t} connected={connected} setConnected={setConnected} />}
      {tab === TAB.history && <HistoryPage t={t} onOpen={openSavedRun} />}
      {tab === TAB.settings && <WorkspacePage t={t} ws={ws} reload={reloadWs} />}
      {tab === TAB.logs && <LogCenterPage t={t} />}
      </>)}
      {jobsMode && tab === JT.dashboard && <JobsDashboard t={t} ws={ws} go={setTab} />}
      {jobsMode && tab === JT.resume && <ResumePage t={t} ws={ws} reload={reloadWs} />}
      {jobsMode && tab === JT.find && <JobFinder t={t} openRunId={openRun} onOpened={() => setOpenRun(null)} />}
      {jobsMode && tab === JT.applications && <ApplicationsPage t={t} ws={ws} />}
      {jobsMode && tab === JT.map && <JobMapPage t={t} />}
      {jobsMode && tab === JT.integrations && <Integrations t={t} connected={connected} setConnected={setConnected} />}
      {jobsMode && tab === JT.history && <HistoryPage t={t} onOpen={openSavedRun} />}
      {jobsMode && tab === JT.settings && <WorkspacePage t={t} ws={ws} reload={reloadWs} />}
      {jobsMode && tab === JT.logs && <LogCenterPage t={t} />}

    </AppShell>
      {ws && !ws.workspace.onboarding.completed && <Onboarding t={t} ws={ws} done={reloadWs} />}
      {ws?.workspace.onboarding.completed && ws.workspace.demo && !guideHidden && <Guide t={t} step={guideStep} setStep={setGuideStep} go={setTab} openRun={(id) => setOpenRun(id)} finish={endDemo} hide={() => setGuideHidden(true)} />}
      {ws?.workspace.demo && <div className="o-demo-bar"><Sparkles size={14} /> <b>{t('Demo mode', 'وضع التجربة')}</b> {t('Sample data is loaded so you can see every module working. It is removed the moment you finish the tour.', 'بيانات تجريبية محمّلة لترى كل الوحدات تعمل. تُحذف فور إنهاء الجولة.')} {guideHidden && <button onClick={() => { setGuideHidden(false); }}>{t('Resume tour', 'استئناف الجولة')}</button>}<button className="primary" onClick={endDemo}>{t('I understand, let’s start', 'فهمت كل شيء، هيا لنبدأ')}</button></div>}
    </>
  );
}

type DashData = {
  stats: { contacts: { value: number; trend: number | null }; active: { value: number; trend: number | null }; reply_rate: { value: number; trend: number | null; prev: number }; sent_mtd: { value: number; trend: number | null } };
  series: { x: string; sent: number; replies: number; followups: number }[];
  distribution: { name: string; value: number }[];
  templates: { label: string; sent: number; replied: number; rate: number }[];
  recent: { id: string; name: string; company?: string | null; status: string; sent: number; replies: number; last: string; pending: boolean }[];
  insights: { best_hour?: { hour: number; rate: number; sent: number } | null; followup_share?: number | null; best_template?: { label: string; rate: number; sent: number } | null; pending_drafts: number; drafts: number; due: number; bounced?: number; failure_rate?: number };
};

function Dashboard({ t, go, ws, onAutodraft, jobRunning }: { t: T; go: (i: number) => void; ws: WsSummary | null; onAutodraft: () => void; jobRunning: boolean }) {
  const [d, setD] = useState<DashData | null>(null);
  const [runs, setRuns] = useState<RunMeta[]>([]);
  /* oxlint-disable react/react-compiler -- load on mount and whenever the workspace summary refreshes */
  useEffect(() => { void invoke<DashData>('dashboard_data').then(setD).catch(() => undefined); void invoke<RunMeta[]>('run_list').then(setRuns).catch(() => undefined); }, [ws?.workspace.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */
  const name = ws?.workspace.profile.name?.split(' ')[0];
  const series = [
    { key: 'sent', label: t('Sent', 'مُرسل'), tone: 'violet' as const },
    { key: 'replies', label: t('Replies', 'ردود'), tone: 'sky' as const },
    { key: 'followups', label: t('Follow-ups', 'متابعات'), tone: 'orange' as const },
  ];
  const hasActivity = d ? d.series.some((x) => x.sent || x.replies) : false;
  const growth = (() => {
    const m = new Map<string, number>();
    runs.forEach((r) => { const k = (r.saved_at || '').slice(0, 7); if (k) m.set(k, (m.get(k) || 0) + r.count); });
    return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0])).slice(-6).map(([k, v]) => ({ x: k.slice(2).replace('-', '/'), leads: v }));
  })();
  const statusLabel: Record<string, string> = { draft: t('Draft', 'مسودة'), sent: t('Awaiting', 'بانتظار'), replied: t('Replied', 'ردّ'), closed: t('Closed', 'مغلق'), bounced: t('Bounced', 'مرتد') };
  const dist = (d?.distribution || []).map((x) => ({ name: statusLabel[x.name] || x.name, value: x.value }));
  const total = dist.reduce((a2, x) => a2 + x.value, 0);
  const top = dist.slice().sort((a2, b) => b.value - a2.value)[0];
  return (
    <>
      <PageHead
        title={name ? t(`Welcome back, ${name}!`, `مرحباً بعودتك، ${name}!`) : t('Welcome back!', 'مرحباً بعودتك!')}
        spark={false}
        sub={t("Welcome back! Here's what's happening today.", 'مرحباً بعودتك! إليك ما يحدث اليوم.')}
        actions={
          <>
            <Btn variant="secondary" onClick={() => go(TAB.leads)}>{t('New research', 'بحث جديد')}</Btn>
            <Btn icon={Sparkles} onClick={onAutodraft} disabled={jobRunning || !(d?.insights.drafts)}>{jobRunning ? t('Drafting in background…', 'جاري الصياغة في الخلفية…') : t(`Auto-draft ${d?.insights.drafts || 0} contacts`, `صياغة تلقائية لـ ${d?.insights.drafts || 0} جهة`)}</Btn>
          </>
        }
      />
      <div className="o-grid o-grid-4">
        <StatCard icon={Users} label={t('Total Contacts', 'إجمالي جهات الاتصال')} value={(d?.stats.contacts.value || 0).toLocaleString()} trend={d?.stats.contacts.trend ?? null} />
        <StatCard icon={Send} label={t('Active Conversations', 'محادثات نشطة')} value={(d?.stats.active.value || 0).toLocaleString()} trend={null} />
        <StatCard icon={Activity} label={t('Avg. Reply Rate', 'متوسط معدل الرد')} value={`${d?.stats.reply_rate.value ?? 0}%`} trend={d?.stats.reply_rate.trend ?? null} />
        <StatCard icon={Mail} label={t('Emails Sent (MTD)', 'رسائل مرسلة (الشهر)')} value={(d?.stats.sent_mtd.value || 0).toLocaleString()} trend={d?.stats.sent_mtd.trend ?? null} />
      </div>
      <div className="o-grid o-grid-main">
        <Card>
          <CardHead title={t('Outreach Performance', 'أداء التواصل')} sub={t('Last 30 days overview', 'نظرة على آخر ٣٠ يوماً')} action={<Legend series={series} />} />
          {hasActivity ? <StepLines data={d!.series} series={series} /> : <EmptyState icon={BarChart3} title={t('No sends in the last 30 days', 'لا إرسال في آخر ٣٠ يوماً')} text={t('Send your first emails from Outreach and the daily curve appears here.', 'أرسل أول رسائلك من التواصل وسيظهر المنحنى اليومي هنا.')} action={<Btn variant="secondary" size="sm" onClick={() => go(TAB.outreach)}>{t('Open Outreach', 'فتح التواصل')}</Btn>} />}
        </Card>
        <Card>
          <CardHead title={t('Conversation Status', 'حالة المحادثات')} sub={t('Distribution', 'التوزيع')} />
          {total ? <Donut data={dist} centerLabel={top?.name} centerValue={`${Math.round(((top?.value || 0) / total) * 100)}%`} /> : <EmptyState icon={Compass} title={t('No contacts yet', 'لا توجد جهات اتصال بعد')} text={t('Add leads with emails to Outreach.', 'أضف عملاء لديهم إيميلات إلى التواصل.')} />}
        </Card>
        <Card>
          <CardHead title={t('Top Templates', 'أفضل القوالب')} sub={t('Best performers', 'الأعلى أداءً')} action={<ViewAll label={t('View All', 'عرض الكل')} onClick={() => go(TAB.templates)} />} />
          {d?.templates.length ? d.templates.map((x) => <Tile key={x.label} title={x.label} big={`${x.rate}%`} left={t(`${x.sent} sent`, `${x.sent} مُرسل`)} right={t(`${x.replied} replied`, `${x.replied} ردّوا`)} progress={x.rate} />) : <EmptyState icon={FileText} title={t('No template sends yet', 'لا إرسال بالقوالب بعد')} text={t('Create a template, generate variants, and send. Reply rates per variant show here.', 'أنشئ قالباً وولّد نسخاً وأرسل. معدلات الرد لكل نسخة تظهر هنا.')} action={<Btn variant="secondary" size="sm" onClick={() => go(TAB.templates)}>{t('Templates', 'القوالب')}</Btn>} />}
        </Card>
      </div>
      <div className="o-grid o-grid-wide">
        <Card>
          <CardHead title={t('Audience Growth', 'نمو الجمهور')} sub={t('Leads collected per month', 'العملاء المجمّعون شهرياً')} />
          {growth.length ? <Bars data={growth} dataKey="leads" highlight={growth[growth.length - 1]?.x} /> : <EmptyState icon={Users} title={t('No research runs yet', 'لا توجد عمليات بحث بعد')} text={t('Run Lead Finder to start growing your audience.', 'شغّل البحث عن العملاء لبدء نمو جمهورك.')} action={<Btn variant="secondary" size="sm" onClick={() => go(TAB.leads)}>{t('Find leads', 'ابحث عن عملاء')}</Btn>} />}
        </Card>
        <Card>
          <CardHead title={t('Recent Conversations', 'أحدث المحادثات')} action={<ViewAll label={t('View All', 'عرض الكل')} onClick={() => go(TAB.outreach)} />} />
          {d?.recent.length ? (
            <Table columns={[t('Contact', 'جهة الاتصال'), t('Status', 'الحالة'), t('Sent', 'مُرسل'), t('Replies', 'ردود'), '']}>
              {d.recent.map((r) => (
                <tr key={r.id} className="o-row-click" onClick={() => go(TAB.outreach)}>
                  <td><b>{r.name}</b>{r.company ? <><br /><small className="o-muted">{r.company}</small></> : null}</td>
                  <td><Chip tone={r.status === 'replied' ? 'green' : r.status === 'sent' ? 'violet' : r.pending ? 'orange' : 'neutral'}>{r.pending && r.status === 'draft' ? t('Draft ready', 'مسودة جاهزة') : statusLabel[r.status] || r.status}</Chip></td>
                  <td>{r.sent}</td><td>{r.replies}</td><td><MoreBtn /></td>
                </tr>
              ))}
            </Table>
          ) : <EmptyState icon={Inbox} title={t('No conversations yet', 'لا توجد محادثات بعد')} text="" />}
        </Card>
        <Card>
          <CardHead title={t('AI Insights', 'رؤى الذكاء الاصطناعي')} />
          <Insight icon={Clock} title={t('Best Send Time', 'أفضل وقت للإرسال')} text={d?.insights.best_hour ? t(`${String(d.insights.best_hour.hour).padStart(2, '0')}:00 UTC shows ${d.insights.best_hour.rate}% replies (${d.insights.best_hour.sent} sent)`, `${String(d.insights.best_hour.hour).padStart(2, '0')}:00 UTC يعطي ${d.insights.best_hour.rate}% ردود (${d.insights.best_hour.sent} مُرسل)`) : t('Needs 3+ sends in one hour slot to compare.', 'يحتاج 3+ إرسالات في نفس الساعة للمقارنة.')} />
          <Insight icon={Lightbulb} title={t('Best Template', 'أفضل قالب')} text={d?.insights.best_template ? `${d.insights.best_template.label} · ${d.insights.best_template.rate}%` : t('Send with templates to rank them by replies.', 'أرسل بالقوالب لترتيبها حسب الردود.')} />
          <Insight icon={RefreshCw} title={t('Follow-ups matter', 'المتابعات تهم')} text={d?.insights.followup_share != null ? t(`${d.insights.followup_share}% of replies came after a follow-up`, `${d.insights.followup_share}% من الردود جاءت بعد متابعة`) : t(`${d?.insights.due || 0} follow-ups due · ${d?.insights.pending_drafts || 0} drafts ready`, `${d?.insights.due || 0} متابعة مستحقة · ${d?.insights.pending_drafts || 0} مسودة جاهزة`)} />
          <Insight icon={Shield} tone={(d?.insights.failure_rate || 0) > 0 ? 'coral' : undefined} title={t('Delivery failure rate', 'معدل فشل التسليم')} text={d?.insights.bounced ? t(`${d.insights.failure_rate}% bounced · ${d.insights.bounced} address${d.insights.bounced === 1 ? '' : 'es'} failed. Follow-ups on those were cancelled.`, `${d.insights.failure_rate}% ارتد · ${d.insights.bounced} عنوان فشل. أُلغيت متابعاتها.`) : t('0% — no delivery failures. Bounced emails are excluded from follow-ups automatically.', '0% — لا فشل تسليم. الرسائل المرتدة تُستبعد من المتابعة تلقائياً.')} />
          <div className="o-mt"><Btn variant="ai" icon={Sparkles} block onClick={() => go(TAB.outreach)}>{t('Open Outreach Assistant', 'فتح مساعد التواصل')}</Btn></div>
        </Card>
      </div>
      <div className="o-grid o-grid-2">
        <Card>
          <CardHead title={t('Recent Activity', 'النشاط الأخير')} sub={t('Everything the workspace did, newest first', 'كل ما فعلته مساحة العمل، الأحدث أولاً')} action={<ViewAll label={t('All', 'الكل')} onClick={() => go(TAB.settings)} />} />
          {ws?.workspace.activity.length ? ws.workspace.activity.slice(-8).reverse().map((x, i) => (
            <Row key={i} icon={x.kind === 'outreach' ? Send : x.kind === 'research' ? Compass : x.kind === 'integration' ? Plug : x.kind === 'style' ? Sparkles : Activity} title={x.text} meta={new Date(x.at).toLocaleString()} />
          )) : <EmptyState icon={Activity} title={t('No activity yet', 'لا يوجد نشاط بعد')} text={t('Runs, sends, replies and connections show up here.', 'عمليات البحث والإرسال والردود والاتصالات تظهر هنا.')} />}
        </Card>
        <Card>
          <CardHead title={t('Getting started', 'البدء')} sub={t('Workspace setup', 'إعداد مساحة العمل')} action={<Chip tone={ws && ws.progress.percent === 100 ? 'green' : 'violet'} pill>{ws?.progress.percent ?? 0}%</Chip>} />
          <Progress value={ws?.progress.percent ?? 0} />
          <div className="o-mt">
            {(ws?.progress.checklist || []).map((c) => { const goFor: Record<string, number> = { profile: TAB.settings, email: TAB.integrations, inbox: TAB.integrations, llm: TAB.integrations, style: TAB.outreach, leads: TAB.leads, research: TAB.research, outreach: TAB.outreach, reply: TAB.outreach }; return (
              <button key={c.id} className={`o-check${c.done ? ' done' : ''}`} onClick={() => go(goFor[c.id] ?? 0)}><i>{c.done ? '✓' : ''}</i><span>{c.label}</span><ChevronRight size={14} /></button>
            ); })}
          </div>
        </Card>
      </div>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any



type LlmStatus = { default: { provider?: string | null; model?: string | null }; providers: { id: string; name: string; models: string[]; docs: string; configured: boolean; rpm: number; default_rpm: number }[] };

function Agents({ t, agentic, setAgentic }: { t: T; agentic: boolean; setAgentic: (x: boolean) => void }) {
  return <LlmProviders t={t} agentic={agentic} setAgentic={setAgentic} />;
}

function LlmProviders({ t, agentic, setAgentic, embedded }: { t: T; agentic?: boolean; setAgentic?: (x: boolean) => void; embedded?: boolean }) {
  const [st, setSt] = useState<LlmStatus | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: 'green' | 'coral'; text: string } | null>(null);
  const [model, setModel] = useState('');
  const load = async () => { try { const r = await invoke<LlmStatus>('llm_status'); setSt(r); setModel(r.default.model || ''); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } };
  /* oxlint-disable react/react-compiler -- load once */
  useEffect(() => { void load(); }, []);
  /* oxlint-enable react/react-compiler */
  const act = async (k: string, fn: () => Promise<string>) => { setBusy(k); setMsg(null); try { setMsg({ tone: 'green', text: await fn() }); await load(); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const iconFor = (id: string) => id === 'anthropic' ? siAnthropic : id === 'google' ? siGooglegemini : id === 'mistral' ? siMistralai : id === 'openrouter' ? siOpenrouter : null;
  const body = (
    <>
      {msg && <div className={`o-result${msg.tone === 'coral' ? ' error' : ''}`}><Check size={16} />{msg.text}</div>}
      {st && (
        <Card className="o-flex" style={{ flexWrap: 'wrap', gap: 12 }}>
          <IconTile icon={Sparkles} tone="violet" />
          <b>{t('Default model for drafting', 'النموذج الافتراضي للصياغة')}</b>
          <select className="o-input" aria-label="Default provider" style={{ height: 36 }} value={st.default.provider || ''} onChange={(e) => { const p = st.providers.find((x) => x.id === e.target.value); void act('default', async () => { await invoke('llm_set_default', { provider: e.target.value, model: p?.models[0] || '' }); return t('Default provider saved', 'تم حفظ المزوّد الافتراضي'); }); }}>
            <option value="">{t('Choose provider…', 'اختر المزوّد…')}</option>
            {st.providers.map((p) => <option key={p.id} value={p.id} disabled={!p.configured}>{p.name}{p.configured ? '' : t(' (no key)', ' (بدون مفتاح)')}</option>)}
          </select>
          <input className="o-input" aria-label="Model id" style={{ height: 36, width: 220 }} list="orbit-models" value={model} onChange={(e) => setModel(e.target.value)} placeholder={t('model id', 'معرّف النموذج')} />
          {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- datalist options are suggestions, not controls */}
          <datalist id="orbit-models" aria-label="Models">{st.providers.find((p) => p.id === st.default.provider)?.models.map((m) => <option key={m} value={m} />)}</datalist>
          <Btn size="sm" variant="secondary" disabled={!st.default.provider || !!busy} onClick={() => act('model', async () => { await invoke('llm_set_default', { provider: st.default.provider, model }); return t('Model saved', 'تم حفظ النموذج'); })}>{t('Save model', 'حفظ النموذج')}</Btn>
          {setAgentic !== undefined && agentic !== undefined && <span className="o-flex" style={{ marginInlineStart: 'auto' }}><span style={{ fontSize: 13, fontWeight: 600 }}>{t('Agentic mode', 'الوضع الوكيلي')}</span><Chip tone={agentic ? 'green' : 'neutral'}>{agentic ? 'ON' : 'OFF'}</Chip><Switch on={agentic} onChange={setAgentic} label="Agentic mode" /></span>}
        </Card>
      )}
      <div className="o-grid o-grid-3">
        {(st?.providers || []).map((p) => {
          const icon = iconFor(p.id);
          return (
            <Card className="o-llm" key={p.id}>
              <div className="o-llm-head">
                <div className="o-provider-logo">{icon ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icon.path} fill="currentColor" /></svg> : <span>{p.name[0]}</span>}</div>
                <div className="o-llm-name">
                  <h2>{p.name}</h2>
                  <p title={p.models.join(', ')}>{p.models.join(' · ')}</p>
                </div>
                <Chip tone={p.configured ? 'green' : 'neutral'} pill>{p.configured ? t('Saved', 'محفوظ') : t('No key', 'بدون مفتاح')}</Chip>
              </div>
              <div className="o-llm-key">
                <input className="o-input" style={{ height: 34, flex: 1, minWidth: 0 }} type="password" value={keys[p.id] || ''} onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })} placeholder={p.configured ? t('(stored · paste to replace)', '(محفوظ · الصق للاستبدال)') : 'API key'} />
                <Btn size="sm" disabled={!!busy || !(keys[p.id] || '').trim()} onClick={() => act(p.id, async () => { await invoke('llm_set_key', { provider: p.id, key: keys[p.id] }); setKeys({ ...keys, [p.id]: '' }); return t(`${p.name} key saved to the credential store`, `تم حفظ مفتاح ${p.name} في مخزن الاعتماد`); })}>{t('Save', 'حفظ')}</Btn>
                {p.configured && <Btn size="sm" variant="secondary" disabled={!!busy} onClick={() => act(p.id + '-test', async () => { const r = await invoke<string>('llm_test', { provider: p.id }); return `${p.name}: ${r}`; })}>{busy === p.id + '-test' ? '…' : t('Test', 'اختبار')}</Btn>}
                {p.configured && <button className="o-more" aria-label="Remove" disabled={!!busy} onClick={() => act(p.id + '-rm', async () => { await invoke('llm_set_key', { provider: p.id, key: '' }); return t('Key removed', 'تمت إزالة المفتاح'); })}><Trash2 size={14} /></button>}
              </div>
              <div className="o-llm-foot">
                <a href={p.docs} target="_blank" rel="noreferrer">{t('Get API key', 'احصل على مفتاح')}</a>
                <span className="o-flex" title={t('Requests per minute the app will not exceed. Background drafting paces to this and backs off on 429.', 'عدد الطلبات في الدقيقة الذي لن يتجاوزه التطبيق.')}>{t('Limit', 'الحد')} <input className="o-input" aria-label="Requests per minute" type="number" min={1} max={600} defaultValue={p.rpm} style={{ height: 28, width: 58 }} onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== p.rpm) void act(p.id + '-rpm', async () => { await invoke('llm_set_rate_limit', { provider: p.id, rpm: v }); return t(`${p.name}: ${v}/min`, `${p.name}: ${v}/دقيقة`); }); }} /> /min</span>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
  if (embedded) return body;
  return (
    <>
      <PageHead eyebrow={t('AI control plane', 'لوحة تحكم الذكاء الاصطناعي')} title={t('AI Agents · LLM providers', 'وكلاء الذكاء الاصطناعي · مزوّدو النماذج')} sub={t('Keys are stored in Windows Credential Manager. The default model drafts outreach emails in your learned writing style.', 'المفاتيح محفوظة في Windows Credential Manager. النموذج الافتراضي يصيغ رسائل التواصل بأسلوبك المُتعلَّم.')} />
      {body}
    </>
  );
}

type IntStatus = {
  smtp: { connected: boolean; host?: string | null; port?: number | null; username?: string | null; from?: string | null; security?: string | null; verified_at?: string | null };
  imap: { connected: boolean; host?: string | null; port?: number | null; username?: string | null; verified_at?: string | null };
  webhook: { connected: boolean; url?: string | null; last_status?: number | null; last_sent_at?: string | null };
  mailboxes: { id: string; label: string; kind: string; from: string; username: string; smtp_host: string; smtp_port: number; security: string; imap: boolean; enabled: boolean; daily_cap: number; verified_at?: string | null; sent_today: number }[];
  config_path: string;
};

type RacoreStatus = { linked: boolean; license_code: string; expires_at?: string | null; linked_at?: string | null; device_code_short: string; api: string; is_default: boolean };
function RacoreLicense({ t }: { t: T }) {
  const [st, setSt] = useState<RacoreStatus | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [verify, setVerify] = useState<{ valid: boolean; expires_at: string | null } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'green' | 'coral'; text: string } | null>(null);
  const [ea, setEa] = useState({ user_name: '', organization: '', email: '', country: '', usage_type: '' });
  const [showEa, setShowEa] = useState(false);
  const load = async () => { try { setSt(await invoke<RacoreStatus>('racore_status')); } catch { /* ignore */ } };
  /* oxlint-disable react/react-compiler */
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */
  const doVerify = async () => { setBusy('verify'); setMsg(null); setVerify(null); try { const r = await invoke<{ valid: boolean; expires_at: string | null }>('racore_verify', { licenseCode: code }); setVerify(r); setMsg({ tone: r.valid ? 'green' : 'coral', text: r.valid ? t('License is valid.', 'الترخيص صالح.') : t('License is invalid or expired.', 'الترخيص غير صالح أو منتهٍ.') }); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const doLogin = async () => { setBusy('login'); setMsg(null); try { await invoke('racore_login', { licenseCode: code }); setCode(''); setVerify(null); await load(); setMsg({ tone: 'green', text: t('Device linked. AI now runs through your Racore license.', 'تم ربط الجهاز. الذكاء الاصطناعي يعمل الآن عبر ترخيص Racore.') }); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const doTest = async () => { setBusy('test'); setMsg(null); try { const r = await invoke<string>('racore_test'); setMsg({ tone: 'green', text: t(`Gateway AI replied: ${r.slice(0, 40)}`, `ردّ الذكاء الاصطناعي: ${r.slice(0, 40)}`) }); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const doLogout = async () => { setBusy('logout'); try { await invoke('racore_logout'); await load(); setMsg({ tone: 'green', text: t('Logged out.', 'تم تسجيل الخروج.') }); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const doEa = async () => { setBusy('ea'); setMsg(null); try { await invoke('racore_early_access', ea); setMsg({ tone: 'green', text: t('Early-access request sent.', 'تم إرسال طلب الوصول المبكر.') }); setEa({ user_name: '', organization: '', email: '', country: '', usage_type: '' }); setShowEa(false); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const expired = st?.expires_at ? new Date(st.expires_at).toISOString() < new Date().toISOString() : false;
  const state = !st?.linked ? { label: t('Not activated', 'غير مفعّل'), tone: 'neutral' as Tone } : expired ? { label: t('Expired', 'منتهٍ'), tone: 'coral' as Tone } : { label: t('Active', 'مفعّل'), tone: 'green' as Tone };
  return (
    <Card>
      <CardHead title={<span className="o-flex">{t('Racore license', 'ترخيص Racore')} <Chip tone={state.tone}>{state.label}</Chip></span>} sub={t('Activate the app with a license code. AI runs through the Racore gateway — no API keys to manage.', 'فعّل التطبيق بكود ترخيص. الذكاء الاصطناعي يعمل عبر بوابة Racore — بدون إدارة مفاتيح.')} action={<KeyRound size={16} className="o-muted" />} />
      {msg && <div className={`o-result${msg.tone === 'coral' ? ' error' : ''}`}><Check size={16} /><span style={{ wordBreak: 'break-all' }}>{msg.text}</span></div>}
      {st?.linked ? (
        <div>
          <div className="o-facts-row"><span>{t('License', 'الترخيص')}</span><b>{st.license_code || '—'}</b></div>
          <div className="o-facts-row"><span>{t('Device', 'الجهاز')}</span><b>{st.device_code_short}</b></div>
          {st.expires_at && <div className="o-facts-row"><span>{t('Expires', 'ينتهي')}</span><b>{new Date(st.expires_at).toLocaleDateString()}</b></div>}
          <div className="o-facts-row"><span>{t('AI provider', 'مزود الذكاء')}</span><b>{st.is_default ? t('Racore gateway (default)', 'بوابة Racore (افتراضي)') : t('Racore gateway', 'بوابة Racore')}</b></div>
          <div className="o-flex o-mt"><Btn variant="secondary" size="sm" icon={Zap} onClick={doTest} disabled={!!busy}>{busy === 'test' ? t('Testing…', 'اختبار…') : t('Test AI', 'اختبر الذكاء')}</Btn><Btn variant="ghost" size="sm" onClick={doLogout} disabled={!!busy}>{t('Sign out', 'خروج')}</Btn></div>
        </div>
      ) : (
        <div>
          <div className="o-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="o-input" style={{ flex: 1, minWidth: 260 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="orbit_xxxxxxxxxxxxxxxxxxxxxxxx" />
            <Btn variant="secondary" onClick={doVerify} disabled={!!busy || !code.trim()}>{busy === 'verify' ? t('Checking…', 'فحص…') : t('Verify', 'تحقق')}</Btn>
            <Btn onClick={doLogin} disabled={!!busy || !code.trim()}>{busy === 'login' ? t('Activating…', 'تفعيل…') : t('Activate device', 'فعّل الجهاز')}</Btn>
          </div>
          {verify && <p className="o-note">{verify.valid ? t(`Valid${verify.expires_at ? ` · expires ${new Date(verify.expires_at).toLocaleDateString()}` : ' · no expiry'}`, `صالح${verify.expires_at ? ` · ينتهي ${new Date(verify.expires_at).toLocaleDateString()}` : ' · بدون انتهاء'}`) : t('Not valid.', 'غير صالح.')}</p>}
          <p className="o-note">{t('No license? ', 'ليس لديك ترخيص؟ ')}<button className="o-link" onClick={() => setShowEa(!showEa)} style={{ background: 'none', color: 'var(--primary)' }}>{t('Request early access', 'اطلب وصولاً مبكراً')}</button></p>
          {showEa && (
            <div className="o-form-grid o-mt">
              <label className="o-field">{t('Name', 'الاسم')}<input value={ea.user_name} onChange={(e) => setEa({ ...ea, user_name: e.target.value })} /></label>
              <label className="o-field">{t('Organization', 'الجهة')}<input value={ea.organization} onChange={(e) => setEa({ ...ea, organization: e.target.value })} /></label>
              <label className="o-field">{t('Email', 'البريد')}<input type="email" value={ea.email} onChange={(e) => setEa({ ...ea, email: e.target.value })} /></label>
              <label className="o-field">{t('Country', 'الدولة')}<input value={ea.country} onChange={(e) => setEa({ ...ea, country: e.target.value })} /></label>
              <label className="o-field" style={{ gridColumn: '1 / -1' }}>{t('Usage', 'الاستخدام')}<input value={ea.usage_type} onChange={(e) => setEa({ ...ea, usage_type: e.target.value })} placeholder={t('Education and research', 'تعليم وبحث')} /></label>
              <div style={{ gridColumn: '1 / -1' }}><Btn size="sm" onClick={doEa} disabled={!!busy || !ea.email.includes('@')}>{busy === 'ea' ? t('Sending…', 'إرسال…') : t('Send request', 'أرسل الطلب')}</Btn></div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Integrations({ t, setConnected }: { t: T; connected: string[]; setConnected: (x: string[]) => void }) {
  const [st, setSt] = useState<IntStatus | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: 'green' | 'coral'; text: string } | null>(null);
  const [reach, setReach] = useState<{ ready: boolean; checks: { id: string; label: string; ok: boolean; required: boolean; status?: string; detail?: string; fix?: string }[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [g, setG] = useState({ address: '', app_password: '', test_to: '' });
  const [s, setS] = useState({ host: '', port: '587', username: '', password: '', from: '', security: 'starttls', test_to: '' });
  const [w, setW] = useState({ url: '', secret: '', shown: '' });
  const [im, setIm] = useState({ host: '', port: '993', username: '', password: '' });
  const [exa, setExa] = useState({ key: '', configured: false });

  const refresh = async () => {
    try {
      const r = await invoke<IntStatus>('integrations_status');
      setSt(r);
      setConnected([r.smtp.connected && 'SMTP Server', r.imap.connected && 'Inbox', r.webhook.connected && 'Webhooks', reach?.ready && 'Agent Reach'].filter(Boolean) as string[]);
      setG((x) => ({ ...x, address: (r.smtp.host === 'smtp.gmail.com' && r.smtp.username) || x.address, test_to: x.test_to || r.smtp.username || '' }));
      setS((x) => ({ ...x, host: r.smtp.host || x.host, port: String(r.smtp.port || x.port), username: r.smtp.username || x.username, from: r.smtp.from || x.from, security: r.smtp.security || x.security, test_to: x.test_to || r.smtp.from || '' }));
      setW((x) => ({ ...x, url: r.webhook.url || x.url }));
      setIm((x) => ({ ...x, host: r.imap?.host || x.host, port: String(r.imap?.port || x.port), username: r.imap?.username || x.username }));
    } catch (e) { setMsg({ tone: 'coral', text: String(e) }); }
  };
  const checkReach = async () => {
    setBusy('reach');
    try { const e = await invoke<{ configured: boolean }>('exa_status'); setExa((x) => ({ ...x, configured: e.configured })); } catch { /* ignore */ }
    try { const d = JSON.parse(await invoke<string>('bridge_doctor')); setReach(d); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); }
  };
  /* oxlint-disable react/react-compiler -- load persisted status once after mount */
  useEffect(() => { void refresh(); void checkReach(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void refresh(); }, [reach?.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */

  const act = async (key: string, fn: () => Promise<string>) => {
    setBusy(key); setMsg(null);
    try { const r = await fn(); setMsg({ tone: 'green', text: r }); void invoke('workspace_log', { kind: 'integration', text: r }); await refresh(); }
    catch (e) { setMsg({ tone: 'coral', text: String(e) }); }
    finally { setBusy(''); }
  };

  const cards: { id: string; name: string; icon: Icon; detail: string; on: boolean; meta?: string }[] = [
    { id: 'gmail', name: 'Gmail', icon: Mail, detail: t('Direct SMTP (smtp.gmail.com) + IMAP (imap.gmail.com) with a Google app password. No Gmail API, no OAuth.', 'SMTP مباشر (smtp.gmail.com) + IMAP (imap.gmail.com) بكلمة مرور تطبيق من جوجل. بدون Gmail API أو OAuth.'), on: !!st?.smtp.connected && st?.smtp.host === 'smtp.gmail.com', meta: st?.smtp.host === 'smtp.gmail.com' ? st?.smtp.username || undefined : undefined },
    { id: 'smtp', name: 'SMTP Server', icon: Send, detail: t('Any SMTP provider (Google Workspace, Outlook, Zoho, Mailgun, SES). Password stored in the credential store.', 'أي مزود SMTP (Google Workspace, Outlook, Zoho, Mailgun, SES). كلمة المرور في مخزن الاعتماد.'), on: !!st?.smtp.connected, meta: st?.smtp.host ? `${st.smtp.host}:${st.smtp.port}` : undefined },
    { id: 'reach', name: 'Agent Reach', icon: Compass, detail: t('Exa web search through mcporter plus Jina Reader. Powers Lead Finder and Market Research.', 'بحث Exa عبر mcporter مع Jina Reader. يشغّل البحث عن العملاء وأبحاث السوق.'), on: !!reach?.ready, meta: reach ? `${reach.checks.filter((c) => c.ok).length}/${reach.checks.length} ${t('channels', 'قناة')}` : undefined },
    { id: 'webhook', name: 'Webhooks', icon: Zap, detail: t('Signed JSON POST (HMAC-SHA256 in X-Orbit-Signature) for every lead, campaign and research event.', 'POST JSON موقّع (HMAC-SHA256 في X-Orbit-Signature) لكل حدث عميل أو حملة أو بحث.'), on: !!st?.webhook.connected, meta: st?.webhook.url ? new URL(st.webhook.url).host : undefined },
  ];

  return (
    <>
      <PageHead eyebrow={t('Connections', 'الاتصالات')} title={t('Integrations', 'التكاملات')} sub={t('Every connection is real: passwords go to the OS credential store, nothing is sent without your click. Email works over plain SMTP and IMAP, no Gmail API.', 'كل اتصال حقيقي: كلمات المرور في مخزن النظام، ولا يُرسل شيء بدون ضغطتك. البريد يعمل عبر SMTP وIMAP فقط، بدون Gmail API.')} actions={<Btn variant="secondary" size="sm" onClick={() => { void refresh(); void checkReach(); }} disabled={!!busy}>{t('Refresh status', 'تحديث الحالة')}</Btn>} />
      <RacoreLicense t={t} />
      <Mailboxes t={t} mailboxes={st?.mailboxes || []} reload={refresh} />
      {msg && <div className={`o-result${msg.tone === 'coral' ? ' error' : ''}`}><Check size={16} />{msg.text}</div>}
      <div className="o-grid o-grid-2">
        {cards.map((c) => (
          <Card key={c.id} className="o-integration" style={{ alignItems: 'start' }}>
            <IconTile icon={c.icon} tone={c.on ? 'green' : 'violet'} size="lg" iconSize={19} />
            <div>
              <h2>{c.name}{c.meta && <span className="o-muted" style={{ fontWeight: 400, fontSize: 12 }}> · {c.meta}</span>}</h2>
              <p>{c.detail}</p>
            </div>
            <Chip tone={c.on ? 'green' : 'neutral'} pill>{c.on ? t('Connected', 'متصل') : t('Not connected', 'غير متصل')}</Chip>
            <div className="o-flex" style={{ gridColumn: '2 / 4', flexWrap: 'wrap' }}>
              <Btn variant={open === c.id ? 'secondary' : 'primary'} size="sm" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? t('Close', 'إغلاق') : c.on ? t('Manage', 'إدارة') : t('Connect', 'اتصال')}</Btn>
              {c.on && c.id !== 'reach' && <Btn variant="ghost" size="sm" onClick={() => act(c.id + '-off', async () => { if (c.id === 'gmail') { await invoke('smtp_disconnect'); await invoke('imap_disconnect'); } else { await invoke(`${c.id}_disconnect`); } return t(`${c.name} disconnected`, `تم فصل ${c.name}`); })} disabled={!!busy}>{t('Disconnect', 'فصل')}</Btn>}
            </div>

            {open === c.id && c.id === 'gmail' && (
              <div className="o-int-form">
                <GmailTutorial t={t} />
                <div className="o-form-grid">
                  <label className="o-field">{t('Gmail address', 'عنوان Gmail')}<input value={g.address} onChange={(e) => setG({ ...g, address: e.target.value })} placeholder="you@gmail.com" /></label>
                  <label className="o-field">{t('App password', 'كلمة مرور التطبيق')}<input type="password" value={g.app_password} onChange={(e) => setG({ ...g, app_password: e.target.value })} placeholder={st?.smtp.host === 'smtp.gmail.com' && st?.smtp.connected ? t('(stored, leave blank to keep)', '(محفوظة، اتركها فارغة للإبقاء)') : 'xxxx xxxx xxxx xxxx'} /></label>
                </div>
                <div className="o-flex o-mt" style={{ flexWrap: 'wrap' }}>
                  <Btn size="sm" onClick={() => act('gmail', async () => {
                    const pw = g.app_password.replace(/\s+/g, '');
                    await invoke('smtp_save', { host: 'smtp.gmail.com', port: 587, username: g.address, password: pw, from: g.address, security: 'starttls' });
                    await invoke('imap_save', { host: 'imap.gmail.com', port: 993, username: g.address, password: pw });
                    setG({ ...g, app_password: '', test_to: g.test_to || g.address });
                    return t(`Gmail connected as ${g.address}: SMTP verified, inbox opened.`, `تم ربط Gmail بحساب ${g.address}: تم التحقق من SMTP وفتح الصندوق.`);
                  })} disabled={!!busy || !g.address}>{busy === 'gmail' ? t('Verifying…', 'جاري التحقق…') : t('Connect Gmail (SMTP + IMAP)', 'ربط Gmail (SMTP + IMAP)')}</Btn>
                  {st?.smtp.connected && st?.smtp.host === 'smtp.gmail.com' && (
                    <>
                      <input className="o-input" style={{ height: 34, width: 220 }} value={g.test_to} onChange={(e) => setG({ ...g, test_to: e.target.value })} placeholder={t('Send test to…', 'إرسال اختبار إلى…')} />
                      <Btn variant="secondary" size="sm" icon={Send} onClick={() => act('gmail-test', async () => { const r = await invoke<{ to: string; response: string }>('smtp_send', { to: g.test_to, subject: 'orbit. test email', body: 'This is a test email sent from orbit. Growth OS through Gmail SMTP.' }); return t(`Test email sent to ${r.to} (${r.response})`, `تم إرسال رسالة اختبار إلى ${r.to}`); })} disabled={!!busy || !g.test_to}>{t('Send test email', 'إرسال رسالة اختبار')}</Btn>
                    </>
                  )}
                </div>
              </div>
            )}

            {open === c.id && c.id === 'smtp' && (
              <div className="o-int-form">
                <div className="o-form-grid">
                  <label className="o-field">{t('Host', 'الخادم')}<input value={s.host} onChange={(e) => setS({ ...s, host: e.target.value })} placeholder="smtp.gmail.com" /></label>
                  <label className="o-field">{t('Port', 'المنفذ')}<input value={s.port} onChange={(e) => setS({ ...s, port: e.target.value })} placeholder="587" /></label>
                  <label className="o-field">{t('Username', 'اسم المستخدم')}<input value={s.username} onChange={(e) => setS({ ...s, username: e.target.value })} placeholder="you@company.com" /></label>
                  <label className="o-field">{t('Password / app password', 'كلمة المرور / كلمة مرور التطبيق')}<input type="password" value={s.password} onChange={(e) => setS({ ...s, password: e.target.value })} placeholder={st?.smtp.connected ? t('(stored, leave blank to keep)', '(محفوظة، اتركها فارغة للإبقاء)') : ''} /></label>
                  <label className="o-field">{t('From address', 'عنوان المرسل')}<input value={s.from} onChange={(e) => setS({ ...s, from: e.target.value })} placeholder="Ahmed <you@company.com>" /></label>
                  <label className="o-field">{t('Security', 'الأمان')}<select value={s.security} onChange={(e) => setS({ ...s, security: e.target.value })}><option value="starttls">STARTTLS (587)</option><option value="ssl">SSL/TLS (465)</option></select></label>
                </div>
                <div className="o-flex o-mt" style={{ flexWrap: 'wrap' }}>
                  <Btn size="sm" onClick={() => act('smtp', async () => { await invoke('smtp_save', { host: s.host, port: Number(s.port) || 587, username: s.username, password: s.password, from: s.from, security: s.security }); setS({ ...s, password: '' }); return t('SMTP verified: authenticated session opened successfully.', 'تم التحقق من SMTP: نجح فتح جلسة موثّقة.'); })} disabled={!!busy}>{busy === 'smtp' ? t('Verifying…', 'جاري التحقق…') : t('Save & verify connection', 'حفظ والتحقق من الاتصال')}</Btn>
                  {st?.smtp.connected && (
                    <>
                      <input className="o-input" style={{ height: 34, width: 220 }} value={s.test_to} onChange={(e) => setS({ ...s, test_to: e.target.value })} placeholder={t('Send test to…', 'إرسال اختبار إلى…')} />
                      <Btn variant="secondary" size="sm" icon={Send} onClick={() => act('smtp-test', async () => { const r = await invoke<{ to: string; response: string }>('smtp_send', { to: s.test_to, subject: 'orbit. SMTP test', body: 'This is a test email sent from orbit. Growth OS via SMTP.' }); return t(`Test email sent to ${r.to} (${r.response})`, `تم إرسال رسالة اختبار إلى ${r.to}`); })} disabled={!!busy || !s.test_to}>{t('Send test email', 'إرسال رسالة اختبار')}</Btn>
                    </>
                  )}
                </div>
              </div>
            )}

                {open === c.id && c.id === 'smtp' && st?.smtp.connected && (
                  <div className="o-int-form">
                    <b style={{ fontSize: 13 }}><Inbox size={14} /> {t('Inbox (IMAP) for reply detection', 'صندوق الوارد (IMAP) لرصد الردود')}</b>
                    <p className="o-note" style={{ marginTop: 4 }}>{t('Outreach checks this inbox for replies from your contacts.', 'وحدة التواصل تفحص هذا الصندوق بحثاً عن ردود جهات اتصالك.')}</p>
                    <div className="o-form-grid" style={{ marginTop: 10 }}>
                      <label className="o-field">IMAP host<input value={im.host} onChange={(e) => setIm({ ...im, host: e.target.value })} placeholder="imap.gmail.com" /></label>
                      <label className="o-field">{t('Port', 'المنفذ')}<input value={im.port} onChange={(e) => setIm({ ...im, port: e.target.value })} placeholder="993" /></label>
                      <label className="o-field">{t('Username', 'اسم المستخدم')}<input value={im.username} onChange={(e) => setIm({ ...im, username: e.target.value })} /></label>
                      <label className="o-field">{t('Password', 'كلمة المرور')}<input type="password" value={im.password} onChange={(e) => setIm({ ...im, password: e.target.value })} placeholder={st?.imap?.connected ? t('(stored)', '(محفوظة)') : ''} /></label>
                    </div>
                    <div className="o-flex o-mt">
                      <Btn size="sm" variant="secondary" disabled={!!busy} onClick={() => act('imap', async () => { await invoke('imap_save', { host: im.host, port: Number(im.port) || 993, username: im.username, password: im.password }); setIm({ ...im, password: '' }); return t('IMAP verified: INBOX opened successfully.', 'تم التحقق من IMAP: فُتح صندوق الوارد بنجاح.'); })}>{busy === 'imap' ? t('Verifying…', 'جاري التحقق…') : t('Save & verify inbox', 'حفظ والتحقق من الصندوق')}</Btn>
                      {st?.imap?.connected && <Chip tone="green">{t('Inbox connected', 'الصندوق متصل')} · {st.imap.host}</Chip>}
                      {st?.imap?.connected && <Btn size="sm" variant="ghost" disabled={!!busy} onClick={() => act('imap-off', async () => { await invoke('imap_disconnect'); return t('IMAP removed', 'تمت إزالة IMAP'); })}>{t('Remove', 'إزالة')}</Btn>}
                    </div>
                  </div>
                )}
            {open === c.id && c.id === 'webhook' && (
              <div className="o-int-form">
                <div className="o-form-grid">
                  <label className="o-field full">{t('Endpoint URL (https)', 'رابط الاستقبال (https)')}<input value={w.url} onChange={(e) => setW({ ...w, url: e.target.value })} placeholder="https://hooks.example.com/orbit" /></label>
                  <label className="o-field full">{t('Signing secret (leave blank to generate)', 'مفتاح التوقيع (اتركه فارغاً للتوليد)')}<input value={w.secret} onChange={(e) => setW({ ...w, secret: e.target.value })} /></label>
                </div>
                {w.shown && <pre className="o-pre">{t('Signing secret (shown once, stored in credential store):', 'مفتاح التوقيع (يظهر مرة واحدة، محفوظ في مخزن الاعتماد):')} {w.shown}{'\n'}X-Orbit-Signature: sha256=HMAC_SHA256(secret, raw_body)</pre>}
                <div className="o-flex o-mt" style={{ flexWrap: 'wrap' }}>
                  <Btn size="sm" onClick={() => act('webhook', async () => { const r = await invoke<{ secret: string }>('webhook_save', { url: w.url, secret: w.secret }); setW({ url: w.url, secret: '', shown: r.secret }); return t('Webhook saved.', 'تم حفظ الـ webhook.'); })} disabled={!!busy}>{t('Save', 'حفظ')}</Btn>
                  {st?.webhook.connected && <Btn variant="secondary" size="sm" icon={Zap} onClick={() => act('webhook-test', async () => { const r = await invoke<{ status: number; ok: boolean; response: string }>('webhook_send', { event: 'orbit.test', payload: { message: 'hello from orbit.' } }); if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.response}`); return t(`Test event delivered (HTTP ${r.status})`, `تم تسليم حدث الاختبار (HTTP ${r.status})`); })} disabled={!!busy}>{t('Send test event', 'إرسال حدث اختبار')}</Btn>}
                  {st?.webhook.last_status && <Chip tone={st.webhook.last_status < 300 ? 'green' : 'coral'}>{t('last', 'آخر')} HTTP {st.webhook.last_status}</Chip>}
                </div>
              </div>
            )}

            {open === c.id && c.id === 'reach' && (
              <div className="o-int-form">
                <div className="o-onb-card" style={{ marginBottom: 12 }}>
                  <div className="o-flex"><IconTile icon={KeyRound} tone={exa.configured ? 'green' : 'orange'} /><b>{t('Exa API key (web search quota)', 'مفتاح Exa (حصة البحث)')}</b><Chip tone={exa.configured ? 'green' : 'orange'}>{exa.configured ? t('Your key in use', 'مفتاحك مستخدم') : t('Free shared endpoint', 'النقطة المجانية المشتركة')}</Chip></div>
                  <p className="o-note" style={{ marginTop: 4 }}>{t('Without a key, Agent Reach uses Exa’s free shared MCP endpoint, which has a low unpublished rate limit and returns HTTP 429 when many searches run in a row. A personal key from dashboard.exa.ai (free tier included) lifts that limit. It is stored in Windows Credential Manager and used automatically.', 'بدون مفتاح، يستخدم Agent Reach نقطة Exa المجانية المشتركة ذات الحد المنخفض غير المعلن، وتعيد HTTP 429 عند تشغيل عدة بحوث متتالية. مفتاح شخصي من dashboard.exa.ai (يشمل مستوى مجاني) يرفع هذا الحد. يُحفظ في Windows Credential Manager ويُستخدم تلقائياً.')}</p>
                  <div className="o-flex" style={{ flexWrap: 'wrap' }}>
                    <input className="o-input" aria-label="Exa API key" type="password" style={{ height: 34, flex: 1, minWidth: 220 }} value={exa.key} onChange={(e) => setExa({ ...exa, key: e.target.value })} placeholder={exa.configured ? t('(stored · paste to replace)', '(محفوظ · الصق للاستبدال)') : 'exa_…'} />
                    <Btn size="sm" disabled={!!busy || !exa.key.trim()} onClick={() => act('exa', async () => { await invoke('exa_set_key', { key: exa.key }); setExa({ key: '', configured: true }); await checkReach(); return t('Exa key saved. Web search now uses your quota.', 'تم حفظ مفتاح Exa. البحث يستخدم حصتك الآن.'); })}>{t('Save', 'حفظ')}</Btn>
                    {exa.configured && <Btn size="sm" variant="ghost" disabled={!!busy} onClick={() => act('exa-rm', async () => { await invoke('exa_set_key', { key: '' }); setExa({ key: '', configured: false }); await checkReach(); return t('Exa key removed', 'تمت إزالة مفتاح Exa'); })}>{t('Remove', 'إزالة')}</Btn>}
                    <a href="https://dashboard.exa.ai/api-keys" target="_blank" rel="noreferrer" className="o-btn o-btn-secondary o-btn-sm"><ExternalLink size={14} /> {t('Get a free key', 'احصل على مفتاح مجاني')}</a>
                  </div>
                </div>
                {reach ? reach.checks.map((k) => (
                  <div key={k.id} className="o-row">
                    <Chip tone={k.ok ? 'green' : k.required ? 'coral' : k.status === 'warn' ? 'orange' : 'neutral'}>{k.ok ? 'OK' : k.required ? t('Missing', 'مفقود') : k.status === 'warn' ? t('Needs login', 'يحتاج تسجيل دخول') : t('Optional', 'اختياري')}</Chip>
                    <div><b>{k.label}</b><small>{k.ok ? k.detail : k.fix || k.detail}</small></div>
                  </div>
                )) : <p className="o-note">{t('Checking…', 'جاري الفحص…')}</p>}
                <div className="o-flex o-mt">
                  {reach && !reach.ready && <Btn size="sm" icon={Zap} onClick={() => act('reach-setup', async () => { const r = JSON.parse(await invoke<string>('bridge_setup')); await checkReach(); return r.ok ? t('Agent Reach web search is ready.', 'بحث Agent Reach جاهز.') : r.log; })} disabled={!!busy}>{t('Set up web search (mcporter + Exa)', 'تجهيز البحث (mcporter + Exa)')}</Btn>}
                  <Btn variant="ghost" size="sm" onClick={checkReach} disabled={!!busy}>{t('Re-check', 'إعادة الفحص')}</Btn>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 8 }}>{t('LLM providers', 'مزوّدو النماذج')}</h2>
      <LlmProviders t={t} embedded />
      {st && <p className="o-note">{t('Settings file', 'ملف الإعدادات')}: {st.config_path} · {t('secrets are never written there.', 'الأسرار لا تُكتب فيه أبداً.')}</p>}
    </>
  );
}

type LeadEmail = { email: string; role: string; source: string; consent: string };
type Lead = { id?: string; source?: string; channel?: string; fetched_at?: string; photo?: string | null; cover?: string | null; published?: string | null; name: string; title?: string; kind?: string; favicon?: string | null; logo?: string | null; headline: string; company?: string | null; industry?: string | null; employees?: string | null; employee_growth?: string | null; revenue_range?: string | null; total_funding?: string | null; founded?: string | null; headquarters?: string | null; location?: string | null; homepage?: string | null; linkedin_url?: string | null; source_url: string; emails: LeadEmail[]; performance: string; notes: string };
type LeadsOut = { query: string; target: number; count: number; calls: { query: string; returned?: number; new?: number; error?: string }[]; fetched_at: string; leads: Lead[]; export?: { paths: Record<string, string> } };

function LeadFinder({ t, mode = 'leads', openRunId, onOpened, onOutreach }: { t: T; mode?: 'leads' | 'research'; openRunId?: string | null; onOpened?: () => void; onOutreach?: (leads: Lead[]) => void }) {
  const research = mode === 'research';
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState(1000);
  const [busy, setBusy] = useState<'leads' | 'enrich' | null>(null);
  const [out, setOut] = useState<LeadsOut | null>(null);
  const [error, setError] = useState('');
  const [exportPaths, setExportPaths] = useState<Record<string, string>>({});
  const [enrichLog, setEnrichLog] = useState('');
  const [progress, setProgress] = useState<{ percent: number; label: string; index?: number; planned?: number; count?: number }>({ percent: 0, label: '' });
  const [feed, setFeed] = useState<string[]>([]);
  const jobRef = useRef<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const stopListening = () => { unlistenRef.current?.(); unlistenRef.current = null; jobRef.current = null; };
  useEffect(() => () => { if (jobRef.current) void invoke('bridge_cancel', { jobId: jobRef.current }); stopListening(); }, []);

  const pushFeed = (line: string) => setFeed((f) => [line, ...f].slice(0, 12));

  const [runId, setRunId] = useState<string | null>(null);
  const [history, setHistory] = useState<RunMeta[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const loadHistory = async () => { try { const all = await invoke<RunMeta[]>('run_list'); setHistory(all.filter((r) => r.mode === mode)); } catch { /* ignore */ } };
  const openRun = async (id: string) => {
    try {
      const r = await invoke<SavedRun>('run_get', { id });
      setRunId(r.id); setOut({ query: r.query, target: r.target, count: r.leads.length, calls: r.calls || [], fetched_at: r.fetched_at, leads: r.leads });
      setQuery(r.query); setTarget(r.target); setExportPaths(r.export?.paths || {}); setProgress({ percent: 100, label: t(`Loaded from history · ${new Date(r.saved_at).toLocaleString()}`, `تم التحميل من السجل · ${new Date(r.saved_at).toLocaleString()}`) }); setFeed([]); setEnrichLog(r.enriched ? t('Enriched', 'مُثرى') : '');
    } catch (e) { setError(String(e)); }
  };
  const saveRun = async (id: string, o: LeadsOut, extra: Record<string, unknown> = {}) => {
    try { await invoke('run_save', { run: { id, mode, query: o.query, target: o.target, calls: o.calls, fetched_at: o.fetched_at, leads: o.leads, saved_at: new Date().toISOString(), ...extra } }); await loadHistory(); if (!extra.enriched) void invoke('workspace_log', { kind: 'research', text: `${mode === 'research' ? 'Market Research' : 'Lead Finder'}: “${o.query}” → ${o.leads.length} records` }); } catch (e) { setError(String(e)); }
  };
  /* oxlint-disable react/react-compiler -- load saved runs once, and when a run is opened from the History tab */
  useEffect(() => { void loadHistory(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (openRunId) { void openRun(openRunId); onOpened?.(); } }, [openRunId]); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */

  const run = async () => {
    if (!query.trim()) { setError(t('Describe who you are looking for first.', 'صف أولاً من تبحث عنه.')); return; }
    const jobId = `${mode}-${Date.now()}`;
    jobRef.current = jobId;
    setRunId(jobId);
    setBusy('leads'); setError(''); setEnrichLog(''); setFeed([]); setExportPaths({});
    setOut({ query, target, count: 0, calls: [], fetched_at: new Date().toISOString(), leads: [] });
    setProgress({ percent: 0, label: t('Starting Agent Reach…', 'جاري تشغيل Agent Reach…') });
    const seen = new Set<string>();
    unlistenRef.current = await listen<Record<string, unknown>>(`bridge://${jobId}`, (ev) => {
      const e = ev.payload as { type: string; percent?: number; index?: number; planned_calls?: number; count?: number; query?: string; new?: number; returned?: number; leads?: Lead[]; error?: string; fatal?: boolean; export?: { paths: Record<string, string> }; calls?: LeadsOut['calls'] };
      if (e.type === 'call') {
        setProgress({ percent: e.percent ?? 0, label: t(`Query ${e.index}/${e.planned_calls}: ${e.query}`, `استعلام ${e.index}/${e.planned_calls}: ${e.query}`), index: e.index, planned: e.planned_calls, count: e.count });
      } else if (e.type === 'batch') {
        const fresh = (e.leads || []).filter((l) => { if (seen.has(l.source_url)) return false; seen.add(l.source_url); return true; });
        setOut((o) => o ? { ...o, count: e.count ?? o.count + fresh.length, leads: [...o.leads, ...fresh], calls: [...o.calls, { query: e.query || '', returned: e.returned, new: e.new }] } : o);
        setProgress({ percent: e.percent ?? 0, label: t(`+${e.new} new · ${e.count} collected`, `+${e.new} جديد · ${e.count} مجمّع`), index: e.index, planned: e.planned_calls, count: e.count });
        pushFeed(`+${e.new}  ${e.query}`);
      } else if (e.type === 'error') {
        pushFeed(`! ${e.error}`);
        setOut((o) => o ? { ...o, calls: [...o.calls, { query: e.query || '', error: e.error }] } : o);
        if ((e as { stopped?: boolean }).stopped && !e.fatal) setError(e.error || '');
        if (e.fatal) { setError(e.error || 'failed'); setBusy(null); stopListening(); }
      } else if (e.type === 'log') {
        pushFeed(`· ${(e as { line?: string }).line || ''}`);
      } else if (e.type === 'done') {
        setExportPaths(e.export?.paths || {});
        setProgress((p) => ({ ...p, percent: 100, label: t(`Done · ${e.count} records`, `اكتمل · ${e.count} سجل`) }));
        setOut((o) => { if (o) void saveRun(jobId, o, { export: e.export }); return o; });
        setBusy(null); stopListening();
      } else if (e.type === 'cancelled') {
        setOut((o) => { if (o && o.leads.length) void saveRun(jobId, o, { cancelled: true }); return o; });
        setProgress((p) => ({ ...p, label: t('Cancelled', 'أُلغي') }));
        setBusy(null); stopListening();
      }
    });
    try { await invoke('agent_reach_stream', { jobId, mode, query, target }); }
    catch (err) { setError(String(err)); setBusy(null); stopListening(); }
  };

  const cancel = async () => { if (jobRef.current) await invoke('bridge_cancel', { jobId: jobRef.current }); };

  const enrich = async () => {
    if (!out) return;
    const jobId = `enrich-${Date.now()}`;
    jobRef.current = jobId;
    setBusy('enrich'); setError(''); setFeed([]);
    setProgress({ percent: 0, label: t('Reading profiles and company sites…', 'جاري قراءة الملفات ومواقع الشركات…') });
    unlistenRef.current = await listen<Record<string, unknown>>(`bridge://${jobId}`, (ev) => {
      const e = ev.payload as { type: string; percent?: number; done?: number; planned?: number; index?: number; lead?: Lead; log?: { name: string; photo: string; site: string; emails: number }; enriched?: number; photos?: number; export?: { paths: Record<string, string> }; error?: string };
      if (e.type === 'lead' && e.lead) {
        const lead = e.lead;
        setOut((o) => o ? { ...o, leads: o.leads.map((l) => (l.source_url === lead.source_url ? lead : l)) } : o);
        setProgress({ percent: e.percent ?? 0, label: t(`${e.done}/${e.planned} · ${e.log?.name || ''}`, `${e.done}/${e.planned} · ${e.log?.name || ''}`), index: e.done, planned: e.planned });
        pushFeed(`${e.log?.photo === 'ok' ? '📷 ' : ''}${e.log?.emails ? `✉ ${e.log.emails} ` : ''}${e.log?.name || ''} · ${e.log?.site}`);
      } else if (e.type === 'done') {
        setExportPaths(e.export?.paths || {});
        setProgress((p) => ({ ...p, percent: 100, label: t('Enrichment complete', 'اكتمل الإثراء') }));
        setOut((o) => { if (o && runId) void saveRun(runId, o, { export: e.export, enriched: true }); return o; });
        setEnrichLog(`${e.enriched} ${t('profiles read', 'ملف تمت قراءته')} · ${e.photos} ${t('photos', 'صورة')}`);
        setBusy(null); stopListening();
      } else if (e.type === 'error' || e.type === 'cancelled') {
        if (e.error) setError(e.error);
        setBusy(null); stopListening();
      }
    });
    try { await invoke('bridge_enrich_stream', { jobId, leadsJson: JSON.stringify(out.leads), limit: 50 }); }
    catch (err) { setError(String(err)); setBusy(null); stopListening(); }
  };
  const emailsOf = (l: Lead, roles: string[]) => l.emails.filter((e) => roles.includes(e.role)).map((e) => e.email).join(', ');
  const withEmails = out ? out.leads.filter((l) => l.emails.length).length : 0;
  const failed = out?.calls.find((c) => c.error);

  return (
    <>
      <PageHead
        eyebrow={t('Agent Reach · Exa', 'Agent Reach · Exa')}
        title={research ? t('Market Research', 'أبحاث السوق') : t('Lead Finder', 'البحث عن العملاء')}
        sub={research
          ? t('Describe the market. orbit. fans the query out across regions and intelligence angles (companies, competitors, reports, news, funding) through Agent Reach until it reaches your target, then structures every record.', 'صف السوق. orbit. يوزّع الاستعلام على المناطق وزوايا الاستخبارات (شركات، منافسون، تقارير، أخبار، تمويل) عبر Agent Reach حتى يصل للعدد المطلوب ثم يهيكل كل سجل.')
          : t('Describe the persona. orbit. fans the query out across regions and roles through Agent Reach until it reaches your target, then structures every record.', 'صف الشخصية المستهدفة. orbit. يوزّع الاستعلام على المناطق والأدوار عبر Agent Reach حتى يصل للعدد المطلوب ثم يهيكل كل سجل.')}
      />
      <Card>
        <div className="o-research-input">
          <IconTile icon={research ? Compass : Target} tone="violet" />
          <input className="o-input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder={research ? t('e.g. Fintech market in Saudi Arabia', 'مثال: سوق التكنولوجيا المالية في السعودية') : t('e.g. Solo founders of SaaS startups', 'مثال: مؤسسون منفردون لشركات SaaS')} />
          <label className="o-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {t('Target', 'العدد')}
            <input type="number" min={10} max={5000} step={100} value={target} onChange={(e) => setTarget(Number(e.target.value) || 1000)} style={{ width: 90 }} />
          </label>
          <Btn onClick={run} disabled={busy !== null}>{busy === 'leads' ? t('Collecting…', 'جاري التجميع…') : research ? t('Run research', 'تشغيل البحث') : t('Find leads', 'ابحث عن عملاء')}</Btn>
        </div>
        {(busy || progress.percent > 0) && (
          <div className="o-loader">
            <div className="o-loader-head">
              <span className={`o-spinner${busy ? '' : ' done'}`} />
              <b>{progress.percent}%</b>
              <span className="o-loader-label">{progress.label}</span>
              {progress.planned ? <span className="o-muted">{progress.index}/{progress.planned}</span> : null}
              {busy && <Btn variant="ghost" size="sm" onClick={cancel}>{t('Cancel', 'إلغاء')}</Btn>}
            </div>
            <div className="o-progress lg"><i style={{ width: `${progress.percent}%` }} /></div>
            {feed.length > 0 && <ul className="o-feed">{feed.map((f, i) => <li key={i} style={{ opacity: 1 - i * 0.07 }}>{f}</li>)}</ul>}
          </div>
        )}
        {error && <div className="o-result error">{error}</div>}
        {failed && !out?.count && <div className="o-result error">{failed.error}</div>}
        {out && (
          <>
            <div className="o-grid o-grid-4 o-mt" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
              <StatCard icon={Users} label={research ? t('Records collected', 'السجلات المجمّعة') : t('Leads collected', 'العملاء المجمّعون')} value={out.count.toLocaleString()} trend={null} tone="violet" />
              <StatCard icon={Compass} label={t('Agent Reach calls', 'استعلامات Agent Reach')} value={String(out.calls.length)} trend={null} />
              <StatCard icon={Mail} label={t('With published emails', 'لديهم إيميلات منشورة')} value={String(withEmails)} trend={null} tone="green" />
              <StatCard icon={Users} label={t('With profile photos', 'لديهم صور')} value={String(out.leads.filter((l) => l.photo).length)} trend={null} tone="orange" />
              <StatCard icon={Activity} label={t('With company facts', 'لديهم بيانات شركة')} value={String(out.leads.filter((l) => l.employees || l.industry).length)} trend={null} tone="sky" />
            </div>
            <div className="o-flex o-mt" style={{ flexWrap: 'wrap' }}>
              <Btn variant="secondary" size="sm" icon={Mail} onClick={enrich} disabled={busy !== null}>{busy === 'enrich' ? t('Enriching live…', 'جاري الإثراء لحظياً…') : t('Enrich: profile photos + published emails (first 50)', 'إثراء: صور الملفات + الإيميلات المنشورة (أول 50)')}</Btn>
              {enrichLog && <Chip tone="green">{enrichLog}</Chip>}
              {onOutreach && withEmails > 0 && <Btn size="sm" icon={MessageSquare} onClick={() => onOutreach(out.leads.filter((l) => l.emails.length))} disabled={!!busy}>{t(`Add ${withEmails} with emails to Outreach`, `إضافة ${withEmails} لديهم إيميل إلى التواصل`)}</Btn>}
              {Object.entries(exportPaths).map(([k, v]) => <Chip key={k} tone="violet"><Download size={12} /> {k.toUpperCase()}: {v}</Chip>)}
            </div>
            <div className="o-mt">
              <Table columns={[t('Name', 'الاسم'), t('Type', 'النوع'), t('Company', 'الشركة'), t('Industry', 'المجال'), t('Employees', 'الموظفون'), t('Performance', 'الأداء'), t('Sales / Marketing', 'مبيعات / تسويق'), t('Executive', 'تنفيذي'), t('Location', 'الموقع'), t('Notes', 'ملاحظات')]}>
                {out.leads.slice(0, 200).map((l) => (
                  <tr key={l.source_url} className="o-row-click" onClick={() => setSelected(l)}>
                    <td>
                      <div className="o-company">
                        <LeadAvatar lead={l} />
                        <div>
                          <b>{l.name || l.title || '—'}</b>
                          <br /><small className="o-muted">{l.headline.slice(0, 60)}</small>
                          <br /><span className="o-id">{leadId(l)}</span>
                        </div>
                      </div>
                    </td>
                    <td><Chip tone={l.kind === 'person' ? 'violet' : l.kind === 'company' ? 'sky' : l.kind === 'article' ? 'orange' : 'neutral'}>{l.kind || 'page'}</Chip>{l.published ? <><br /><small className="o-muted">{new Date(l.published).toLocaleDateString()}</small></> : null}</td>
                    <td>{l.homepage ? <a href={l.homepage.startsWith('http') ? l.homepage : `https://${l.homepage}`} target="_blank" rel="noreferrer">{l.company || '—'}</a> : l.company || '—'}</td>
                    <td>{l.industry || '—'}</td>
                    <td>{l.employees || '—'}{l.employee_growth ? <><br /><small className="o-muted">{l.employee_growth}</small></> : null}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 220, fontSize: 11 }}>{[l.revenue_range && `rev ${l.revenue_range}`, l.total_funding && `funding ${l.total_funding}`, l.founded && `est. ${l.founded}`].filter(Boolean).join(' · ') || '—'}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 180, fontSize: 11 }}>{emailsOf(l, ['sales', 'marketing', 'general', 'support']) || '—'}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 160, fontSize: 11 }}>{emailsOf(l, ['executive', 'named']) || '—'}</td>
                    <td>{l.location || l.headquarters || '—'}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 280, fontSize: 11 }}><Md text={(l.notes || '').slice(0, 220)} compact /></td>
                  </tr>
                ))}
              </Table>
              {out.leads.length > 200 && <p className="o-note">{t(`Showing 200 of ${out.leads.length}. The full list is in the exported file.`, `يتم عرض 200 من ${out.leads.length}. القائمة الكاملة في الملف المُصدَّر.`)}</p>}
            </div>
          </>
        )}
        <div className="o-history">
          <div className="o-between"><b><History size={14} /> {t('Saved runs', 'عمليات محفوظة')}</b><span className="o-muted" style={{ fontSize: 11 }}>{history.length ? `${history.length} ${t('saved', 'محفوظة')}` : t('auto-saved when a run finishes', 'تُحفظ تلقائياً عند انتهاء العملية')}</span></div>
          {history.length ? (
            <div className="o-history-list">
              {history.slice(0, 8).map((r) => (
                <button key={r.id} className={`o-history-item${r.id === runId ? ' active' : ''}`} onClick={() => openRun(r.id)}>
                  <b>{r.query}</b>
                  <small>{r.count} {t('records', 'سجل')} · {new Date(r.saved_at).toLocaleString()}{r.enriched ? ' · ✓' : ''}</small>
                </button>
              ))}
            </div>
          ) : <p className="o-note" style={{ marginTop: 6 }}>{t('Your past runs will appear here to reopen. Nothing saved yet for this module.', 'ستظهر عملياتك السابقة هنا لإعادة فتحها. لا يوجد محفوظ بعد لهذه الوحدة.')}</p>}
        </div>
        <p className="o-note">{t('Every row comes from Agent Reach (Exa) with its source URL and fetch time. Emails are only those the company itself publishes on its profile or website, tagged with the page they came from. Personal mailboxes are never collected.', 'كل صف يأتي من Agent Reach (Exa) مع رابط المصدر ووقت الجلب. الإيميلات هي فقط ما تنشره الشركة نفسها على ملفها أو موقعها، مع الصفحة المصدر. لا تُجمع صناديق بريد شخصية أبداً.')}</p>
      </Card>
      {selected && <LeadCard t={t} lead={selected} onClose={() => setSelected(null)} onOutreach={onOutreach ? (l) => { onOutreach([l]); setSelected(null); } : undefined} />}
    </>
  );
}

/* oxlint-disable nextjs/no-img-element -- Vite desktop build, next/image is unavailable here */
function LeadAvatar({ lead }: { lead: Lead }) {
  // Company logo published on its own site > source favicon > initials (people never get scraped photos).
  const initials = (lead.name || lead.company || lead.title || '?').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const src = lead.photo || lead.logo || (lead.kind !== 'person' ? lead.favicon : null);
  return (
    <div className={`o-lead-avatar${lead.kind === 'person' ? ' person' : ''}`}>
      {src ? <img src={src} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
      <span>{initials}</span>
      {lead.kind === 'person' && lead.favicon ? <img className="o-lead-badge" src={lead.favicon} alt="" loading="lazy" /> : null}
    </div>
  );
}

type RunMeta = { id: string; mode: string; query: string; target: number; count: number; fetched_at: string; saved_at: string; enriched?: boolean; export?: { paths: Record<string, string> }; size: number };
type SavedRun = RunMeta & { calls: LeadsOut['calls']; leads: Lead[] };

/** Stable system id for a lead: from the bridge when present, else derived from the source URL. */
function leadId(l: Lead) {
  if (l.id) return l.id;
  let h = 0;
  for (const c of l.source_url) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `ORB-${h.toString(16).toUpperCase().padStart(8, '0')}`;
}

/** Minimal, safe Markdown renderer for notes: headings, bold, italic, links, bullets, line breaks. */
function Md({ text, compact }: { text: string; compact?: boolean }) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) =>
    esc(s)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>');
  const blocks = text.replace(/\s…\s/g, '\n').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const html = blocks.map((l) => {
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) return `<h${Math.min(6, h[1].length + 2)}>${inline(h[2])}</h${Math.min(6, h[1].length + 2)}>`;
    if (/^[-*•]\s+/.test(l)) return `<li>${inline(l.replace(/^[-*•]\s+/, ''))}</li>`;
    if (/^---+$/.test(l)) return '<hr/>';
    return `<p>${inline(l)}</p>`;
  }).join('').replace(/(<li>.*?<\/li>)+/g, (m) => `<ul>${m}</ul>`);
  return <div className={`o-md${compact ? ' compact' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Identity card for a lead: everything the system knows, with its ORB id, in the brand theme. */
/* oxlint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions, jsx-a11y/prefer-tag-over-role -- backdrop click + Escape close the dialog */
function LeadCard({ t, lead, onClose, onOutreach }: { t: T; lead: Lead; onClose: () => void; onOutreach?: (l: Lead) => void }) {
  const [copied, setCopied] = useState('');
  const copy = async (label: string, value: string) => { try { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ } };
  const id = leadId(lead);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const facts: [string, string | null | undefined][] = [
    [t('Company', 'الشركة'), lead.company],
    [t('Industry', 'المجال'), lead.industry],
    [t('Employees', 'الموظفون'), lead.employees ? `${lead.employees}${lead.employee_growth ? ` (${lead.employee_growth})` : ''}` : null],
    [t('Revenue', 'الإيرادات'), lead.revenue_range],
    [t('Funding', 'التمويل'), lead.total_funding],
    [t('Founded', 'التأسيس'), lead.founded],
    [t('Headquarters', 'المقر'), lead.headquarters],
    [t('Location', 'الموقع'), lead.location],
    [t('Published', 'النشر'), lead.published ? new Date(lead.published).toLocaleDateString() : null],
  ];
  const groups: [string, string[]][] = [
    [t('Sales / Marketing', 'مبيعات / تسويق'), ['sales', 'marketing']],
    [t('Executive', 'تنفيذي'), ['executive', 'named']],
    [t('General / Support', 'عام / دعم'), ['general', 'support', 'careers']],
  ];
  const allEmails = lead.emails.map((e) => e.email).join(', ');
  return (
    <div className="o-backdrop" onClick={onClose}>
      <div className="o-card-id" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={id}>
        <div className="o-card-id-head">
          {lead.cover ? <img className="o-card-id-cover" src={lead.cover} alt="" /> : <div className="o-card-id-cover brand" />}
          <button className="o-iconbtn o-card-id-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
          <div className="o-card-id-identity">
            <div className="o-card-id-avatar"><LeadAvatar lead={lead} /></div>
            <div className="o-card-id-titles">
              <h2>{lead.name || lead.title || '—'}</h2>
              <p>{lead.headline}</p>
              <div className="o-flex" style={{ flexWrap: 'wrap', marginTop: 8 }}>
                <span className="o-id lg">{id}</span>
                <Chip tone={lead.kind === 'person' ? 'violet' : lead.kind === 'company' ? 'sky' : 'orange'}>{lead.kind || 'page'}</Chip>
                <Chip tone="neutral">{lead.source}</Chip>
                {lead.channel && <Chip tone="green">Agent Reach · {lead.channel}</Chip>}
              </div>
            </div>
          </div>
        </div>
        <div className="o-card-id-body">
          <div className="o-card-id-col">
            <h3>{t('Company facts', 'بيانات الشركة')}</h3>
            <dl className="o-facts">
              {facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              {!facts.some(([, v]) => v) && <p className="o-muted">{t('No structured facts on this record yet. Run Enrich.', 'لا توجد بيانات مهيكلة بعد. شغّل الإثراء.')}</p>}
            </dl>
            {lead.performance && <><h3>{t('Performance', 'الأداء')}</h3><p className="o-perf">{lead.performance}</p></>}
            <h3>{t('Emails', 'الإيميلات')}</h3>
            {lead.emails.length ? groups.map(([label, roles]) => {
              const list = lead.emails.filter((e) => roles.includes(e.role));
              return list.length ? (
                <div key={label} className="o-email-group">
                  <small>{label}</small>
                  {list.map((e) => <button key={e.email} className="o-email" onClick={() => copy(e.email, e.email)} title={`${e.consent} · ${e.source}`}>{e.email}<Copy size={12} /></button>)}
                </div>
              ) : null;
            }) : <p className="o-muted">{t('No published emails found. Run Enrich to read the company website.', 'لا توجد إيميلات منشورة. شغّل الإثراء لقراءة موقع الشركة.')}</p>}
          </div>
          <div className="o-card-id-col">
            <h3>{t('Notes', 'ملاحظات')}</h3>
            <Md text={lead.notes || ''} />
            <h3>{t('Sources', 'المصادر')}</h3>
            <div className="o-links">
              {lead.linkedin_url && <a href={lead.linkedin_url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> LinkedIn</a>}
              {lead.homepage && <a href={lead.homepage.startsWith('http') ? lead.homepage : `https://${lead.homepage}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /> {lead.homepage.replace(/^https?:\/\//, '')}</a>}
              {lead.source_url && !lead.linkedin_url && <a href={lead.source_url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> {t('Source', 'المصدر')}</a>}
            </div>
            <p className="o-muted" style={{ fontSize: 11, marginTop: 10 }}>{t('Fetched', 'تم الجلب')} {lead.fetched_at ? new Date(lead.fetched_at).toLocaleString() : '—'} · {t('via Agent Reach', 'عبر Agent Reach')}</p>
          </div>
        </div>
        <div className="o-card-id-foot">
          <Btn variant="secondary" size="sm" icon={Copy} onClick={() => copy('id', id)}>{copied === 'id' ? t('Copied', 'تم النسخ') : t('Copy ID', 'نسخ المعرّف')}</Btn>
          {allEmails && <Btn variant="secondary" size="sm" icon={Mail} onClick={() => copy('emails', allEmails)}>{copied === 'emails' ? t('Copied', 'تم النسخ') : t('Copy all emails', 'نسخ كل الإيميلات')}</Btn>}
          <Btn variant="secondary" size="sm" icon={Copy} onClick={() => copy('json', JSON.stringify(lead, null, 2))}>{copied === 'json' ? t('Copied', 'تم النسخ') : 'JSON'}</Btn>
          {copied && copied !== 'id' && copied !== 'emails' && copied !== 'json' && <Chip tone="green">{copied} {t('copied', 'نُسخ')}</Chip>}
          <span style={{ flex: 1 }} />
          {onOutreach && lead.emails.length > 0 && <Btn size="sm" variant="ai" icon={MessageSquare} onClick={() => onOutreach(lead)}>{t('Start outreach', 'بدء التواصل')}</Btn>}
          <Btn size="sm" onClick={() => window.open(lead.source_url, '_blank')} icon={ExternalLink}>{t('Open profile', 'فتح الملف')}</Btn>
        </div>
      </div>
    </div>
  );
}

/* oxlint-enable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions, jsx-a11y/prefer-tag-over-role */

/** All saved runs across Lead Finder and Market Research. */
function HistoryPage({ t, onOpen }: { t: T; onOpen: (id: string, mode: string) => void }) {
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [error, setError] = useState('');
  const load = async () => { try { setRuns(await invoke<RunMeta[]>('run_list')); } catch (e) { setError(String(e)); } };
  /* oxlint-disable react/react-compiler -- load once */
  useEffect(() => { void load(); }, []);
  /* oxlint-enable react/react-compiler */
  const remove = async (id: string) => { try { await invoke('run_delete', { id }); await load(); } catch (e) { setError(String(e)); } };
  const total = runs.reduce((a, r) => a + r.count, 0);
  return (
    <>
      <PageHead eyebrow={t('Local · never leaves this machine', 'محلي · لا يغادر هذا الجهاز')} title={t('Research history', 'سجل البحث')} sub={t('Every Lead Finder and Market Research run is saved here with all its records. Open one to continue enriching or exporting.', 'كل عملية بحث عن عملاء أو أبحاث سوق تُحفظ هنا بكل سجلاتها. افتح أي واحدة لمتابعة الإثراء أو التصدير.')} actions={<Btn variant="secondary" size="sm" onClick={load}>{t('Refresh', 'تحديث')}</Btn>} />
      {error && <div className="o-result error">{error}</div>}
      <div className="o-grid o-grid-3">
        <StatCard icon={History} label={t('Saved runs', 'عمليات محفوظة')} value={String(runs.length)} trend={null} tone="violet" />
        <StatCard icon={Users} label={t('Records', 'سجلات')} value={total.toLocaleString()} trend={null} tone="sky" />
        <StatCard icon={Mail} label={t('Enriched runs', 'عمليات مُثراة')} value={String(runs.filter((r) => r.enriched).length)} trend={null} tone="green" />
      </div>
      <Card>
        {runs.length ? (
          <Table columns={[t('Query', 'الاستعلام'), t('Module', 'الوحدة'), t('Records', 'سجلات'), t('Saved', 'الحفظ'), t('Export', 'التصدير'), '']}>
            {runs.map((r) => (
              <tr key={r.id} className="o-row-click" onClick={() => onOpen(r.id, r.mode)}>
                <td><b>{r.query}</b><br /><span className="o-id">{r.id}</span></td>
                <td><Chip tone={r.mode === 'research' ? 'orange' : r.mode === 'reddit' ? 'coral' : 'violet'}>{r.mode === 'research' ? t('Market Research', 'أبحاث السوق') : r.mode === 'reddit' ? 'Reddit' : t('Lead Finder', 'البحث عن العملاء')}</Chip></td>
                <td>{r.count.toLocaleString()} / {r.target}{r.enriched ? <Chip tone="green"> ✓</Chip> : null}</td>
                <td>{new Date(r.saved_at).toLocaleString()}</td>
                <td style={{ fontSize: 11 }}>{r.export?.paths?.xlsx ? 'XLSX' : r.export?.paths?.csv ? 'CSV' : '—'}</td>
                <td><button className="o-more" onClick={(e) => { e.stopPropagation(); void remove(r.id); }} aria-label="Delete"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState icon={History} title={t('No saved runs yet', 'لا توجد عمليات محفوظة بعد')} text={t('Run Lead Finder or Market Research; results are saved automatically when the run finishes.', 'شغّل البحث عن العملاء أو أبحاث السوق؛ تُحفظ النتائج تلقائياً عند انتهاء العملية.')} />
        )}
      </Card>
    </>
  );
}

type OMsg = { id: string; direction: 'out' | 'in'; subject: string; body: string; at: string; provider?: string | null; step: number; external_id?: string | null; template_id?: string | null; variant_id?: string | null };
type OVariant = { id: string; label: string; subject: string; body: string; angle?: string };
type OTemplate = { id: string; name: string; subject: string; body: string; variants: OVariant[]; created_at: string; updated_at: string; in_rotation?: boolean };
type OThread = { id: string; lead_id?: string | null; name: string; company?: string | null; email: string; status: string; messages: OMsg[]; pending_draft?: { subject: string; body: string; step: number; at: string; source: string } | null; pending_reply?: { subject: string; body: string; step: number; at: string; source: string } | null; followup_count: number; max_followups: number; interval_days: number; next_followup_at?: string | null; last_activity: string; sequence_id?: string | null; lead?: Lead | null; notes?: string | null; unread: boolean };
type OStep = { delay_days: number; subject: string; body: string };
type OState = { threads: OThread[]; sequences: { id: string; name: string; steps: OStep[] }[]; style: { samples: string[]; guide: string; signature: string; learned: { draft: string; final_text: string; at: string }[]; language: string }; settings: { send_via: string; auto_followup: boolean; default_max_followups: number; default_interval_days: number; default_template_id?: string | null; variant_mode: string; auto_reply?: boolean }; updated_at: string; templates: OTemplate[]; campaigns?: { id: string; name: string; thread_ids: string[]; template_id?: string | null; scheduled_at: string; status: string }[] };

function CampaignsPage({ t }: { t: T }) {
  const [st, setSt] = useState<OState | null>(null); const [selected, setSelected] = useState<string[]>([]); const [name, setName] = useState(''); const [template, setTemplate] = useState(''); const [schedule, setSchedule] = useState(new Date().toISOString().slice(0, 16)); const [msg, setMsg] = useState('');
  const [mb, setMb] = useState<MBox[]>([]);
  const [job, setJob] = useState<{ id: string; label: string; percent: number; done?: boolean } | null>(null);
  const jobU = useRef<UnlistenFn | null>(null);
  const load = () => { void Promise.all([invoke<OState>('outreach_state'), invoke<{ mailboxes: MBox[] }>('integrations_status')]).then(([s, i]) => { setSt(s); setMb(i.mailboxes || []); setTemplate((tt) => tt || s.settings.default_template_id || s.templates[0]?.id || ''); }).catch((e) => setMsg(String(e))); };
  /* oxlint-disable react/react-compiler -- load once; clean up listener */
  useEffect(() => { load(); return () => { jobU.current?.(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */
  const runCampaign = async (cid: string, cname: string) => {
    const id = `campaign-run-${jobSeq()}`;
    try { if (!(await isPermissionGranted())) await requestPermission(); } catch { /* ignore */ }
    jobU.current?.();
    jobU.current = await listen<Record<string, unknown>>(`jobs://${id}`, (ev) => {
      const e = ev.payload as { type: string; percent?: number; label?: string; done?: number; total?: number; failed?: number; error?: string };
      if (e.type === 'start') setJob({ id, label: t(`Sending “${cname}” to ${e.total} contacts`, `إرسال “${cname}” إلى ${e.total} جهة`), percent: 0 });
      else if (e.type === 'progress' || e.type === 'item') setJob({ id, label: e.label || cname, percent: e.percent ?? 0 });
      else if (e.type === 'done') { setJob({ id, label: t(`${e.done} sent${e.failed ? `, ${e.failed} failed` : ''}`, `${e.done} مُرسل${e.failed ? `، ${e.failed} فشل` : ''}`), percent: 100, done: true }); jobU.current?.(); jobU.current = null; load(); setTimeout(() => setJob((j) => (j?.id === id ? null : j)), 8000); }
      else if (e.type === 'error' || e.type === 'cancelled') { setJob({ id, label: e.error || t('Stopped', 'توقف'), percent: 100, done: true }); jobU.current?.(); jobU.current = null; load(); }
    });
    try { await invoke('outreach_campaign_run', { jobId: id, campaignId: cid }); } catch (e) { setMsg(String(e)); }
  };
  const delCampaign = async (cid: string) => { try { const s = await invoke<OState>('outreach_campaign_delete', { id: cid }); setSt(s); } catch (e) { setMsg(String(e)); } };
  if (!st) return <EmptyState icon={Send} title={t('Loading campaigns…', 'جاري تحميل الحملات…')} text="" />;
  const leads = st.threads.filter((x) => x.email); const active = mb.filter((x) => x.enabled); const cap = active.reduce((n, x) => n + x.daily_cap, 0); const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const create = async () => { try { const s = await invoke<OState>('outreach_create_campaign', { name, threadIds: selected, templateId: template || null, variantMode: 'rotate', sequenceId: st.sequences[0]?.id || null, scheduledAt: new Date(schedule).toISOString() }); setSt(s); setSelected([]); setName(''); load(); setMsg(t('Campaign scheduled. Click Run now below to send the first email to every contact, rotated across your mailboxes.', 'تمت جدولة الحملة. اضغط تشغيل الآن بالأسفل لإرسال الرسالة الأولى لكل جهة، موزعة على صناديقك.')); } catch (e) { setMsg(String(e)); } };
  return <><PageHead eyebrow={t('Outbound orchestration', 'تنسيق الإرسال')} title={t('Campaigns', 'الحملات')} spark={false} sub={t('Select CRM leads, build a sequence, and schedule a paced campaign across your enabled mailboxes.', 'اختر عملاء CRM، أنشئ تسلسلاً، وجدول حملة موزعة عبر صناديق الإرسال المفعّلة.')} actions={<Btn icon={Send} onClick={create} disabled={!selected.length}>{t('Schedule campaign', 'جدولة الحملة')}</Btn>} />
    {msg && <div className="o-result"><Check size={16} />{msg}</div>}<div className="o-grid o-grid-2"><Card><CardHead title={t('Campaign setup', 'إعداد الحملة')} sub={t('Templates, variants and follow-ups use the same Outreach rules.', 'القوالب والنسخ والمتابعات تستخدم قواعد التواصل نفسها.')} /><div className="o-form-grid"><label className="o-field">{t('Name', 'الاسم')}<input className="o-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Spring outreach', 'حملة الربيع')} /></label><label className="o-field">{t('Template', 'القالب')}<select className="o-input" value={template} onChange={(e) => setTemplate(e.target.value)}><option value="">{t('No template / draft in Outreach', 'بدون قالب / مسودة في التواصل')}</option>{st.templates.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.variants.length} {t('variants', 'نسخ')}</option>)}</select></label><label className="o-field">{t('Start at', 'تبدأ في')}<input className="o-input" type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} /></label><label className="o-field">{t('Follow-ups', 'المتابعات')}<input className="o-input" value={`${st.settings.default_max_followups} · ${st.settings.default_interval_days} ${t('days', 'أيام')}`} readOnly /></label></div></Card>
      <Card><CardHead title={t('Rotation preview', 'معاينة التناوب')} sub={t('Enabled mailbox caps determine effective daily capacity.', 'حدود الصناديق المفعّلة تحدد السعة اليومية الفعلية.')} /><div className="o-grid o-grid-2"><StatCard icon={Mail} label={t('Effective capacity', 'السعة الفعلية')} value={`${cap}/day`} trend={null} tone="green" /><StatCard icon={Users} label={t('Selected leads', 'العملاء المختارون')} value={String(selected.length)} trend={null} tone="violet" /></div>{active.map((x) => <div className="o-row" key={x.id}><IconTile icon={Mail} tone="green" /><div><b>{x.label}</b><small>{x.from} · {x.sent_today}/{x.daily_cap} {t('today', 'اليوم')}</small></div><Chip tone="neutral">{t('rotates', 'يتناوب')}</Chip></div>)}{!active.length && <p className="o-note">{t('Connect an enabled mailbox under Integrations before scheduling.', 'اربط صندوق إرسال مفعّلاً من التكاملات قبل الجدولة.')}</p>}</Card></div>
    <Card><CardHead title={t('Select CRM leads', 'اختر عملاء CRM')} sub={t(`${selected.length} selected · only contacts with email can be scheduled`, `${selected.length} مختار · يمكن جدولة جهات الاتصال التي لديها إيميل فقط`)} action={<Btn size="sm" variant="secondary" onClick={() => setSelected(selected.length === leads.length ? [] : leads.map((x) => x.id))}>{t('Select all', 'اختيار الكل')}</Btn>} />{leads.map((x) => <label className="o-row" key={x.id}><input type="checkbox" checked={selected.includes(x.id)} onChange={() => toggle(x.id)} /><Avatar text={(x.name || x.email)[0]} /><div><b>{x.name}</b><small>{x.company || '—'} · {x.email}</small></div><Chip tone={x.status === 'draft' ? 'neutral' : 'violet'}>{x.status}</Chip></label>)}{!leads.length && <EmptyState icon={Users} title={t('No CRM leads yet', 'لا يوجد عملاء CRM بعد')} text={t('Add leads with emails to Outreach first.', 'أضف عملاء لديهم إيميلات إلى التواصل أولاً.')} />}</Card>
    {job && <div className={`o-loader${job.done ? '' : ''}`}><div className="o-loader-head"><span className={`o-spinner${job.done ? ' done' : ''}`} /><b>{job.percent}%</b><span className="o-loader-label">{job.label}</span></div><div className="o-progress lg"><i style={{ width: `${job.percent}%` }} /></div></div>}
    <Card><CardHead title={t('Scheduled campaigns', 'الحملات المجدولة')} sub={t('Run a campaign to send the first email to every contact now, rotating mailboxes with your spacing and caps.', 'شغّل حملة لإرسال الرسالة الأولى لكل جهة الآن، بتناوب الصناديق مع التباعد والحدود.')} />
      {(st.campaigns || []).length ? <Table columns={[t('Campaign', 'الحملة'), t('Contacts', 'جهات'), t('Status', 'الحالة'), t('Scheduled', 'مجدولة'), '']}>{(st.campaigns || []).slice().reverse().map((c) => <tr key={c.id}><td><b>{c.name}</b></td><td>{c.thread_ids.length}</td><td><Chip tone={c.status === 'sent' ? 'green' : c.status === 'running' ? 'violet' : c.status === 'partial' ? 'orange' : c.status === 'paused' ? 'coral' : 'neutral'}>{c.status}</Chip></td><td>{new Date(c.scheduled_at).toLocaleString()}</td><td><div className="o-flex">{(c.status === 'scheduled' || c.status === 'partial' || c.status === 'paused') && <Btn size="sm" icon={Send} onClick={() => runCampaign(c.id, c.name)} disabled={!!job && !job.done || !active.length}>{t('Run now', 'تشغيل الآن')}</Btn>}<button className="o-more" aria-label="Delete" onClick={() => delCampaign(c.id)}><Trash2 size={14} /></button></div></td></tr>)}</Table> : <EmptyState icon={Send} title={t('No campaigns yet', 'لا توجد حملات بعد')} text={t('Select leads above and schedule your first campaign.', 'اختر عملاء بالأعلى وجدول حملتك الأولى.')} />}</Card>
  </>;
}

const STATUS_TONE: Record<string, Tone> = { draft: 'neutral', sent: 'violet', followup_due: 'orange', replied: 'green', closed: 'neutral', bounced: 'coral' };

function pickEmail(l: Lead) {
  const order = ['executive', 'named', 'sales', 'general', 'marketing', 'support'];
  for (const r of order) { const e = l.emails.find((x) => x.role === r); if (e) return e.email; }
  return l.emails[0]?.email || '';
}

function Outreach({ t, seed, onSeeded }: { t: T; seed: Lead[] | null; onSeeded: () => void }) {
  const [st, setSt] = useState<OState | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'awaiting' | 'due' | 'replied' | 'draft'>('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: 'green' | 'coral'; text: string } | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [draftRef, setDraftRef] = useState('');
  const [used, setUsed] = useState<{ template_id?: string; variant_id?: string; variant_label?: string } | null>(null);
  const [variantPick, setVariantPick] = useState('auto');
  const [panel, setPanel] = useState<'none' | 'style' | 'sequence' | 'lead' | 'followups'>('none');
  const [queue, setQueue] = useState<Record<string, { subject: string; body: string; step: number; source: string }>>({});
  const [samples, setSamples] = useState<string[]>(['', '', '']);
  const [signature, setSignature] = useState('');
  const [lang, setLang] = useState('en');
  const [autoTimer, setAutoTimer] = useState<number | null>(null);
  const [mailboxCount, setMailboxCount] = useState(0);
  /* oxlint-disable react/react-compiler -- read enabled mailbox count once */
  useEffect(() => { void invoke<{ mailboxes?: { enabled: boolean }[] }>('integrations_status').then((s) => setMailboxCount((s.mailboxes || []).filter((m) => m.enabled).length)).catch(() => undefined); }, []);
  /* oxlint-enable react/react-compiler */

  const load = async () => { try { const s = await invoke<OState>('outreach_state'); setSt(s); setSamples([...(s.style.samples.length ? s.style.samples : ['', '', '']), '']); setSignature(s.style.signature); setLang(s.style.language); return s; } catch (e) { setMsg({ tone: 'coral', text: String(e) }); return null; } };
  const persist = async (s: OState) => { try { const saved = await invoke<OState>('outreach_save', { state: s }); setSt(saved); return saved; } catch (e) { setMsg({ tone: 'coral', text: String(e) }); return null; } };
  /* oxlint-disable react/react-compiler -- load once; seed threads when leads arrive */
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!seed || !st) return;
    const now = new Date().toISOString();
    const existing = new Set(st.threads.map((x) => x.email.toLowerCase()));
    const fresh: OThread[] = seed.filter((l) => pickEmail(l) && !existing.has(pickEmail(l).toLowerCase())).map((l) => ({
      id: `${leadId(l)}-${pickEmail(l).toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 60), lead_id: leadId(l), name: l.name || l.company || l.title || pickEmail(l), company: l.company, email: pickEmail(l), status: 'draft', messages: [],
      followup_count: 0, max_followups: st.settings.default_max_followups, interval_days: st.settings.default_interval_days, next_followup_at: null, last_activity: now, sequence_id: st.sequences[0]?.id || 'default', lead: l, notes: null, unread: false,
    }));
    void persist({ ...st, threads: [...fresh, ...st.threads] }).then(() => { setMsg({ tone: 'green', text: t(`${fresh.length} contacts added to Outreach (${seed.length - fresh.length} already there or without email)`, `تمت إضافة ${fresh.length} جهة اتصال (${seed.length - fresh.length} موجودة أو بدون إيميل)`) }); if (fresh[0]) setSel(fresh[0].id); });
    onSeeded();
  }, [seed, st?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */

  const thread = st?.threads.find((x) => x.id === sel) || null;
  const nowIso = new Date().toISOString();
  const isDue = (x: OThread) => x.status === 'sent' && x.followup_count < x.max_followups && !!x.next_followup_at && x.next_followup_at <= nowIso;
  const list = (st?.threads || []).filter((x) => {
    if (q && !`${x.name} ${x.company || ''} ${x.email}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'awaiting') return x.status === 'sent' && !isDue(x);
    if (filter === 'due') return isDue(x);
    if (filter === 'replied') return x.status === 'replied';
    if (filter === 'draft') return x.status === 'draft';
    return true;
  }).sort((a2, b) => (b.last_activity || '').localeCompare(a2.last_activity || ''));
  const counts = { total: st?.threads.length || 0, sent: (st?.threads || []).filter((x) => x.messages.some((m) => m.direction === 'out')).length, due: (st?.threads || []).filter(isDue).length, replied: (st?.threads || []).filter((x) => x.status === 'replied').length, drafts: (st?.threads || []).filter((x) => x.status === 'draft').length, followups: (st?.threads || []).reduce((n, x) => n + x.followup_count, 0), enriched: (st?.threads || []).filter((x) => x.lead?.emails?.length).length };
  const nextStep = (x: OThread) => x.messages.filter((m) => m.direction === 'out').length + 1;

  const act = async (k: string, fn: () => Promise<string | void>) => { setBusy(k); setMsg(null); try { const r = await fn(); if (r) setMsg({ tone: 'green', text: r }); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const autofill = (x: OThread) => act('fill', async () => { const r = await invoke<{ subject: string; body: string; template_id: string; variant_id: string; variant_label: string }>('outreach_fill', { threadId: x.id, templateId: st?.settings.default_template_id ?? null, variantId: variantPick === 'auto' ? null : variantPick }); setSubject(r.subject); setBody(r.body); setDraftRef(''); setUsed(r); return t(`Template auto-filled (${r.variant_label}). Review and send.`, `تم ملء القالب تلقائياً (${r.variant_label}). راجع وأرسل.`); });
  const fillAndSendDrafts = () => act('bulk', async () => {
    const s = await load(); if (!s) return;
    const drafts = s.threads.filter((x) => x.status === 'draft' && x.email);
    let n = 0;
    for (const x of drafts) { const r = await invoke<{ subject: string; body: string; template_id: string; variant_id: string }>('outreach_fill', { threadId: x.id, templateId: s.settings.default_template_id ?? null, variantId: null }); await invoke('outreach_send', { threadId: x.id, subject: r.subject, body: r.body, step: 1, templateId: r.template_id, variantId: r.variant_id }); n++; }
    await load(); void invoke('workspace_log', { kind: 'outreach', text: `Auto-filled template and sent first email to ${n} contacts` }); void invoke('notify', { kind: 'email', title: t(`${n} first emails sent`, `تم إرسال ${n} رسالة أولى`), text: t('Bulk send from your templates finished.', 'اكتمل الإرسال الجماعي من قوالبك.'), link: 'outreach' });
    return t(`${n} first emails sent from the template`, `تم إرسال ${n} رسالة أولى من القالب`);
  });
  const aiReply = (x: OThread) => act('aireply', async () => { const d = await invoke<{ subject: string; body: string }>('outreach_draft_reply', { threadId: x.id }); setSubject(d.subject); setBody(d.body); setDraftRef(d.body); setUsed(null); return t('AI negotiation reply drafted. Review and send.', 'تمت صياغة رد تفاوضي بالذكاء الاصطناعي. راجع وأرسل.'); });
  const draft = (x: OThread, step = nextStep(x)) => act('draft', async () => { const d = await invoke<{ subject: string; body: string }>('outreach_draft', { threadId: x.id, step }); setSubject(d.subject); setBody(d.body); setDraftRef(d.body); return t(`Draft for step ${step} ready in your style. Edit freely, the model learns from your changes.`, `المسودة للخطوة ${step} جاهزة بأسلوبك. عدّل بحرية، النموذج يتعلم من تعديلاتك.`); });
  const send = (x: OThread) => act('send', async () => {
    if (!subject.trim() || !body.trim()) throw new Error(t('Subject and body are required', 'العنوان والمحتوى مطلوبان'));
    const step = nextStep(x);
    if (draftRef) await invoke('outreach_record_edit', { draft: draftRef, finalText: body });
    await invoke<OThread>('outreach_send', { threadId: x.id, subject, body, step, templateId: used?.template_id ?? null, variantId: used?.variant_id ?? null });
    if (st) void persist({ ...st, threads: st.threads.map((y) => (y.id === x.id ? { ...y, pending_draft: null } : y)) });
    setSubject(''); setBody(''); setDraftRef(''); setUsed(null);
    void invoke('notify', { kind: 'email', title: t(`Email sent to ${x.name}`, `تم إرسال رسالة إلى ${x.name}`), text: `${subject} → ${x.email}`, link: 'outreach' });
    await load();
    void invoke('workspace_log', { kind: 'outreach', text: `Sent step ${step} to ${x.name} <${x.email}>` });
    return t(`Sent to ${x.email} (step ${step})`, `تم الإرسال إلى ${x.email} (الخطوة ${step})`);
  });
  const sendDue = () => act('due', async () => {
    const s = await load(); if (!s) return;
    const dueList = s.threads.filter(isDue);
    let n = 0;
    for (const x of dueList) {
      const step = nextStep(x);
      const d = await invoke<{ subject: string; body: string }>('outreach_draft', { threadId: x.id, step });
      await invoke('outreach_send', { threadId: x.id, subject: d.subject, body: d.body, step });
      n++;
    }
    await load(); if (n) void invoke('notify', { kind: 'email', title: t(`${n} follow-ups sent`, `تم إرسال ${n} متابعة`), text: t('Automatic follow-ups went out.', 'خرجت المتابعات التلقائية.'), link: 'outreach' });
    return t(`${n} follow-ups sent`, `تم إرسال ${n} متابعة`);
  });
  const prepareQueue = async () => {
    const s = await load(); if (!s) return;
    const due = s.threads.filter(isDue);
    const next: Record<string, { subject: string; body: string; step: number; source: string }> = { ...queue };
    for (const x of due) { if (next[x.id]) continue; try { const r = await invoke<{ subject: string; body: string; step: number }>('outreach_fill_step', { threadId: x.id, step: nextStep(x) }); next[x.id] = { ...r, source: 'template' }; } catch { /* skip */ } }
    setQueue(next);
  };
  const queueDraftAi = (x: OThread) => act('qdraft-' + x.id, async () => { const d = await invoke<{ subject: string; body: string }>('outreach_draft', { threadId: x.id, step: nextStep(x) }); setQueue((q) => ({ ...q, [x.id]: { subject: d.subject, body: d.body, step: nextStep(x), source: 'ai' } })); return t(`AI draft ready for ${x.name}`, `مسودة الذكاء الاصطناعي جاهزة لـ ${x.name}`); });
  const queueSend = (x: OThread) => act('qsend-' + x.id, async () => { const q = queue[x.id]; if (!q) throw new Error('no draft'); await invoke('outreach_send', { threadId: x.id, subject: q.subject, body: q.body, step: q.step, templateId: null, variantId: null }); setQueue((qq) => { const c = { ...qq }; delete c[x.id]; return c; }); await load(); void invoke('workspace_log', { kind: 'outreach', text: `Approved follow-up ${q.step - 1} to ${x.name}` }); return t(`Follow-up sent to ${x.email}`, `تم إرسال المتابعة إلى ${x.email}`); });
  const queueAction = (x: OThread, action: 'postpone' | 'stop' | 'close') => act('qact-' + x.id, async () => { await invoke('outreach_followup_action', { threadId: x.id, action, days: 2 }); setQueue((qq) => { const c = { ...qq }; delete c[x.id]; return c; }); await load(); return action === 'postpone' ? t(`Postponed 2 days: ${x.name}`, `تم التأجيل يومين: ${x.name}`) : action === 'stop' ? t(`Sequence stopped for ${x.name}`, `تم إيقاف التسلسل لـ ${x.name}`) : t(`Closed: ${x.name}`, `تم الإغلاق: ${x.name}`); });
  const sync = () => act('sync', async () => { const r = await invoke<{ found: number; auto_sent: number; drafted: number; bounced?: number }>('outreach_sync'); await load(); return t(`${r.found} new replies · ${r.auto_sent} auto-answered · ${r.drafted} drafts ready${r.bounced ? ` · ${r.bounced} bounced` : ''}`, `${r.found} رد جديد · ${r.auto_sent} رُدّ تلقائياً · ${r.drafted} مسودة جاهزة${r.bounced ? ` · ${r.bounced} ارتد` : ''}`); });
  const learn = () => act('learn', async () => { const s = await invoke<OState>('outreach_learn_style', { samples: samples.filter((x) => x.trim()), signature, language: lang }); setSt(s); void invoke('workspace_log', { kind: 'style', text: 'Writing style learned from samples' }); return t('Style learned. New drafts will follow it.', 'تم تعلّم الأسلوب. المسودات الجديدة ستتبعه.'); });
  const update = (patch: Partial<OThread>) => { if (!st || !thread) return; void persist({ ...st, threads: st.threads.map((x) => (x.id === thread.id ? { ...x, ...patch } : x)) }); };
  const setSettings = (patch: Partial<OState['settings']>) => { if (!st) return; void persist({ ...st, settings: { ...st.settings, ...patch } }); };
  const removeThread = (id: string) => { if (!st) return; void persist({ ...st, threads: st.threads.filter((x) => x.id !== id) }); if (sel === id) setSel(null); };

  // Opt-in auto follow-ups: every 10 minutes while this page is open.
  /* oxlint-disable react/react-compiler -- interval handle kept in state */
  useEffect(() => {
    if (autoTimer) window.clearInterval(autoTimer);
    if (st?.settings.auto_followup) { const id = window.setInterval(() => { void sendDue(); }, 10 * 60 * 1000); setAutoTimer(id); return () => window.clearInterval(id); }
    return undefined;
  }, [st?.settings.auto_followup]); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */

  const seq = st?.sequences.find((s2) => s2.id === (thread?.sequence_id || 'default')) || st?.sequences[0];
  const pipeline = [
    { k: 'leads', label: t('Contacts', 'جهات الاتصال'), v: counts.total, icon: Users },
    { k: 'enriched', label: t('With emails', 'لديهم إيميل'), v: counts.enriched, icon: Mail },
    { k: 'drafts', label: t('Drafts', 'مسودات'), v: counts.drafts, icon: Sparkles },
    { k: 'sent', label: t('Sent', 'مُرسل'), v: counts.sent, icon: Send },
    { k: 'followups', label: t('Follow-ups', 'متابعات'), v: counts.followups, icon: RefreshCw },
    { k: 'replied', label: t('Replied', 'ردّوا'), v: counts.replied, icon: MessageSquare },
  ];

  return (
    <>
      <PageHead
        eyebrow={t('Communication hub', 'مركز التواصل')}
        title={t('Outreach', 'التواصل')}
        spark={false}
        sub={t('Every contact is a conversation: drafts in your style, sends over SMTP, automatic follow-ups with a cap, and replies pulled from your inbox over IMAP.', 'كل جهة اتصال محادثة: مسودات بأسلوبك، إرسال عبر SMTP، متابعات تلقائية بحدّ أقصى، وردود تُسحب من صندوقك عبر IMAP.')}
        actions={
          <>
            <Btn variant="secondary" size="sm" icon={RefreshCw} onClick={sync} disabled={!!busy}>{busy === 'sync' ? t('Checking inbox…', 'جاري فحص الصندوق…') : t('Sync replies', 'مزامنة الردود')}</Btn>
            <Btn size="sm" icon={RefreshCw} onClick={() => { setPanel(panel === 'followups' ? 'none' : 'followups'); void prepareQueue(); }} disabled={!!busy || !counts.due}>{t(`Review due follow-ups (${counts.due})`, `مراجعة المتابعات المستحقة (${counts.due})`)}</Btn>
            {counts.due > 0 && <Btn variant="ai" size="sm" icon={Send} onClick={() => { if (window.confirm(t(`Draft and send all ${counts.due} due follow-ups now? Sends are spaced and capped by your rate limits (Settings).`, `صياغة وإرسال كل المتابعات المستحقة (${counts.due}) الآن؟ الإرسال متباعد ومحدود حسب حدود الاستخدام (الإعدادات).`))) void sendDue(); }} disabled={!!busy}>{busy === 'due' ? t('Sending…', 'جاري الإرسال…') : t(`Send ${counts.due} due now`, `أرسل المستحقة الآن (${counts.due})`)}</Btn>}
            <Btn variant="secondary" size="sm" icon={Sparkles} onClick={() => setPanel(panel === 'style' ? 'none' : 'style')}>{t('My writing style', 'أسلوبي في الكتابة')}</Btn>
            {counts.drafts > 0 && st?.templates.length ? <Btn variant="ai" size="sm" icon={FileText} onClick={() => { if (window.confirm(t(`Auto-fill the template and send the first email to ${counts.drafts} draft contacts now? Sends are spaced and capped by your rate limits (Settings).`, `ملء القالب وإرسال الرسالة الأولى إلى ${counts.drafts} جهة اتصال الآن؟ الإرسال متباعد ومحدود حسب حدود الاستخدام (الإعدادات).`))) void fillAndSendDrafts(); }} disabled={!!busy}>{busy === 'bulk' ? t('Sending…', 'جاري الإرسال…') : t(`Fill & send ${counts.drafts} drafts`, `ملء وإرسال ${counts.drafts} مسودة`)}</Btn> : null}
          </>
        }
      />
      {msg && <div className={`o-result${msg.tone === 'coral' ? ' error' : ''}`}><Check size={16} />{msg.text}</div>}

      <div className="o-pipeline">
        {pipeline.map((p, i) => { const I = p.icon; return (
          <div key={p.k} className={`o-pipe-step${p.v ? ' on' : ''}`}>
            <IconTile icon={I} tone={p.v ? 'violet' : 'neutral'} />
            <div><b>{p.v}</b><small>{p.label}</small></div>
            {i < pipeline.length - 1 && <span className="o-pipe-arrow" />}
          </div>
        ); })}
        <div className="o-pipe-settings">
          <label className="o-flex" style={{ fontSize: 12 }} title={t('When on, due follow-ups are sent without review every 10 minutes while Outreach is open', 'عند التفعيل تُرسل المتابعات المستحقة بدون مراجعة كل 10 دقائق أثناء فتح التواصل')}>{t('Auto follow-ups', 'متابعة تلقائية')} <Switch on={!!st?.settings.auto_followup} onChange={(v) => setSettings({ auto_followup: v })} label="Auto follow-ups" /></label>
          <label className="o-flex" style={{ fontSize: 12 }} title={t('When a lead replies, orbit. writes and SENDS a negotiation answer in your style automatically. Off = it drafts one for your approval.', 'عند رد العميل، يكتب orbit. ويُرسل رداً تفاوضياً بأسلوبك تلقائياً. عند الإيقاف = يجهّز مسودة لموافقتك.')}>{t('Auto-negotiate replies', 'تفاوض تلقائي على الردود')} <Switch on={!!st?.settings.auto_reply} onChange={(v) => setSettings({ auto_reply: v })} label="Auto reply" /></label>
          <label className="o-flex" style={{ fontSize: 12 }}>{t('Max', 'الحد')} <input className="o-input" style={{ height: 32, width: 56 }} type="number" min={0} max={8} value={st?.settings.default_max_followups || 3} onChange={(e) => setSettings({ default_max_followups: Number(e.target.value) || 0 })} /></label>
          <label className="o-flex" style={{ fontSize: 12 }}>{t('Every', 'كل')} <input className="o-input" style={{ height: 32, width: 56 }} type="number" min={1} max={30} value={st?.settings.default_interval_days || 3} onChange={(e) => setSettings({ default_interval_days: Number(e.target.value) || 1 })} /> {t('days', 'يوم')}</label>
        </div>
      </div>

      {panel === 'style' && (
        <Card>
          <CardHead title={t('My writing style', 'أسلوبي في الكتابة')} sub={t('Paste 2–5 emails you actually wrote. The model extracts a style guide and imitates it. Every edit you make to a draft before sending is also learned.', 'الصق 2–5 رسائل كتبتها فعلاً. النموذج يستخرج دليل الأسلوب ويقلّده. كل تعديل تجريه على مسودة قبل الإرسال يُتعلَّم أيضاً.')} action={<Chip tone={st?.style.guide ? 'green' : 'neutral'}>{st?.style.guide ? t(`Learned · ${st.style.learned.length} edits`, `مُتعلَّم · ${st.style.learned.length} تعديل`) : t('Not learned yet', 'لم يُتعلَّم بعد')}</Chip>} />
          <div className="o-form-grid">
            {samples.map((s2, i) => <label key={i} className="o-field">{t(`Sample email ${i + 1}`, `رسالة نموذجية ${i + 1}`)}<textarea rows={5} value={s2} onChange={(e) => { const n = [...samples]; n[i] = e.target.value; if (i === n.length - 1 && e.target.value) n.push(''); setSamples(n); }} placeholder={t('Subject: …\n\nHi …', 'الموضوع: …\n\nمرحباً …')} /></label>)}
            <label className="o-field">{t('Signature', 'التوقيع')}<textarea rows={3} value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={'Ahmed\nFounder, Acme\n+20 …'} /></label>
            <label className="o-field">{t('Language', 'اللغة')}<select value={lang} onChange={(e) => setLang(e.target.value)}><option value="en">English</option><option value="ar">العربية</option></select></label>
          </div>
          <div className="o-flex o-mt"><Btn icon={Sparkles} onClick={learn} disabled={!!busy}>{busy === 'learn' ? t('Learning…', 'جاري التعلّم…') : t('Learn my style', 'تعلّم أسلوبي')}</Btn></div>
          {st?.style.guide && <><h3 className="o-eyebrow" style={{ marginTop: 16 }}>{t('Learned style guide', 'دليل الأسلوب المُتعلَّم')}</h3><pre className="o-pre" style={{ maxHeight: 220 }}>{st.style.guide}</pre></>}
        </Card>
      )}

      {panel === 'followups' && (
        <Card>
          <CardHead title={t('Follow-ups awaiting your approval', 'متابعات بانتظار موافقتك')} sub={t('Each one is pre-filled from your sequence step. Edit, draft with AI, then approve. Nothing is sent without your click unless auto follow-ups is on.', 'كل واحدة مملوءة مسبقاً من خطوة التسلسل. عدّل، أو اصنع مسودة بالذكاء الاصطناعي، ثم وافق. لا يُرسل شيء بدون ضغطتك إلا إذا كانت المتابعة التلقائية مفعّلة.')} action={<Btn variant="ghost" size="sm" onClick={() => setPanel('none')}>{t('Close', 'إغلاق')}</Btn>} />
          {(st?.threads || []).filter(isDue).length ? (st?.threads || []).filter(isDue).map((x) => { const q = queue[x.id]; return (
            <div key={x.id} className="o-queue-item">
              <div className="o-between">
                <div className="o-flex"><b>{x.name}</b><span className="o-muted" style={{ fontSize: 12 }}>{x.company ? `${x.company} · ` : ''}{x.email}</span><Chip tone="orange">{t(`Follow-up ${nextStep(x) - 1} of ${x.max_followups}`, `متابعة ${nextStep(x) - 1} من ${x.max_followups}`)}</Chip>{q && <Chip tone={q.source === 'ai' ? 'violet' : 'neutral'}>{q.source === 'ai' ? t('AI draft', 'مسودة ذكية') : t('from sequence', 'من التسلسل')}</Chip>}</div>
                <div className="o-flex">
                  <Btn variant="ghost" size="sm" onClick={() => queueAction(x, 'postpone')} disabled={!!busy}>{t('Postpone 2d', 'تأجيل يومين')}</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => queueAction(x, 'stop')} disabled={!!busy}>{t('Stop sequence', 'إيقاف التسلسل')}</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => queueAction(x, 'close')} disabled={!!busy}>{t('Close', 'إغلاق')}</Btn>
                </div>
              </div>
              {q ? (
                <>
                  <input className="o-input" aria-label="Subject" value={q.subject} onChange={(e) => setQueue({ ...queue, [x.id]: { ...q, subject: e.target.value } })} />
                  <textarea className="o-input o-composer-body" aria-label="Body" rows={5} value={q.body} onChange={(e) => setQueue({ ...queue, [x.id]: { ...q, body: e.target.value } })} />
                  <div className="o-flex">
                    <Btn variant="ai" size="sm" icon={Sparkles} onClick={() => queueDraftAi(x)} disabled={!!busy}>{busy === 'qdraft-' + x.id ? t('Drafting…', 'جاري الصياغة…') : t('Draft with AI in my style', 'مسودة بالذكاء الاصطناعي بأسلوبي')}</Btn>
                    <span style={{ flex: 1 }} />
                    <Btn size="sm" icon={Send} onClick={() => queueSend(x)} disabled={!!busy || !q.subject.trim() || !q.body.trim()}>{busy === 'qsend-' + x.id ? t('Sending…', 'جاري الإرسال…') : t('Approve & send', 'موافقة وإرسال')}</Btn>
                  </div>
                </>
              ) : <p className="o-note">{t('Preparing…', 'جاري التجهيز…')}</p>}
            </div>
          ); }) : <EmptyState icon={Check} title={t('Nothing due', 'لا شيء مستحق')} text={t('Follow-ups appear here on their scheduled day.', 'المتابعات تظهر هنا في يومها المجدول.')} />}
        </Card>
      )}
      <div className="o-chat">
        <aside className="o-chat-list">
          <div className="o-chat-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search contacts…', 'ابحث في جهات الاتصال…')} /></div>
          <div className="o-chat-filters">
            {([['all', t('All', 'الكل'), counts.total], ['draft', t('Drafts', 'مسودات'), counts.drafts], ['awaiting', t('Awaiting', 'بانتظار'), counts.sent - counts.replied - counts.due], ['due', t('Due', 'مستحق'), counts.due], ['replied', t('Replied', 'ردّوا'), counts.replied]] as const).map(([k, label, n]) => (
              <button key={k} className={`o-chip ${filter === k ? 'violet' : 'neutral'} pill`} onClick={() => setFilter(k)}>{label} {n > 0 ? n : ''}</button>
            ))}
          </div>
          <div className="o-chat-items">
            {list.length ? list.map((x) => {
              const last = x.messages[x.messages.length - 1];
              return (
                <button key={x.id} className={`o-chat-item${sel === x.id ? ' active' : ''}${x.unread ? ' unread' : ''}`} onClick={() => { setSel(x.id); const pd = x.pending_reply || x.pending_draft; if (pd) { setSubject(pd.subject); setBody(pd.body); setDraftRef(pd.body); } else { setSubject(''); setBody(''); setDraftRef(''); } if (x.unread) update({ unread: false }); }}>
                  <div className={`o-lead-avatar person`}>{x.lead?.photo ? <img src={x.lead.photo} alt="" /> : null}<span>{(x.name || x.email).split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span></div>
                  <div className="o-chat-item-body">
                    <div className="o-between"><b>{x.name}</b><small>{last ? new Date(last.at).toLocaleDateString() : ''}</small></div>
                    <div className="o-between"><span className="o-chat-snippet">{last ? `${last.direction === 'out' ? '↗ ' : '↙ '}${last.subject || last.body}` : x.company || x.email}</span><span className={`o-dot ${isDue(x) ? 'orange' : STATUS_TONE[x.status] || 'neutral'}`} title={x.status} /></div>
                    <small className="o-muted">{x.company || x.email} · {t('step', 'خطوة')} {Math.min(nextStep(x) - 1, x.max_followups + 1)}/{x.max_followups + 1}{x.pending_reply ? ` · ${t('reply ready', 'رد جاهز')}` : x.pending_draft ? ` · ${t('draft ready', 'مسودة جاهزة')}` : ''}</small>
                  </div>
                </button>
              );
            }) : <EmptyState icon={MessageSquare} title={t('No conversations yet', 'لا توجد محادثات بعد')} text={t('Add leads with emails from Lead Finder or Market Research.', 'أضف عملاء لديهم إيميلات من البحث عن العملاء أو أبحاث السوق.')} />}
          </div>
        </aside>

        <section className="o-chat-pane">
          {thread ? (
            <>
              <header className="o-chat-head">
                <div className="o-lead-avatar person">{thread.lead?.photo ? <img src={thread.lead.photo} alt="" /> : null}<span>{(thread.name || thread.email).split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="o-flex" style={{ flexWrap: 'wrap' }}><b style={{ fontSize: 15 }}>{thread.name}</b>{thread.lead_id && <span className="o-id">{thread.lead_id}</span>}<Chip tone={isDue(thread) ? 'orange' : STATUS_TONE[thread.status] || 'neutral'}>{isDue(thread) ? t('Follow-up due', 'متابعة مستحقة') : thread.status}</Chip></div>
                  <small className="o-muted">{thread.company ? `${thread.company} · ` : ''}{thread.email}</small>
                </div>
                <div className="o-flex">
                  {thread.lead && <Btn variant="ghost" size="sm" onClick={() => setPanel(panel === 'lead' ? 'none' : 'lead')}>{t('Identity card', 'بطاقة الهوية')}</Btn>}
                  <Btn variant="ghost" size="sm" onClick={() => setPanel(panel === 'sequence' ? 'none' : 'sequence')}>{t('Sequence', 'التسلسل')}</Btn>
                  {thread.status !== 'closed' ? <Btn variant="ghost" size="sm" onClick={() => update({ status: 'closed', next_followup_at: null })}>{t('Close', 'إغلاق')}</Btn> : <Btn variant="ghost" size="sm" onClick={() => update({ status: 'sent' })}>{t('Reopen', 'إعادة فتح')}</Btn>}
                  <button className="o-more" onClick={() => removeThread(thread.id)} aria-label="Delete"><Trash2 size={14} /></button>
                </div>
              </header>
              <div className="o-stepper">
                {Array.from({ length: thread.max_followups + 1 }).map((_, i) => {
                  const done = thread.messages.filter((m) => m.direction === 'out').length > i;
                  const label = i === 0 ? t('First email', 'الرسالة الأولى') : t(`Follow-up ${i}`, `متابعة ${i}`);
                  return <div key={i} className={`o-step${done ? ' done' : ''}${!done && nextStep(thread) === i + 1 ? ' next' : ''}`}><i>{done ? '✓' : i + 1}</i><span>{label}</span></div>;
                })}
                <div className={`o-step${thread.status === 'replied' ? ' done replied' : ''}`}><i>{thread.status === 'replied' ? '✓' : '↙'}</i><span>{t('Replied', 'ردّ')}</span></div>
                <div className="o-step-meta">
                  <label className="o-flex" style={{ fontSize: 11 }}>{t('Max follow-ups', 'الحد الأقصى')} <input className="o-input" style={{ height: 28, width: 50 }} type="number" min={0} max={8} value={thread.max_followups} onChange={(e) => update({ max_followups: Number(e.target.value) || 0 })} /></label>
                  <label className="o-flex" style={{ fontSize: 11 }}>{t('Every', 'كل')} <input className="o-input" style={{ height: 28, width: 50 }} type="number" min={1} value={thread.interval_days} onChange={(e) => update({ interval_days: Number(e.target.value) || 1 })} /> {t('d', 'ي')}</label>
                  {thread.next_followup_at && <Chip tone={isDue(thread) ? 'orange' : 'neutral'}>{t('next', 'التالية')} {new Date(thread.next_followup_at).toLocaleString()}</Chip>}
                </div>
              </div>
              {panel === 'sequence' && seq && (
                <div className="o-seq">
                  <b>{seq.name}</b>
                  {seq.steps.map((s2, i) => (
                    <div key={i} className="o-seq-step">
                      <Chip tone={i < nextStep(thread) - 1 ? 'green' : i === nextStep(thread) - 1 ? 'violet' : 'neutral'}>{i === 0 ? t('Step 1', 'الخطوة 1') : t(`Step ${i + 1} · +${s2.delay_days}d`, `الخطوة ${i + 1} · +${s2.delay_days}ي`)}</Chip>
                      <input className="o-input" style={{ height: 32 }} value={s2.subject} onChange={(e) => { if (!st) return; void persist({ ...st, sequences: st.sequences.map((sq) => sq.id === seq.id ? { ...sq, steps: sq.steps.map((ss, j) => j === i ? { ...ss, subject: e.target.value } : ss) } : sq) }); }} />
                      <textarea className="o-input" rows={3} style={{ height: 'auto', padding: 8 }} value={s2.body} onChange={(e) => { if (!st) return; void persist({ ...st, sequences: st.sequences.map((sq) => sq.id === seq.id ? { ...sq, steps: sq.steps.map((ss, j) => j === i ? { ...ss, body: e.target.value } : ss) } : sq) }); }} />
                    </div>
                  ))}
                  <p className="o-note">{t('Structure placeholders: {{first_name}} {{company}} {{opener}} {{value}} {{value_short}} {{cta}} {{signature}}. The model fills them in your style.', 'عناصر الهيكل: {{first_name}} {{company}} {{opener}} {{value}} {{value_short}} {{cta}} {{signature}}. النموذج يملؤها بأسلوبك.')}</p>
                </div>
              )}
              <div className="o-chat-msgs">
                {thread.messages.length ? thread.messages.map((m) => (
                  <div key={m.id} className={`o-bubble ${m.direction}`}>
                    <div className="o-bubble-meta">{m.direction === 'out' ? (m.step > 1 ? t(`Follow-up ${m.step - 1}`, `متابعة ${m.step - 1}`) : t('Sent', 'مُرسل')) + (m.provider ? ` · ${m.provider}` : '') : t('Reply', 'رد')} · {new Date(m.at).toLocaleString()}</div>
                    {m.subject && <b>{m.subject}</b>}
                    <p>{m.body}</p>
                  </div>
                )) : <div className="o-chat-empty"><Sparkles size={18} /> {t('No messages yet. Draft the first email in your style.', 'لا توجد رسائل بعد. اصنع المسودة الأولى بأسلوبك.')}</div>}
              </div>
              {thread.status !== 'closed' && (
                <footer className="o-composer">
                  <div className="o-flex" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
                    {thread.messages[thread.messages.length - 1]?.direction === 'in' && <Btn variant="ai" size="sm" icon={MessageSquare} onClick={() => aiReply(thread)} disabled={!!busy}>{busy === 'aireply' ? t('Drafting reply…', 'جاري صياغة الرد…') : t('AI negotiation reply', 'رد تفاوضي بالذكاء الاصطناعي')}</Btn>}
                    <Btn variant="ai" size="sm" icon={Sparkles} onClick={() => draft(thread)} disabled={!!busy}>{busy === 'draft' ? t('Drafting…', 'جاري الصياغة…') : t(`Draft step ${nextStep(thread)} in my style`, `صياغة الخطوة ${nextStep(thread)} بأسلوبي`)}</Btn>
                    {nextStep(thread) === 1 && (st?.templates.find((x) => x.id === st.settings.default_template_id) || st?.templates[0]) && (
                      <>
                        <Btn size="sm" icon={FileText} onClick={() => autofill(thread)} disabled={!!busy}>{busy === 'fill' ? '…' : t('Auto-fill template', 'ملء القالب تلقائياً')}</Btn>
                        <select className="o-input" aria-label="Variant" style={{ height: 32 }} value={variantPick} onChange={(e) => setVariantPick(e.target.value)}>
                          <option value="auto">{t('Variant: auto (rotate)', 'النسخة: تلقائي (تناوب)')}</option>
                          <option value="base">{t('Base', 'الأساسية')}</option>
                          {(st?.templates.find((x) => x.id === st.settings.default_template_id) || st?.templates[0])?.variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                        </select>
                      </>
                    )}
                    {used && <Chip tone="violet">{t('template', 'قالب')} · {used.variant_label}</Chip>}
                    <Chip tone="neutral">{t(mailboxCount > 1 ? `rotating ${mailboxCount} mailboxes` : 'via SMTP', mailboxCount > 1 ? `تناوب ${mailboxCount} صناديق` : 'عبر SMTP')}</Chip>
                    {draftRef && body !== draftRef && <Chip tone="green">{t('Your edits will be learned', 'تعديلاتك ستُتعلَّم')}</Chip>}
                  </div>
                  <input className="o-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('Subject', 'الموضوع')} />
                  <textarea className="o-input o-composer-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('Write or generate the email…', 'اكتب الرسالة أو ولّدها…')} />
                  <div className="o-between">
                    <small className="o-muted">{t('Sending is always your click. Personal writing is learned locally.', 'الإرسال دائماً بضغطتك. أسلوبك يُتعلَّم محلياً.')}</small>
                    <Btn icon={Send} onClick={() => send(thread)} disabled={!!busy || !subject.trim() || !body.trim()}>{busy === 'send' ? t('Sending…', 'جاري الإرسال…') : t('Send', 'إرسال')}</Btn>
                  </div>
                </footer>
              )}
            </>
          ) : (
            <EmptyState icon={Inbox} title={t('Pick a conversation', 'اختر محادثة')} text={t('Select a contact on the left, or add leads from Lead Finder.', 'اختر جهة اتصال من اليسار أو أضف عملاء من البحث عن العملاء.')} />
          )}
        </section>
      </div>
      {panel === 'lead' && thread?.lead && <LeadCard t={t} lead={thread.lead} onClose={() => setPanel('none')} />}
    </>
  );
}

type ResumeVersion = { id: string; label: string; text: string; created_at: string };
type WsProfile = { name: string; company: string; role: string; website: string; email: string; industry: string; target_market: string; persona: string; offer: string; goals: string; language: string; resume_text?: string; portfolio_text?: string; target_roles?: string; target_locations?: string; seniority?: string; resume_versions?: ResumeVersion[] };
type WsSummary = {
  mode?: string;
  workspace: { id: string; demo?: boolean; notifications?: { id: string; at: string; kind: string; title: string; text: string; read: boolean; link?: string | null }[]; created_at: string; updated_at: string; profile: WsProfile; onboarding: { completed: boolean; step: number; completed_at?: string | null; skipped_connect: boolean }; activity: { at: string; kind: string; text: string }[]; notes: string };
  progress: { percent: number; checklist: { id: string; label: string; done: boolean }[]; runs: number; lead_runs: number; research_runs: number; leads_total: number; contacts: number; sent: number; followups: number; replied: number; drafts: number; style_learned: boolean; style_edits: number; smtp: boolean; imap: boolean; llm: boolean; webhook: boolean };
  storage: { dir: string; files: { name: string; exists: boolean; size: number }[] };
};

/** Step-by-step Gmail app password guide with direct links. */
function GmailTutorial({ t }: { t: T }) {
  const steps = [
    { title: t('Turn on 2-Step Verification', 'فعّل التحقق بخطوتين'), text: t('App passwords only exist on accounts with 2-Step Verification. Google Account → Security → 2-Step Verification → Turn on.', 'كلمات مرور التطبيقات متاحة فقط للحسابات المفعّل فيها التحقق بخطوتين. حساب جوجل → الأمان → التحقق بخطوتين → تفعيل.'), link: 'https://myaccount.google.com/signinoptions/two-step-verification', cta: t('Open 2-Step Verification', 'فتح التحقق بخطوتين') },
    { title: t('Create an app password', 'أنشئ كلمة مرور تطبيق'), text: t('Open the App passwords page, type a name such as “orbit”, and click Create. Google shows a 16-character password once.', 'افتح صفحة App passwords، اكتب اسماً مثل “orbit”، واضغط Create. جوجل تعرض كلمة مرور من 16 حرفاً مرة واحدة.'), link: 'https://myaccount.google.com/apppasswords', cta: t('Open App passwords', 'فتح App passwords') },
    { title: t('Paste it below', 'الصقها بالأسفل'), text: t('Spaces are fine, orbit. removes them. The password is stored only in Windows Credential Manager. orbit. then verifies SMTP (smtp.gmail.com:587) and IMAP (imap.gmail.com:993).', 'المسافات لا تهم، orbit. يزيلها. كلمة المرور تُحفظ فقط في Windows Credential Manager، ثم يتحقق orbit. من SMTP (smtp.gmail.com:587) وIMAP (imap.gmail.com:993).') },
    { title: t('If Google says the option is unavailable', 'إذا قالت جوجل إن الخيار غير متاح'), text: t('Your Workspace admin has disabled app passwords, or 2-Step Verification is still off. Use the generic SMTP card with your provider instead.', 'مدير Workspace عطّل كلمات مرور التطبيقات، أو التحقق بخطوتين ما زال معطلاً. استخدم كارت SMTP العام مع مزوّدك.') },
  ];
  return (
    <div className="o-tutorial">
      {steps.map((s, i) => (
        <div key={i} className="o-tutorial-step">
          <i>{i + 1}</i>
          <div>
            <b>{s.title}</b>
            <p>{s.text}</p>
            {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="o-btn o-btn-secondary o-btn-sm" style={{ marginTop: 6 }}><ExternalLink size={14} /> {s.cta}</a>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Real onboarding: profile → market → connections. Saved to the workspace on every step. */
function Onboarding({ t, ws, done }: { t: T; ws: WsSummary; done: () => Promise<void> }) {
  const [step, setStep] = useState(Math.max(1, ws.workspace.onboarding.step || 1));
  const [p, setP] = useState<WsProfile>({ ...ws.workspace.profile });
  const [mode, setMode] = useState<string>(ws.mode || 'startup');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [gmail, setGmail] = useState({ address: '', app_password: '' });
  const [gmailOk, setGmailOk] = useState(false);
  const [lic, setLic] = useState({ code: '', ok: false });
  const total = 3;
  const persist = async (patch: Partial<WsSummary['workspace']['onboarding']> = {}) => {
    const w = { ...ws.workspace, mode, profile: p, onboarding: { ...ws.workspace.onboarding, step, ...patch } };
    return invoke('workspace_save', { workspace: w });
  };
  const next = async () => {
    setErr('');
    if (step === 1 && (!p.name.trim() || !p.company.trim())) { setErr(t('Name and company are required.', 'الاسم والشركة مطلوبان.')); return; }
    setBusy(true);
    try { await persist({ step: step + 1 }); setStep(step + 1); } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };
  const finish = async (skipped: boolean) => {
    setBusy(true); setErr('');
    try {
      await persist({ completed: true, completed_at: new Date().toISOString(), skipped_connect: skipped, step: total });
      await invoke('workspace_log', { kind: 'workspace', text: `Workspace created for ${p.company}` });
      await invoke('workspace_demo_seed');
      await done();
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };
  const connectGmail = async () => {
    setBusy(true); setErr('');
    try {
      const pw = gmail.app_password.replace(/\s+/g, '');
      await invoke('smtp_save', { host: 'smtp.gmail.com', port: 587, username: gmail.address, password: pw, from: gmail.address, security: 'starttls' });
      await invoke('imap_save', { host: 'imap.gmail.com', port: 993, username: gmail.address, password: pw });
      setGmailOk(true); void invoke('workspace_log', { kind: 'integration', text: `Gmail connected as ${gmail.address}` });
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };
  const activateLic = async () => {
    setBusy(true); setErr('');
    try { await invoke('racore_login', { licenseCode: lic.code.trim() }); setLic({ ...lic, ok: true }); void invoke('workspace_log', { kind: 'integration', text: 'Racore license activated' }); }
    catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };
  const field = (k: keyof WsProfile, label: string, ph = '', full = false, area = false) => (
    <label className={`o-field${full ? ' full' : ''}`} key={k}>{label}{area ? <textarea rows={3} value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} placeholder={ph} /> : <input value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} placeholder={ph} />}</label>
  );
  return (
    <div className="o-backdrop">
      <div className="o-modal" style={{ width: 'min(820px, 100%)' }}>
        <div className="o-banner">
          <Brand size="sm" />
          <Sparkles size={18} className="o-spark" />
          <i className="o-planet" />
          <span className="o-banner-copy">{t('Discover, engage, learn, repeat.', 'اكتشف، تواصل، تعلّم، كرّر.')}</span>
        </div>
        <div className="o-modal-top">
          <span className="o-eyebrow" style={{ margin: 0 }}>{t('Workspace setup', 'إعداد مساحة العمل')} · {ws.workspace.id}</span>
          <span>{step} / {total}</span>
        </div>
        <div className="o-progress" style={{ marginBottom: 22 }}><i style={{ width: `${(step / total) * 100}%` }} /></div>
        {err && <div className="o-result error" style={{ marginBottom: 14 }}>{err}</div>}

        {step === 1 && (
          <>
            <h2>{t('What will you use orbit. for?', 'هتستخدم orbit. لإيه؟')}</h2>
            <p className="o-sub">{t('This changes the whole workspace. You can switch later in Settings.', 'ده يغيّر مساحة العمل بالكامل. يمكنك التبديل لاحقاً من الإعدادات.')}</p>
            <div className="o-mode-pick">
              <button className={`o-mode-card${mode !== 'jobs' ? ' active' : ''}`} onClick={() => { setMode('startup'); void invoke('workspace_save', { workspace: { ...ws.workspace, mode: 'startup', profile: p, onboarding: { ...ws.workspace.onboarding, step } } }); }}>
                <IconTile icon={Send} tone="violet" size="lg" iconSize={20} /><b>{t('Grow a business', 'تنمية شركة')}</b><span>{t('Find leads, research markets, run outreach and campaigns.', 'إيجاد عملاء، أبحاث سوق، تواصل وحملات.')}</span>
              </button>
              <button className={`o-mode-card${mode === 'jobs' ? ' active' : ''}`} onClick={() => { setMode('jobs'); void invoke('workspace_save', { workspace: { ...ws.workspace, mode: 'jobs', profile: p, onboarding: { ...ws.workspace.onboarding, step } } }); }}>
                <IconTile icon={Briefcase} tone="sky" size="lg" iconSize={20} /><b>{t('Find a job', 'البحث عن عمل')}</b><span>{t('Review your résumé, find jobs worldwide, tailor and apply.', 'راجع سيرتك، ابحث عن وظائف عالمياً، خصّص وتقدّم.')}</span>
              </button>
            </div>
            <div style={{ height: 8 }} />
            <h2 style={{ marginTop: 8 }}>{t('Who are you?', 'من أنت؟')}</h2>
            <p className="o-sub">{t('This is your identity in orbit. It signs your outreach and shapes every draft.', 'هذه هويتك في orbit. تُوقّع رسائلك وتشكّل كل مسودة.')}</p>
            <div className="o-form-grid">
              {field('name', t('Your name', 'اسمك'), 'Ahmed Mohamed')}
              {field('company', t('Company / workspace', 'الشركة / مساحة العمل'), 'Acme')}
              {field('role', t('Role', 'الدور'), t('Founder, Growth lead…', 'مؤسس، مسؤول نمو…'))}
              {field('website', t('Website', 'الموقع'), 'https://acme.com')}
              {field('email', t('Work email', 'بريد العمل'), 'you@company.com')}
              <label className="o-field">{t('Language for drafts', 'لغة المسودات')}<select value={p.language} onChange={(e) => setP({ ...p, language: e.target.value })}><option value="en">English</option><option value="ar">العربية</option></select></label>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2>{t('Who do you sell to?', 'لمن تبيع؟')}</h2>
            <p className="o-sub">{t('Lead Finder and Market Research use this as the default query, and the model uses it to write relevant emails.', 'البحث عن العملاء وأبحاث السوق يستخدمانها كاستعلام افتراضي، والنموذج يستخدمها لكتابة رسائل ذات صلة.')}</p>
            <div className="o-form-grid">
              {field('industry', t('Your industry', 'مجالك'), 'SaaS, Fintech, Agency…')}
              {field('target_market', t('Target market', 'السوق المستهدف'), t('e.g. Startups in Saudi Arabia and Egypt', 'مثال: الشركات الناشئة في السعودية ومصر'))}
              {field('persona', t('Ideal customer persona', 'شخصية العميل المثالي'), t('e.g. Solo founders of B2B SaaS, 1–20 employees', 'مثال: مؤسسون منفردون لـ B2B SaaS، 1–20 موظف'), true)}
              {field('offer', t('What you offer (one paragraph)', 'ماذا تقدم (فقرة واحدة)'), t('The value proposition the model should communicate', 'القيمة التي يجب أن يوصلها النموذج'), true, true)}
              {field('goals', t('Goal of outreach', 'هدف التواصل'), t('e.g. Book 10 discovery calls this month', 'مثال: حجز 10 مكالمات استكشاف هذا الشهر'), true)}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2>{t('Connect your tools', 'اربط أدواتك')}</h2>
            <p className="o-sub">{t('Optional now, needed before sending. Both can be done later under Integrations.', 'اختياري الآن، ومطلوب قبل الإرسال. يمكن فعل الاثنين لاحقاً من التكاملات.')}</p>
            <div className="o-onb-connect">
              <div className="o-onb-card">
                <div className="o-flex"><IconTile icon={Mail} tone={gmailOk ? 'green' : 'violet'} /><b>Gmail</b>{gmailOk && <Chip tone="green">{t('Connected', 'متصل')}</Chip>}</div>
                <GmailTutorial t={t} />
                <div className="o-form-grid" style={{ marginTop: 10 }}>
                  <label className="o-field">{t('Gmail address', 'عنوان Gmail')}<input value={gmail.address} onChange={(e) => setGmail({ ...gmail, address: e.target.value })} placeholder="you@gmail.com" /></label>
                  <label className="o-field">{t('App password', 'كلمة مرور التطبيق')}<input type="password" value={gmail.app_password} onChange={(e) => setGmail({ ...gmail, app_password: e.target.value })} placeholder="xxxx xxxx xxxx xxxx" /></label>
                </div>
                <Btn size="sm" onClick={connectGmail} disabled={busy || !gmail.address || !gmail.app_password}>{t('Connect Gmail (SMTP + IMAP)', 'ربط Gmail (SMTP + IMAP)')}</Btn>
              </div>
              <div className="o-onb-card">
                <div className="o-flex"><IconTile icon={KeyRound} tone={lic.ok ? 'green' : 'violet'} /><b>{t('Activate license', 'تفعيل الترخيص')}</b>{lic.ok && <Chip tone="green">{t('Active', 'مفعّل')}</Chip>}</div>
                <p className="o-note" style={{ marginTop: 6 }}>{t('Enter your license code — AI runs through the Racore gateway (api.racore.xyz). No API keys to manage.', 'أدخل كود الترخيص — الذكاء الاصطناعي يعمل عبر بوابة Racore (api.racore.xyz). بدون إدارة مفاتيح.')}</p>
                <div className="o-form-grid" style={{ marginTop: 10 }}>
                  <label className="o-field" style={{ gridColumn: '1 / -1' }}>{t('License code', 'كود الترخيص')}<input value={lic.code} onChange={(e) => setLic({ ...lic, code: e.target.value })} placeholder="orbit_xxxxxxxxxxxxxxxxxxxxxxxx" /></label>
                </div>
                <Btn size="sm" onClick={activateLic} disabled={busy || !lic.code.trim()}>{busy ? t('Activating…', 'جاري التفعيل…') : lic.ok ? t('Re-activate', 'إعادة تفعيل') : t('Activate', 'تفعيل')}</Btn>
              </div>
            </div>
          </>
        )}

        <div className="o-between" style={{ marginTop: 22 }}>
          {step > 1 ? <Btn variant="ghost" onClick={() => setStep(step - 1)} disabled={busy}>{t('Back', 'رجوع')}</Btn> : <span />}
          <div className="o-flex">
            {step === 3 && <Btn variant="secondary" onClick={() => finish(true)} disabled={busy}>{t('Skip for now', 'تخطٍّ الآن')}</Btn>}
            {step < 3 ? <Btn onClick={next} disabled={busy}>{t('Continue', 'متابعة')} <ChevronRight size={16} /></Btn> : <Btn onClick={() => finish(false)} disabled={busy}>{t('Open my workspace', 'افتح مساحة عملي')} <ChevronRight size={16} /></Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Settings → Workspace: editable profile, progress, activity, and data management. */
function WorkspacePage({ t, ws, reload }: { t: T; ws: WsSummary | null; reload: () => Promise<void> }) {
  const [p, setP] = useState<WsProfile | null>(ws?.workspace.profile || null);
  const [notes, setNotes] = useState(ws?.workspace.notes || '');
  const [msg, setMsg] = useState<{ tone: 'green' | 'coral'; text: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState('');
  /* oxlint-disable react/react-compiler -- mirror the loaded workspace into the editable form */
  useEffect(() => { if (ws) { setP(ws.workspace.profile); setNotes(ws.workspace.notes || ''); } }, [ws?.workspace.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */
  if (!ws || !p) return <EmptyState icon={Settings2} title={t('Loading workspace…', 'جاري تحميل مساحة العمل…')} text="" />;
  const act = async (k: string, fn: () => Promise<string>) => { setBusy(k); setMsg(null); try { setMsg({ tone: 'green', text: await fn() }); await reload(); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const save = () => act('save', async () => { await invoke('workspace_save', { workspace: { ...ws.workspace, profile: p, notes } }); return t('Workspace saved', 'تم حفظ مساحة العمل'); });
  const del = (what: string, label: string) => act(what, async () => { const r = await invoke<string>('workspace_delete', { what }); return `${label}: ${r}`; });
  const field = (k: keyof WsProfile, label: string, area = false) => (
    <label className={`o-field${area ? ' full' : ''}`} key={k}>{label}{area ? <textarea rows={3} value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} /> : <input value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />}</label>
  );
  const datasets: { id: string; label: string; detail: string; count: number | string }[] = [
    { id: 'runs', label: t('Research history', 'سجل البحث'), detail: t('Lead Finder and Market Research runs with all records', 'عمليات البحث عن العملاء وأبحاث السوق بكل السجلات'), count: `${ws.progress.runs} ${t('runs', 'عملية')} · ${ws.progress.leads_total.toLocaleString()} ${t('leads', 'عميل')}` },
    { id: 'outreach', label: t('Outreach conversations', 'محادثات التواصل'), detail: t('Contacts, messages, follow-up state', 'جهات الاتصال والرسائل وحالة المتابعة'), count: `${ws.progress.contacts} ${t('contacts', 'جهة')} · ${ws.progress.sent} ${t('sent', 'مُرسل')}` },
    { id: 'style', label: t('Writing style', 'أسلوب الكتابة'), detail: t('Samples, learned guide, signature, learned edits', 'العينات ودليل الأسلوب والتوقيع والتعديلات المُتعلَّمة'), count: ws.progress.style_learned ? `${t('learned', 'مُتعلَّم')} · ${ws.progress.style_edits} ${t('edits', 'تعديل')}` : t('not learned', 'غير مُتعلَّم') },
    { id: 'sequences', label: t('Email sequences', 'تسلسلات الرسائل'), detail: t('Step templates and delays (resets to default)', 'قوالب الخطوات والتأخيرات (تعود للافتراضي)'), count: '' },
    { id: 'llm', label: t('LLM API keys', 'مفاتيح النماذج'), detail: t('All provider keys in the credential store + default model', 'كل مفاتيح المزوّدين في مخزن الاعتماد + النموذج الافتراضي'), count: ws.progress.llm ? t('configured', 'مهيأ') : t('none', 'لا يوجد') },
    { id: 'integrations', label: t('Email & webhook connections', 'اتصالات البريد والـ webhook'), detail: t('SMTP, IMAP, webhook settings and their passwords', 'إعدادات SMTP وIMAP والـ webhook وكلمات مرورها'), count: [ws.progress.smtp && 'SMTP', ws.progress.imap && 'IMAP', ws.progress.webhook && 'Webhook'].filter(Boolean).join(' · ') || t('none', 'لا يوجد') },
    { id: 'activity', label: t('Activity log', 'سجل النشاط'), detail: t('Timeline of everything the workspace did', 'خط زمني لكل ما فعلته مساحة العمل'), count: `${ws.workspace.activity.length} ${t('events', 'حدث')}` },
  ];
  return (
    <>
      <PageHead eyebrow={`${t('Workspace', 'مساحة العمل')} · ${ws.workspace.id} · ${t('created', 'أُنشئت')} ${new Date(ws.workspace.created_at).toLocaleDateString()}`} title={t('Settings & workspace', 'الإعدادات ومساحة العمل')} spark={false} sub={t('Everything orbit. knows lives on this machine and is yours to edit, export or delete.', 'كل ما يعرفه orbit. موجود على هذا الجهاز وبإمكانك تعديله أو تصديره أو حذفه.')}
        actions={<><Btn variant="secondary" size="sm" icon={Download} onClick={() => act('export', async () => t(`Exported to ${await invoke<string>('workspace_export')}`, `تم التصدير إلى ${await invoke<string>('workspace_export')}`))} disabled={!!busy}>{t('Export backup', 'تصدير نسخة')}</Btn><Btn size="sm" onClick={save} disabled={!!busy}>{busy === 'save' ? t('Saving…', 'جاري الحفظ…') : t('Save changes', 'حفظ التعديلات')}</Btn></>} />
      {msg && <div className={`o-result${msg.tone === 'coral' ? ' error' : ''}`}><Check size={16} />{msg.text}</div>}
      <div className="o-grid o-grid-4">
        <StatCard icon={Shield} label={t('Setup progress', 'تقدم الإعداد')} value={`${ws.progress.percent}%`} trend={null} tone="violet" />
        <StatCard icon={Users} label={t('Leads', 'العملاء')} value={ws.progress.leads_total.toLocaleString()} trend={null} tone="sky" />
        <StatCard icon={Send} label={t('Emails sent', 'رسائل مرسلة')} value={String(ws.progress.sent)} trend={null} tone="orange" />
        <StatCard icon={MessageSquare} label={t('Replies', 'ردود')} value={String(ws.progress.replied)} trend={null} tone="green" />
      </div>
      <div className="o-grid o-grid-2">
        <Card>
          <CardHead title={t('Profile', 'الملف الشخصي')} sub={t('Used as the sender identity in every draft.', 'تُستخدم كهوية المرسل في كل مسودة.')} />
          <div className="o-form-grid">
            {field('name', t('Name', 'الاسم'))}{field('company', t('Company', 'الشركة'))}{field('role', t('Role', 'الدور'))}{field('website', t('Website', 'الموقع'))}{field('email', t('Work email', 'بريد العمل'))}
            <label className="o-field">{t('Draft language', 'لغة المسودات')}<select value={p.language} onChange={(e) => setP({ ...p, language: e.target.value })}><option value="en">English</option><option value="ar">العربية</option></select></label>
          </div>
        </Card>
        <Card>
          <CardHead title={t('Market', 'السوق')} sub={t('Feeds Lead Finder defaults and the outreach prompt.', 'تغذي افتراضيات البحث عن العملاء وبرومبت التواصل.')} />
          <div className="o-form-grid">
            {field('industry', t('Industry', 'المجال'))}{field('target_market', t('Target market', 'السوق المستهدف'))}{field('persona', t('Ideal customer persona', 'شخصية العميل المثالي'), true)}{field('offer', t('Offer', 'العرض'), true)}{field('goals', t('Outreach goal', 'هدف التواصل'), true)}
          </div>
        </Card>
      </div>
      <div className="o-grid o-grid-2">
        <Card>
          <CardHead title={t('Workspace notes', 'ملاحظات مساحة العمل')} sub={t('Free text, Markdown supported.', 'نص حر، يدعم Markdown.')} />
          <textarea className="o-input" rows={8} style={{ width: '100%', height: 'auto', padding: 10, fontFamily: 'var(--font-sans)' }} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {notes && <div className="o-mt"><Md text={notes} /></div>}
        </Card>
        <Card>
          <CardHead title={t('Activity', 'النشاط')} action={<Btn variant="ghost" size="sm" icon={Trash2} onClick={() => del('activity', t('Activity', 'النشاط'))} disabled={!!busy}>{t('Clear', 'مسح')}</Btn>} />
          <div style={{ maxHeight: 320, overflow: 'auto' }}>
            {ws.workspace.activity.length ? [...ws.workspace.activity].reverse().map((x, i) => <Row key={i} icon={x.kind === 'outreach' ? Send : x.kind === 'research' ? Compass : x.kind === 'integration' ? Plug : Activity} title={x.text} meta={`${x.kind} · ${new Date(x.at).toLocaleString()}`} />) : <EmptyState icon={Activity} title={t('No activity yet', 'لا يوجد نشاط بعد')} text="" />}
          </div>
        </Card>
      </div>
      <QuotaCard t={t} />
      <Card>
        <CardHead title={t('Your data', 'بياناتك')} sub={`${t('Stored in', 'محفوظة في')} ${ws.storage.dir} · ${t('secrets in Windows Credential Manager', 'الأسرار في Windows Credential Manager')}`} />
        {datasets.map((d) => (
          <div key={d.id} className="o-row">
            <IconTile icon={d.id === 'runs' ? History : d.id === 'outreach' ? MessageSquare : d.id === 'style' ? Sparkles : d.id === 'llm' ? KeyRound : d.id === 'integrations' ? Plug : d.id === 'sequences' ? Send : Activity} tone="violet" />
            <div><b>{d.label}</b><small>{d.detail}{d.count ? ` · ${d.count}` : ''}</small></div>
            <Btn variant="ghost" size="sm" icon={Trash2} onClick={() => del(d.id, d.label)} disabled={!!busy}>{t('Delete', 'حذف')}</Btn>
          </div>
        ))}
        <div className="o-danger">
          <div><b>{t('Reset workspace', 'إعادة ضبط مساحة العمل')}</b><small>{t(`Deletes everything above including stored passwords and keys, then restarts onboarding. Type ${ws.workspace.profile.company || 'RESET'} to confirm.`, `يحذف كل ما سبق بما فيه كلمات المرور والمفاتيح ثم يعيد الإعداد. اكتب ${ws.workspace.profile.company || 'RESET'} للتأكيد.`)}</small></div>
          <input className="o-input" style={{ height: 34, width: 200 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={ws.workspace.profile.company || 'RESET'} />
          <Btn variant="secondary" size="sm" icon={Trash2} disabled={!!busy || confirm !== (ws.workspace.profile.company || 'RESET')} onClick={() => act('all', async () => { const r = await invoke<string>('workspace_delete', { what: 'all' }); setConfirm(''); return r; })}>{t('Reset everything', 'إعادة ضبط كل شيء')}</Btn>
        </div>
      </Card>
    </>
  );
}

/** Guided tour over the demo data. Every step navigates to the real screen. */
function Guide({ t, step, setStep, go, openRun, finish, hide }: { t: T; step: number; setStep: (n: number) => void; go: (i: number) => void; openRun: (id: string) => void; finish: () => Promise<void>; hide: () => void }) {
  const steps: { title: string; text: string; tab: number; run?: string; place: 'center' | 'bottom' }[] = [
    { title: t('Welcome to your workspace', 'أهلاً بك في مساحة عملك'), text: t('This short tour uses sample data (every record is marked “Demo”). Nothing here is real, and it all disappears when you finish. Use the sidebar exactly as you will later.', 'هذه الجولة القصيرة تستخدم بيانات تجريبية (كل سجل مُعلَّم “Demo”). لا شيء هنا حقيقي، وكله يختفي عند الانتهاء. استخدم الشريط الجانبي كما ستفعل لاحقاً.'), tab: 0, place: 'center' },
    { title: t('Dashboard', 'لوحة التحكم'), text: t('Your setup checklist, live pipeline numbers and recent activity. Each checklist item jumps to the screen that completes it.', 'قائمة الإعداد وأرقام خط الأنابيب الحية والنشاط الأخير. كل عنصر في القائمة ينقلك للشاشة التي تكمله.'), tab: 0, place: 'bottom' },
    { title: t('Lead Finder', 'البحث عن العملاء'), text: t('Describe a persona, set a target, and results stream in live through Agent Reach. This sample run holds 8 leads with company facts, published emails and a stable ORB id. Click any row to open its identity card.', 'صف شخصية، حدد العدد، وتصل النتائج لحظياً عبر Agent Reach. هذه العملية التجريبية فيها 8 عملاء ببيانات الشركة والإيميلات المنشورة ومعرّف ORB ثابت. اضغط أي صف لفتح بطاقة الهوية.'), tab: TAB.leads, run: 'demo-leads', place: 'bottom' },
    { title: t('Enrich and export', 'الإثراء والتصدير'), text: t('“Enrich” reads each company site and LinkedIn page for logos, photos and published emails. Every run is exported to Excel in Documents\\orbit and saved to History automatically.', '“الإثراء” يقرأ موقع كل شركة وصفحة LinkedIn للشعارات والصور والإيميلات المنشورة. كل عملية تُصدَّر إلى Excel في Documents\\orbit وتُحفظ في السجل تلقائياً.'), tab: TAB.leads, place: 'bottom' },
    { title: t('Market Research', 'أبحاث السوق'), text: t('Same engine, different angles: reports, competitors, news, funding. Rows are typed (company, article, page) with Markdown notes.', 'نفس المحرك بزوايا مختلفة: تقارير، منافسون، أخبار، تمويل. الصفوف مصنّفة (شركة، مقال، صفحة) مع ملاحظات Markdown.'), tab: TAB.research, run: 'demo-research', place: 'bottom' },
    { title: t('Social Media', 'وسائل التواصل'), text: t('Reddit through Arctic Shift: type a topic, orbit. discovers subreddits, pulls a year of posts and the comments under the most discussed ones, charts the trend, and the model writes a market report: established vs emerging markets, opportunities, and what people really think.', 'Reddit عبر Arctic Shift: اكتب موضوعاً، يكتشف orbit. المجتمعات، يسحب سنة من المنشورات والتعليقات تحت الأكثر نقاشاً، يرسم الاتجاه، ويكتب النموذج تقرير سوق: أسواق قائمة وناشئة، فرص، وآراء الناس الحقيقية.'), tab: TAB.social, place: 'bottom' },
    { title: t('Outreach', 'التواصل'), text: t('A WhatsApp-style inbox. Sara already replied, Omar is on follow-up 1 and due today, Layla was sent this morning, two are drafts. Open a thread to see the stepper, the sequence and the composer.', 'صندوق بأسلوب واتساب. سارة ردّت بالفعل، عمر في المتابعة 1 ومستحق اليوم، ليلى أُرسل لها صباح اليوم، واثنان مسودات. افتح محادثة لترى الخطوات والتسلسل والمحرر.'), tab: TAB.outreach, place: 'bottom' },
    { title: t('Your writing style', 'أسلوبك في الكتابة'), text: t('Click “My writing style”, paste a few emails you wrote, and Learn. Drafts then follow your tone, and every edit you make before sending is learned too. “Send due follow-ups” handles the rest.', 'اضغط “أسلوبي في الكتابة”، الصق رسائل كتبتها، ثم تعلّم. المسودات تتبع نبرتك بعدها، وكل تعديل قبل الإرسال يُتعلَّم أيضاً. “إرسال المتابعات المستحقة” يتكفل بالباقي.'), tab: TAB.outreach, place: 'bottom' },
    { title: t('Templates', 'القوالب'), text: t('Write your first email once, in your own words, with placeholders like {{first_name}} and {{company}}. Generate 3–5 variants in your style, then Outreach auto-fills them for every lead and tracks which variant gets replies.', 'اكتب رسالتك الأولى مرة واحدة بكلماتك مع placeholders مثل {{first_name}} و{{company}}. ولّد 3–5 نسخ بأسلوبك، ثم يملؤها التواصل تلقائياً لكل عميل ويتتبع أي نسخة تجلب الردود.'), tab: TAB.templates, place: 'bottom' },
    { title: t('Integrations', 'التكاملات'), text: t('Gmail via app password (SMTP + IMAP), any SMTP server, signed webhooks, Agent Reach health, and LLM provider keys. Passwords and keys live only in Windows Credential Manager.', 'Gmail بكلمة مرور تطبيق (SMTP + IMAP)، أي خادم SMTP، webhooks موقّعة، صحة Agent Reach، ومفاتيح مزوّدي النماذج. كلمات المرور والمفاتيح في Windows Credential Manager فقط.'), tab: TAB.integrations, place: 'bottom' },
    { title: t('History and Settings', 'السجل والإعدادات'), text: t('History keeps every run to reopen later. Settings holds your profile, notes, activity, backups, and a Delete button for every dataset.', 'السجل يحتفظ بكل عملية لإعادة فتحها. الإعدادات فيها ملفك وملاحظاتك ونشاطك والنسخ الاحتياطية وزر حذف لكل مجموعة بيانات.'), tab: TAB.history, place: 'bottom' },
    { title: t('Ready?', 'جاهز؟'), text: t('Click the button and all sample data is deleted immediately. Your workspace starts clean with the profile you entered.', 'اضغط الزر وتُحذف كل البيانات التجريبية فوراً. تبدأ مساحتك نظيفة بالملف الذي أدخلته.'), tab: 0, place: 'center' },
  ];
  const s = steps[Math.min(step, steps.length - 1)];
  const goTo = (n: number) => { const st = steps[n]; go(st.tab); if (st.run) openRun(st.run); setStep(n); };
  /* oxlint-disable react/react-compiler -- navigate when the tour opens */
  useEffect(() => { go(s.tab); if (s.run) openRun(s.run); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */
  const last = step >= steps.length - 1;
  return (
    <div className={`o-guide ${s.place}`}>
      <div className="o-guide-card">
        <div className="o-between">
          <span className="o-eyebrow" style={{ margin: 0 }}><Sparkles size={12} /> {t('Guided tour', 'جولة إرشادية')} · {step + 1}/{steps.length}</span>
          <button className="o-more" onClick={hide} aria-label="Hide"><X size={14} /></button>
        </div>
        <h3>{s.title}</h3>
        <p>{s.text}</p>
        <div className="o-progress" style={{ margin: '10px 0' }}><i style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <div className="o-between">
          <Btn variant="ghost" size="sm" onClick={() => goTo(Math.max(0, step - 1))} disabled={step === 0}>{t('Back', 'رجوع')}</Btn>
          <div className="o-flex">
            {!last && <Btn variant="ghost" size="sm" onClick={finish}>{t('Skip tour', 'تخطي الجولة')}</Btn>}
            {last ? <Btn size="sm" icon={Check} onClick={finish}>{t('I understand, let’s start', 'فهمت كل شيء، هيا لنبدأ')}</Btn> : <Btn size="sm" onClick={() => goTo(step + 1)}>{t('Next', 'التالي')} <ChevronRight size={14} /></Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Templates: the user's base first email with placeholders, generated variants, and per-variant reply stats. */
function TemplatesPage({ t }: { t: T }) {
  const [st, setSt] = useState<OState | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [placeholders, setPlaceholders] = useState<[string, string][]>([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: 'green' | 'coral'; text: string } | null>(null);
  const [count, setCount] = useState(4);
  const [preview, setPreview] = useState<{ subject: string; body: string; variant_label: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const load = async () => { try { const s = await invoke<OState>('outreach_state'); setSt(s); if (!sel && s.templates[0]) setSel(s.settings.default_template_id || s.templates[0].id); setPlaceholders(await invoke<[string, string][]>('outreach_placeholders')); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } };
  /* oxlint-disable react/react-compiler -- load once */
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */
  const persist = async (s: OState) => { try { setSt(await invoke<OState>('outreach_save', { state: s })); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } };
  const act = async (k: string, fn: () => Promise<string>) => { setBusy(k); setMsg(null); try { setMsg({ tone: 'green', text: await fn() }); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const tpl = st?.templates.find((x) => x.id === sel) || null;
  const update = (patch: Partial<OTemplate>) => { if (!st || !tpl) return; void persist({ ...st, templates: st.templates.map((x) => (x.id === tpl.id ? { ...x, ...patch, updated_at: new Date().toISOString() } : x)) }); };
  const create = () => { if (!st) return; const id = `tpl-${Date.now()}`; const now = new Date().toISOString(); const fresh: OTemplate = { id, name: t('First email', 'الرسالة الأولى'), subject: t('Quick question about {{company}}', 'سؤال سريع عن {{company}}'), body: t('Hi {{first_name}},\n\n\n\n{{signature}}', 'مرحباً {{first_name}}،\n\n\n\n{{signature}}'), variants: [], created_at: now, updated_at: now, in_rotation: true }; void persist({ ...st, templates: [...st.templates, fresh], settings: { ...st.settings, default_template_id: st.settings.default_template_id || id } }); setSel(id); };
  const remove = (id: string) => { if (!st) return; void persist({ ...st, templates: st.templates.filter((x) => x.id !== id), settings: { ...st.settings, default_template_id: st.settings.default_template_id === id ? null : st.settings.default_template_id } }); setSel(null); };
  const insert = (token: string) => { const el = bodyRef.current; if (!el || !tpl) { update({ body: (tpl?.body || '') + token }); return; } const s0 = el.selectionStart ?? el.value.length; const e0 = el.selectionEnd ?? s0; const body = el.value.slice(0, s0) + token + el.value.slice(e0); update({ body }); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s0 + token.length, s0 + token.length); }); };
  const generate = () => tpl && act('gen', async () => { const s = await invoke<OState>('outreach_generate_variants', { templateId: tpl.id, count }); setSt(s); void invoke('workspace_log', { kind: 'outreach', text: `Generated ${s.templates.find((x) => x.id === tpl.id)?.variants.length || 0} template variants` }); return t('Variants generated in your style. Edit any of them, then Outreach rotates between them.', 'تم توليد النسخ بأسلوبك. عدّل أياً منها، ثم يتناوب التواصل بينها.'); });
  const previewFor = (variantId: string) => tpl && act('preview', async () => { const th = st?.threads[0]; if (!th) throw new Error(t('Add at least one contact in Outreach to preview with real data.', 'أضف جهة اتصال واحدة على الأقل في التواصل للمعاينة ببيانات حقيقية.')); const r = await invoke<{ subject: string; body: string; variant_label: string }>('outreach_fill', { threadId: th.id, templateId: tpl.id, variantId }); setPreview(r); return t(`Preview filled with ${th.name}`, `معاينة مملوءة ببيانات ${th.name}`); });
  const stats = (variantId: string) => { const outs = (st?.threads || []).flatMap((th) => th.messages.filter((m) => m.direction === 'out' && m.step === 1 && (m.variant_id || 'base') === variantId).map(() => th)); const sent = outs.length; const replied = outs.filter((th) => th.status === 'replied').length; return { sent, replied }; };
  const setDefault = (id: string) => { if (!st) return; void persist({ ...st, settings: { ...st.settings, default_template_id: id } }); };
  const setMode = (mode: string) => { if (!st) return; void persist({ ...st, settings: { ...st.settings, variant_mode: mode } }); };
  return (
    <>
      <PageHead eyebrow={t('Email templates', 'قوالب البريد')} title={t('Templates', 'القوالب')} spark={false} sub={t('Write your first email once, in your own words. Placeholders fill in per lead. Generate variants in your style and let Outreach rotate them, then keep the one that gets replies.', 'اكتب رسالتك الأولى مرة واحدة بكلماتك. الـ placeholders تُملأ لكل عميل. ولّد نسخاً بأسلوبك ودع التواصل يتناوب بينها، ثم احتفظ بالتي تجلب الردود.')} actions={<Btn icon={FileText} onClick={create} disabled={!st}>{t('New template', 'قالب جديد')}</Btn>} />
      {msg && <div className={`o-result${msg.tone === 'coral' ? ' error' : ''}`}><Check size={16} />{msg.text}</div>}
      <div className="o-tpl">
        <aside className="o-tpl-list">
          {(st?.templates || []).map((x) => (
            <button key={x.id} className={`o-history-item${sel === x.id ? ' active' : ''}`} onClick={() => setSel(x.id)}>
              <b>{x.name}{st?.settings.default_template_id === x.id ? ' ★' : ''}</b>
              <small>{x.variants.length} {t('variants', 'نسخة')} · {new Date(x.updated_at).toLocaleDateString()}</small>
            </button>
          ))}
          {!st?.templates.length && <EmptyState icon={FileText} title={t('No template yet', 'لا يوجد قالب بعد')} text={t('Create one and write your first email the way you would send it today.', 'أنشئ واحداً واكتب رسالتك الأولى كما سترسلها اليوم.')} action={<Btn size="sm" onClick={create}>{t('New template', 'قالب جديد')}</Btn>} />}
          {st && st.templates.length > 0 && (
            <div className="o-tpl-mode">
              <small>{t('Variant rotation', 'تناوب النسخ')}</small>
              <select className="o-input" aria-label="Variant mode" style={{ height: 32 }} value={st.settings.variant_mode} onChange={(e) => setMode(e.target.value)}><option value="rotate">{t('Rotate templates + variants (A/B)', 'تناوب القوالب والنسخ (A/B)')}</option><option value="base">{t('Always base', 'الأساسية دائماً')}</option></select>
            </div>
          )}
        </aside>
        <section className="o-tpl-editor">
          {tpl ? (
            <>
              <div className="o-flex" style={{ flexWrap: 'wrap' }}>
                <input className="o-input" aria-label="Template name" style={{ height: 36, flex: 1, minWidth: 200, fontWeight: 600 }} value={tpl.name} onChange={(e) => update({ name: e.target.value })} />
                {st?.settings.default_template_id !== tpl.id ? <Btn variant="secondary" size="sm" onClick={() => setDefault(tpl.id)}>{t('Set as default', 'اجعله الافتراضي')}</Btn> : <Chip tone="green">{t('Default for Outreach', 'الافتراضي للتواصل')}</Chip>}
                <label className="o-flex" style={{ fontSize: 12 }}>{t('In bulk rotation', 'ضمن التوزيع الجماعي')} <Switch on={tpl.in_rotation !== false} onChange={(v) => update({ in_rotation: v })} label="In rotation" /></label>
                <Btn variant="ghost" size="sm" icon={Trash2} onClick={() => remove(tpl.id)}>{t('Delete', 'حذف')}</Btn>
              </div>
              <Card>
                <CardHead title={t('Base email (your words)', 'الرسالة الأساسية (بكلماتك)')} sub={t('Click a placeholder to insert it at the cursor. It is replaced per lead from the identity card and your profile.', 'اضغط placeholder لإدراجه عند المؤشر. يُستبدل لكل عميل من بطاقة الهوية وملفك.')} />
                <div className="o-tokens">{placeholders.map(([k, d]) => <button key={k} className="o-token" title={d} onClick={() => insert(k)}>{k}</button>)}</div>
                <label className="o-field" style={{ marginTop: 10 }}>{t('Subject', 'الموضوع')}<input value={tpl.subject} onChange={(e) => update({ subject: e.target.value })} /></label>
                <label className="o-field" style={{ marginTop: 10 }}>{t('Body', 'المحتوى')}<textarea ref={bodyRef} rows={10} value={tpl.body} onChange={(e) => update({ body: e.target.value })} style={{ fontFamily: 'var(--font-sans)' }} /></label>
                <div className="o-flex o-mt" style={{ flexWrap: 'wrap' }}>
                  <Btn variant="ai" icon={Sparkles} onClick={generate} disabled={!!busy || !tpl.body.trim()}>{busy === 'gen' ? t('Generating…', 'جاري التوليد…') : t(`Generate ${count} variants in my style`, `توليد ${count} نسخ بأسلوبي`)}</Btn>
                  <select className="o-input" aria-label="Variant count" style={{ height: 34, width: 70 }} value={count} onChange={(e) => setCount(Number(e.target.value))}>{[3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                  <Btn variant="secondary" size="sm" onClick={() => previewFor('base')} disabled={!!busy}>{t('Preview with a real contact', 'معاينة بجهة اتصال حقيقية')}</Btn>
                  {(() => { const s = stats('base'); return <Chip tone="neutral">{t('Base', 'الأساسية')} · {s.sent} {t('sent', 'مُرسل')} · {s.replied} {t('replied', 'ردّوا')}</Chip>; })()}
                </div>
              </Card>
              {preview && (
                <Card>
                  <CardHead title={t('Preview', 'معاينة')} sub={preview.variant_label} action={<Btn variant="ghost" size="sm" onClick={() => setPreview(null)}>{t('Close', 'إغلاق')}</Btn>} />
                  <b>{preview.subject}</b>
                  <pre className="o-pre" style={{ font: '13px/1.6 var(--font-sans)', color: 'var(--text)', background: 'var(--surface-2)', maxHeight: 320 }}>{preview.body}</pre>
                </Card>
              )}
              {tpl.variants.length > 0 && (
                <Card>
                  <CardHead title={t(`${tpl.variants.length} variants in your style`, `${tpl.variants.length} نسخ بأسلوبك`)} sub={t('Edit freely. Stats count first emails sent with each variant and how many got a reply.', 'عدّل بحرية. الإحصاءات تحسب الرسائل الأولى المرسلة بكل نسخة وكم منها حصل على رد.')} />
                  <div className="o-variants">
                    {tpl.variants.map((v) => { const s = stats(v.id); return (
                      <div key={v.id} className="o-variant">
                        <div className="o-flex" style={{ flexWrap: 'wrap' }}>
                          <input className="o-input" aria-label="Variant label" style={{ height: 32, fontWeight: 600, flex: 1, minWidth: 140 }} value={v.label} onChange={(e) => update({ variants: tpl.variants.map((x) => (x.id === v.id ? { ...x, label: e.target.value } : x)) })} />
                          <Chip tone={s.replied ? 'green' : 'neutral'}>{s.sent} {t('sent', 'مُرسل')} · {s.replied} {t('replied', 'ردّوا')}{s.sent ? ` · ${Math.round((s.replied / s.sent) * 100)}%` : ''}</Chip>
                          <Btn variant="ghost" size="sm" onClick={() => previewFor(v.id)} disabled={!!busy}>{t('Preview', 'معاينة')}</Btn>
                          <button className="o-more" aria-label="Delete variant" onClick={() => update({ variants: tpl.variants.filter((x) => x.id !== v.id) })}><Trash2 size={14} /></button>
                        </div>
                        {v.angle && <small className="o-muted">{v.angle}</small>}
                        <input className="o-input" aria-label="Variant subject" style={{ height: 32 }} value={v.subject} onChange={(e) => update({ variants: tpl.variants.map((x) => (x.id === v.id ? { ...x, subject: e.target.value } : x)) })} />
                        <textarea className="o-input" aria-label="Variant body" rows={7} style={{ height: 'auto', padding: 10, fontFamily: 'var(--font-sans)' }} value={v.body} onChange={(e) => update({ variants: tpl.variants.map((x) => (x.id === v.id ? { ...x, body: e.target.value } : x)) })} />
                      </div>
                    ); })}
                  </div>
                </Card>
              )}
            </>
          ) : <EmptyState icon={FileText} title={t('Select or create a template', 'اختر أو أنشئ قالباً')} text="" />}
        </section>
      </div>
    </>
  );
}

type RPost = { id: string; title: string; subreddit: string; score: number; num_comments: number; created?: string | null; month?: string | null; text: string; url?: string; permalink: string; author?: string; flair?: string | null };
type RComment = { id: string; body: string; score: number; created?: string | null; author?: string; subreddit?: string; post_title?: string; permalink?: string };
type RResult = { query: string; since: string; subreddits: string[]; discovered: { name: string; subscribers: number }[]; count: number; comments: number; timeline: { month: string; posts: number; comments: number; score: number }[]; trend_percent: number; top_subreddits: { subreddit: string; posts: number; engagement: number }[]; top_terms: { term: string; count: number }[]; top_posts: RPost[]; opinions: RComment[]; posts: RPost[]; fetched_at: string };

const SOCIAL_CHANNELS = [
  { id: 'reddit', name: 'Reddit', icon: siReddit, ready: true, note: 'Arctic Shift archive · no login' },
  { id: 'x', name: 'X / Twitter', icon: siX, ready: false, note: 'Agent Reach twitter-cli (bundled) · needs your session' },
  { id: 'youtube', name: 'YouTube', icon: siYoutube, ready: false, note: 'Agent Reach yt-dlp (bundled)' },
  { id: 'facebook', name: 'Facebook', icon: siFacebook, ready: false, note: 'Agent Reach OpenCLI (bundled) · needs your session' },
  { id: 'instagram', name: 'Instagram', icon: siInstagram, ready: false, note: 'Agent Reach OpenCLI (bundled) · needs your session' },
  { id: 'tiktok', name: 'TikTok', icon: siTiktok, ready: false, note: 'coming' },
];

function redditPrompt(r: RResult, lang: string) {
  const posts = r.top_posts.slice(0, 30).map((p) => `- [r/${p.subreddit} · ${p.score}↑ ${p.num_comments}💬 · ${p.month}] ${p.title} :: ${p.text.slice(0, 240)}`).join('\n');
  const ops = r.opinions.slice(0, 40).map((c) => `- (${c.score}↑, r/${c.subreddit}) ${c.body.slice(0, 240)}`).join('\n');
  const tl = r.timeline.map((x) => `${x.month}: ${x.posts} posts`).join(', ');
  return `You are a market analyst. Analyse Reddit discussion about: "${r.query}" (since ${r.since}).\n\nTIMELINE (posts per month): ${tl}\nTREND (recent half vs earlier half): ${r.trend_percent}%\nTOP SUBREDDITS: ${r.top_subreddits.slice(0, 10).map((s) => `r/${s.subreddit} (${s.posts})`).join(', ')}\nTOP TERMS: ${r.top_terms.slice(0, 20).map((t2) => t2.term).join(', ')}\n\nTOP POSTS:\n${posts}\n\nPEOPLE'S OPINIONS (comments):\n${ops}\n\nWrite a Markdown report in ${lang === 'ar' ? 'Arabic' : 'English'} with these sections: 1) Established markets (what people already buy/use, incumbents), 2) Emerging markets and new niches (what is growing, with evidence from the timeline/terms), 3) Opportunities (concrete gaps, unmet needs, who has the pain), 4) What people think (opinions, objections, praise, pricing sensitivity), 5) Pain points ranked, 6) 5 quotable lines with subreddit attribution, 7) Recommended next actions for a founder or growth team. Be specific, cite subreddits, never invent numbers that are not in the data.`;
}

function SocialPage({ t, openRunId, onOpened }: { t: T; openRunId?: string | null; onOpened?: () => void }) {
  const [channel, setChannel] = useState('reddit');
  const [query, setQuery] = useState('');
  const [subs, setSubs] = useState('');
  const [months, setMonths] = useState(12);
  const [busy, setBusy] = useState<'run' | 'analyze' | null>(null);
  const [error, setError] = useState('');
  const [res, setRes] = useState<RResult | null>(null);
  const [live, setLive] = useState<RPost[]>([]);
  const [progress, setProgress] = useState<{ percent: number; label: string }>({ percent: 0, label: '' });
  const [feed, setFeed] = useState<string[]>([]);
  const [report, setReport] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [history, setHistory] = useState<RunMeta[]>([]);
  const [view, setView] = useState<'posts' | 'opinions' | 'report'>('posts');
  const jobRef = useRef<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const stop = () => { unlistenRef.current?.(); unlistenRef.current = null; jobRef.current = null; };
  const loadHistory = async () => { try { const all = await invoke<RunMeta[]>('run_list'); setHistory(all.filter((r) => r.mode === 'reddit')); } catch { /* ignore */ } };
  const openRun = async (id: string) => { try { const r = await invoke<{ id: string; query: string; result: RResult; report?: string; saved_at: string }>('run_get', { id }); setRes(r.result); setLive(r.result.posts); setQuery(r.query); setReport(r.report || ''); setRunId(r.id); setProgress({ percent: 100, label: t(`Loaded from history · ${new Date(r.saved_at).toLocaleString()}`, `تم التحميل من السجل · ${new Date(r.saved_at).toLocaleString()}`) }); setView(r.report ? 'report' : 'posts'); } catch (e) { setError(String(e)); } };
  const saveRun = async (id: string, r: RResult, extra: Record<string, unknown> = {}) => { try { await invoke('run_save', { run: { id, mode: 'reddit', query: r.query, target: r.subreddits.length, calls: [], fetched_at: r.fetched_at, leads: r.posts, result: r, saved_at: new Date().toISOString(), ...extra } }); await loadHistory(); } catch (e) { setError(String(e)); } };
  /* oxlint-disable react/react-compiler -- load history once; open a run from History */
  useEffect(() => { void loadHistory(); return () => { if (jobRef.current) void invoke('bridge_cancel', { jobId: jobRef.current }); stop(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (openRunId) { void openRun(openRunId); onOpened?.(); } }, [openRunId]); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */

  const run = async () => {
    if (!query.trim()) { setError(t('Type a topic, product or market first.', 'اكتب موضوعاً أو منتجاً أو سوقاً أولاً.')); return; }
    const jobId = `reddit-${Date.now()}`;
    jobRef.current = jobId; setRunId(jobId);
    setBusy('run'); setError(''); setRes(null); setLive([]); setFeed([]); setReport(''); setView('posts');
    setProgress({ percent: 0, label: t('Discovering subreddits…', 'جاري اكتشاف المجتمعات…') });
    unlistenRef.current = await listen<Record<string, unknown>>(`bridge://${jobId}`, (ev) => {
      const e = ev.payload as { type: string; percent?: number; query?: string; count?: number; new?: number; leads?: RPost[]; subreddits?: string[]; error?: string; fatal?: boolean; result?: RResult; index?: number; planned_calls?: number };
      if (e.type === 'start') { setProgress({ percent: 0, label: t(`${e.subreddits?.length} subreddits: ${e.subreddits?.slice(0, 6).map((s) => 'r/' + s).join(', ')}…`, `${e.subreddits?.length} مجتمع: ${e.subreddits?.slice(0, 6).map((s) => 'r/' + s).join('، ')}…`) }); }
      else if (e.type === 'call') { setProgress({ percent: e.percent ?? 0, label: `${e.index}/${e.planned_calls} · ${e.query}` }); }
      else if (e.type === 'batch') { setLive((l) => [...l, ...(e.leads || [])]); setProgress({ percent: e.percent ?? 0, label: t(`+${e.new} from ${e.query} · ${e.count} posts`, `+${e.new} من ${e.query} · ${e.count} منشور`) }); setFeed((f) => [`+${e.new}  ${e.query}`, ...f].slice(0, 10)); }
      else if (e.type === 'error') { setFeed((f) => [`! ${e.query || ''} ${e.error}`, ...f].slice(0, 10)); if (e.fatal) { setError(e.error || 'failed'); setBusy(null); stop(); } }
      else if (e.type === 'done' && e.result) { setRes(e.result); setLive(e.result.posts); setProgress({ percent: 100, label: t(`Done · ${e.result.count} posts · ${e.result.comments} comments`, `اكتمل · ${e.result.count} منشور · ${e.result.comments} تعليق`) }); void saveRun(jobId, e.result); void invoke('workspace_log', { kind: 'research', text: `Reddit: “${e.result.query}” → ${e.result.count} posts, ${e.result.comments} comments` }); setBusy(null); stop(); }
      else if (e.type === 'cancelled') { setBusy(null); stop(); }
    });
    try { await invoke('social_reddit_stream', { jobId, paramsJson: JSON.stringify({ query, subreddits: subs.split(/[,\s]+/).filter(Boolean), months, discover: true, include_comments: true }) }); }
    catch (err) { setError(String(err)); setBusy(null); stop(); }
  };
  const cancel = async () => { if (jobRef.current) await invoke('bridge_cancel', { jobId: jobRef.current }); };
  const analyze = async () => {
    if (!res) return;
    setBusy('analyze'); setError('');
    try {
      const ws = await invoke<WsSummary>('workspace_get');
      const md = await invoke<string>('llm_complete', { system: 'You are a rigorous market analyst. Output Markdown only.', prompt: redditPrompt(res, ws.workspace.profile.language), maxTokens: 1800 });
      setReport(md); setView('report');
      if (runId) await saveRun(runId, res, { report: md });
      void invoke('workspace_log', { kind: 'research', text: `Reddit market report generated for “${res.query}”` });
    } catch (e) { setError(String(e)); } finally { setBusy(null); }
  };
  const ch = SOCIAL_CHANNELS.find((c) => c.id === channel)!;
  const shown = res ? (view === 'posts' ? res.top_posts : []) : live.slice(-30).reverse();

  return (
    <>
      <PageHead eyebrow={t('Social listening', 'رصد المجتمعات')} title={t('Social Media', 'وسائل التواصل')} spark={false} sub={t('Explore established and emerging markets, opportunities and real opinions from public conversations.', 'استكشف الأسواق القائمة والناشئة والفرص والآراء الحقيقية من المحادثات العامة.')} />
      <div className="o-social-bar">
        {SOCIAL_CHANNELS.map((c) => (
          <button key={c.id} className={`o-social-chip${channel === c.id ? ' active' : ''}${c.ready ? '' : ' soon'}`} onClick={() => setChannel(c.id)} title={c.note}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={c.icon.path} fill="currentColor" /></svg>
            <span>{c.name}</span>
            {!c.ready && <small>{t('soon', 'قريباً')}</small>}
          </button>
        ))}
      </div>
      {error && <div className="o-result error">{error}</div>}
      {channel !== 'reddit' ? (
        <Card><EmptyState icon={Radio} title={`${ch.name} · ${t('via Agent Reach', 'عبر Agent Reach')}`} text={t(`${ch.note}. The extension ships with the installer; connecting your own session is the next step.`, `${ch.note}. الإضافة مضمّنة مع المثبّت؛ ربط جلستك الخاصة هو الخطوة التالية.`)} /></Card>
      ) : (
        <>
          <Card>
            <div className="o-research-input">
              <div className="o-icon-tile violet" style={{ color: '#FF4500', background: '#FFEDE6' }}><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={siReddit.path} fill="currentColor" /></svg></div>
              <input className="o-input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder={t('Topic, product or market, e.g. "invoicing for freelancers" or "fintech Saudi"', 'موضوع أو منتج أو سوق، مثال: "فوترة للمستقلين" أو "fintech Saudi"')} />
              <input className="o-input" style={{ width: 240 }} value={subs} onChange={(e) => setSubs(e.target.value)} placeholder={t('subreddits (optional): startups, Egypt', 'مجتمعات (اختياري): startups, Egypt')} />
              <label className="o-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{t('Months', 'شهور')}<input type="number" min={1} max={60} value={months} onChange={(e) => setMonths(Number(e.target.value) || 12)} style={{ width: 70 }} /></label>
              <Btn onClick={run} disabled={busy !== null}>{busy === 'run' ? t('Listening…', 'جاري الرصد…') : t('Explore', 'استكشف')}</Btn>
            </div>
            {(busy || progress.percent > 0) && (
              <div className="o-loader">
                <div className="o-loader-head"><span className={`o-spinner${busy ? '' : ' done'}`} /><b>{progress.percent}%</b><span className="o-loader-label">{progress.label}</span>{busy === 'run' && <Btn variant="ghost" size="sm" onClick={cancel}>{t('Cancel', 'إلغاء')}</Btn>}</div>
                <div className="o-progress lg"><i style={{ width: `${progress.percent}%` }} /></div>
                {feed.length > 0 && <ul className="o-feed">{feed.map((f, i) => <li key={i} style={{ opacity: 1 - i * 0.08 }}>{f}</li>)}</ul>}
              </div>
            )}
            <p className="o-note">{t('Source: Arctic Shift public Reddit archive. Requests are paced to respect its rate limit; a full run takes one to three minutes. Every post links back to Reddit.', 'المصدر: أرشيف Reddit العام Arctic Shift. الطلبات متباعدة احتراماً لحد الاستخدام؛ العملية الكاملة تستغرق من دقيقة إلى ثلاث. كل منشور يرتبط بـ Reddit.')}</p>
          </Card>

          {res && (
            <>
              <div className="o-grid o-grid-4">
                <StatCard icon={Radio} label={t('Posts', 'منشورات')} value={res.count.toLocaleString()} trend={res.trend_percent} tone="coral" />
                <StatCard icon={MessageSquare} label={t('Opinions (comments)', 'آراء (تعليقات)')} value={res.comments.toLocaleString()} trend={null} tone="violet" />
                <StatCard icon={Users} label={t('Subreddits', 'مجتمعات')} value={String(res.top_subreddits.length)} trend={null} tone="sky" />
                <StatCard icon={Activity} label={t('Engagement', 'تفاعل')} value={res.posts.reduce((a, p) => a + p.score + p.num_comments, 0).toLocaleString()} trend={null} tone="green" />
              </div>
              <div className="o-grid o-grid-main">
                <Card>
                  <CardHead title={t('Conversation over time', 'الحديث عبر الزمن')} sub={t(`Posts per month since ${res.since} · trend ${res.trend_percent > 0 ? '+' : ''}${res.trend_percent}%`, `منشورات شهرياً منذ ${res.since} · اتجاه ${res.trend_percent > 0 ? '+' : ''}${res.trend_percent}%`)} />
                  {res.timeline.length ? <Bars data={res.timeline.map((x) => ({ x: x.month, posts: x.posts }))} dataKey="posts" highlight={res.timeline[res.timeline.length - 1]?.month} small /> : <EmptyState icon={BarChart3} title={t('No dated posts', 'لا منشورات مؤرخة')} text="" />}
                </Card>
                <Card>
                  <CardHead title={t('Where the market talks', 'أين يتحدث السوق')} sub={t('Top subreddits by posts', 'أعلى المجتمعات بالمنشورات')} />
                  {res.top_subreddits.slice(0, 8).map((s) => <Tile key={s.subreddit} title={`r/${s.subreddit}`} big={String(s.posts)} left={t(`${s.engagement.toLocaleString()} engagement`, `${s.engagement.toLocaleString()} تفاعل`)} right="" progress={(s.posts / (res.top_subreddits[0]?.posts || 1)) * 100} />)}
                </Card>
                <Card>
                  <CardHead title={t('What people say', 'ما يقوله الناس')} sub={t('Most frequent terms', 'أكثر المصطلحات تكراراً')} />
                  <div className="o-tokens">{res.top_terms.map((x) => <span key={x.term} className="o-token" style={{ fontSize: `${Math.min(16, 10 + x.count / (res.top_terms[0]?.count || 1) * 6)}px` }}>{x.term} <small className="o-muted">{x.count}</small></span>)}</div>
                  {res.discovered.length > 0 && <p className="o-note">{t('Discovered', 'مكتشفة')}: {res.discovered.map((d) => `r/${d.name} (${(d.subscribers || 0).toLocaleString()})`).join(', ')}</p>}
                </Card>
              </div>
              <Card>
                <CardHead title={t('Market report', 'تقرير السوق')} sub={t('Established vs emerging markets, opportunities, opinions and pain points, written by your default model from the data above.', 'أسواق قائمة وناشئة، فرص، آراء ونقاط ألم، يكتبها نموذجك الافتراضي من البيانات أعلاه.')}
                  action={<div className="o-flex"><div className="o-chat-filters" style={{ padding: 0, border: 0 }}>{(['posts', 'opinions', 'report'] as const).map((v) => <button key={v} className={`o-chip ${view === v ? 'violet' : 'neutral'} pill`} onClick={() => setView(v)}>{v === 'posts' ? t('Top posts', 'أهم المنشورات') : v === 'opinions' ? t('Opinions', 'الآراء') : t('Report', 'التقرير')}</button>)}</div><Btn variant="ai" size="sm" icon={Sparkles} onClick={analyze} disabled={busy !== null}>{busy === 'analyze' ? t('Analysing…', 'جاري التحليل…') : report ? t('Regenerate report', 'إعادة توليد التقرير') : t('Analyze with AI', 'حلّل بالذكاء الاصطناعي')}</Btn></div>} />
                {view === 'report' && (report ? <Md text={report} /> : <EmptyState icon={Sparkles} title={t('No report yet', 'لا يوجد تقرير بعد')} text={t('Click “Analyze with AI”. Needs an LLM key under Integrations.', 'اضغط “حلّل بالذكاء الاصطناعي”. يتطلب مفتاح نموذج من التكاملات.')} />)}
                {view === 'opinions' && (res.opinions.length ? res.opinions.slice(0, 40).map((c) => (
                  <div key={c.id} className="o-bubble in" style={{ maxWidth: '100%', marginBottom: 8 }}>
                    <div className="o-bubble-meta">r/{c.subreddit} · {c.score}↑ · {c.author} · {c.created ? new Date(c.created).toLocaleDateString() : ''} · <a href={c.permalink} target="_blank" rel="noreferrer">{t('thread', 'الموضوع')}</a></div>
                    <p>{c.body}</p>
                    <small className="o-muted">{t('on', 'على')}: {c.post_title}</small>
                  </div>
                )) : <EmptyState icon={MessageSquare} title={t('No comments collected', 'لم تُجمع تعليقات')} text="" />)}
                {view === 'posts' && (
                  <Table columns={[t('Post', 'المنشور'), 'r/', t('Score', 'التقييم'), t('Comments', 'تعليقات'), t('Date', 'التاريخ'), t('Flair', 'الوسم')]}>
                    {shown.map((p) => (
                      <tr key={p.id} className="o-row-click" onClick={() => window.open(p.permalink, '_blank')}>
                        <td style={{ whiteSpace: 'normal', maxWidth: 520 }}><b>{p.title}</b>{p.text && <><br /><small className="o-muted">{p.text.slice(0, 160)}</small></>}</td>
                        <td>r/{p.subreddit}</td><td>{p.score}</td><td>{p.num_comments}</td><td>{p.created ? new Date(p.created).toLocaleDateString() : '—'}</td><td>{p.flair || '—'}</td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Card>
            </>
          )}
          {!res && live.length > 0 && (
            <Card>
              <CardHead title={t('Arriving live', 'يصل لحظياً')} sub={t(`${live.length} posts so far`, `${live.length} منشور حتى الآن`)} />
              <Table columns={[t('Post', 'المنشور'), 'r/', t('Score', 'التقييم'), t('Comments', 'تعليقات')]}>
                {shown.map((p) => <tr key={p.id}><td style={{ whiteSpace: 'normal', maxWidth: 560 }}>{p.title}</td><td>r/{p.subreddit}</td><td>{p.score}</td><td>{p.num_comments}</td></tr>)}
              </Table>
            </Card>
          )}
          {history.length > 0 && (
            <div className="o-history">
              <div className="o-between"><b><History size={14} /> {t('Saved explorations', 'استكشافات محفوظة')}</b><span className="o-muted" style={{ fontSize: 11 }}>{history.length}</span></div>
              <div className="o-history-list">{history.slice(0, 8).map((r) => <button key={r.id} className={`o-history-item${r.id === runId ? ' active' : ''}`} onClick={() => openRun(r.id)}><b>{r.query}</b><small>{r.count} {t('posts', 'منشور')} · {new Date(r.saved_at).toLocaleString()}</small></button>)}</div>
            </div>
          )}
        </>
      )}
    </>
  );
}

type QuotaLimits = { smtp_per_day: number; smtp_global_kill_switch: boolean; smtp_min_gap_s: number; exa_gap_shared_s: number; exa_gap_keyed_s: number; jina_gap_s: number; reddit_gap_s: number; exa_calls_per_run: number; enrich_per_run: number };
type QuotaStatus = { limits: QuotaLimits; usage: { day: string; smtp_sent: number; llm_calls: number; last_send_at?: string | null }; defaults: QuotaLimits };

/** Settings → Rate limits: one place for every outbound channel's protection, with today's usage. */
function QuotaCard({ t }: { t: T }) {
  const [q, setQ] = useState<QuotaStatus | null>(null);
  const [l, setL] = useState<QuotaLimits | null>(null);
  const [msg, setMsg] = useState('');
  const load = async () => { try { const s = await invoke<QuotaStatus>('quota_status'); setQ(s); setL(s.limits); } catch (e) { setMsg(String(e)); } };
  /* oxlint-disable react/react-compiler -- load once */
  useEffect(() => { void load(); }, []);
  /* oxlint-enable react/react-compiler */
  if (!q || !l) return null;
  const f = (k: Exclude<keyof QuotaLimits, 'smtp_global_kill_switch'>, label: string, hint: string, step = 1) => (
    <label className="o-field" key={k} title={hint}>{label}<input type="number" min={0} step={step} value={l[k]} onChange={(e) => setL({ ...l, [k]: Number(e.target.value) })} /><small className="o-muted" style={{ fontWeight: 400 }}>{hint}</small></label>
  );
  return (
    <Card>
      <CardHead title={t('Rate limits & quotas', 'حدود الاستخدام والحصص')} sub={t('Applied to every send, search and page read the app makes. Today’s usage resets at midnight.', 'تُطبَّق على كل إرسال وبحث وقراءة صفحة يقوم بها التطبيق. استخدام اليوم يُصفَّر عند منتصف الليل.')}
        action={<div className="o-flex"><Chip tone={q.usage.smtp_sent >= l.smtp_per_day ? 'coral' : 'green'}>{t('Emails today', 'رسائل اليوم')} {q.usage.smtp_sent}/{l.smtp_per_day}</Chip><Chip tone="neutral">{t('LLM calls today', 'استدعاءات النماذج اليوم')} {q.usage.llm_calls}</Chip></div>} />
      {msg && <div className="o-result error">{msg}</div>}
      <div className="o-form-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {f('smtp_per_day', t('Emails per day', 'رسائل في اليوم'), t('Gmail app passwords allow ~500/day; 100 keeps your sender reputation safe.', 'كلمات مرور Gmail تسمح بنحو 500/يوم؛ 100 يحافظ على سمعة المرسل.'))}
        {f('smtp_min_gap_s', t('Seconds between emails', 'ثوانٍ بين الرسائل'), t('Bulk sends and follow-ups are spaced by this.', 'الإرسال الجماعي والمتابعات تتباعد بهذا القدر.'))}
        {f('exa_calls_per_run', t('Exa calls per research run', 'استعلامات Exa لكل عملية'), t('Each call returns up to 100 results.', 'كل استعلام يعيد حتى 100 نتيجة.'))}
        {f('enrich_per_run', t('Profiles per enrichment run', 'ملفات لكل عملية إثراء'), t('Company site + LinkedIn reads via Jina Reader.', 'قراءة موقع الشركة وLinkedIn عبر Jina Reader.'))}
        {f('exa_gap_shared_s', t('Exa gap, shared endpoint (s)', 'فاصل Exa، النقطة المشتركة (ث)'), t('Without your own Exa key.', 'بدون مفتاح Exa خاص.'), 0.5)}
        {f('exa_gap_keyed_s', t('Exa gap, your key (s)', 'فاصل Exa، مفتاحك (ث)'), t('With your Exa key.', 'مع مفتاح Exa الخاص.'), 0.5)}
        {f('jina_gap_s', t('Jina Reader gap (s)', 'فاصل Jina Reader (ث)'), t('Between page reads during enrichment.', 'بين قراءات الصفحات أثناء الإثراء.'), 0.5)}
        {f('reddit_gap_s', t('Arctic Shift gap (s)', 'فاصل Arctic Shift (ث)'), t('Between Reddit archive requests.', 'بين طلبات أرشيف Reddit.'), 0.1)}
      </div>
      <div className="o-flex o-mt"><label className="o-flex" title={t('Emergency-only global ceiling. Leave off for mailbox-based capacity.', 'سقف طوارئ عالمي فقط. اتركه متوقفاً لاستخدام سعة الصناديق.')}>{t('Legacy global kill-switch', 'مفتاح الإيقاف العالمي القديم')} <Switch on={l.smtp_global_kill_switch} onChange={(v) => setL({ ...l, smtp_global_kill_switch: v })} label="Global kill switch" /></label>
        <Btn size="sm" onClick={async () => { try { await invoke('quota_set', { limits: l }); setMsg(''); await load(); } catch (e) { setMsg(String(e)); } }}>{t('Save limits', 'حفظ الحدود')}</Btn>
        <Btn size="sm" variant="ghost" onClick={() => setL(q.defaults)}>{t('Reset to defaults', 'إعادة الافتراضيات')}</Btn>
        <span className="o-note" style={{ margin: 0 }}>{t('LLM requests per minute are set per provider under Integrations.', 'طلبات النماذج في الدقيقة تُضبط لكل مزوّد تحت التكاملات.')}</span>
      </div>
    </Card>
  );
}

/** CRM: every outreach contact as a record, with pipeline stage, engagement and drill-in to the identity card. */
function CrmPage({ t, go }: { t: T; go: (i: number) => void }) {
  const [st, setSt] = useState<OState | null>(null);
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<'all' | 'new' | 'contacted' | 'replied' | 'closed'>('all');
  const [sel, setSel] = useState<Lead | null>(null);
  /* oxlint-disable react/react-compiler -- load once */
  useEffect(() => { void invoke<OState>('outreach_state').then(setSt).catch(() => undefined); }, []);
  /* oxlint-enable react/react-compiler */
  const stageOf = (x: OThread): 'new' | 'contacted' | 'replied' | 'closed' => x.status === 'replied' ? 'replied' : x.status === 'closed' ? 'closed' : x.messages.some((m) => m.direction === 'out') ? 'contacted' : 'new';
  const threads = st?.threads || [];
  const rows = threads.filter((x) => {
    if (q && !`${x.name} ${x.company || ''} ${x.email}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (stage !== 'all' && stageOf(x) !== stage) return false;
    return true;
  }).sort((a2, b) => (b.last_activity || '').localeCompare(a2.last_activity || ''));
  const count = (s: string) => threads.filter((x) => stageOf(x) === s).length;
  const stages = [['all', t('All', 'الكل'), threads.length], ['new', t('New', 'جديد'), count('new')], ['contacted', t('Contacted', 'تم التواصل'), count('contacted')], ['replied', t('Replied', 'ردّوا'), count('replied')], ['closed', t('Closed', 'مغلق'), count('closed')]] as const;
  const stageTone: Record<string, Tone> = { new: 'neutral', contacted: 'violet', replied: 'green', closed: 'coral' };
  return (
    <>
      <PageHead eyebrow={t('Contacts from your outreach', 'جهات الاتصال من تواصلك')} title={t('CRM', 'إدارة العملاء')} spark={false} sub={t('Every contact you add to Outreach is a CRM record here, with its stage, engagement and full identity card.', 'كل جهة اتصال تضيفها إلى التواصل تصبح سجلاً هنا، بمرحلتها وتفاعلها وبطاقة هويتها الكاملة.')} actions={<Btn icon={Users} onClick={() => go(TAB.leads)}>{t('Find more leads', 'ابحث عن عملاء')}</Btn>} />
      <div className="o-grid o-grid-4">
        <StatCard icon={Users} label={t('Total contacts', 'إجمالي جهات الاتصال')} value={threads.length.toLocaleString()} trend={null} tone="violet" />
        <StatCard icon={Send} label={t('Contacted', 'تم التواصل')} value={String(count('contacted') + count('replied') + count('closed'))} trend={null} tone="sky" />
        <StatCard icon={MessageSquare} label={t('Replied', 'ردّوا')} value={String(count('replied'))} trend={null} tone="green" />
        <StatCard icon={Mail} label={t('With email', 'لديهم إيميل')} value={String(threads.filter((x) => x.email).length)} trend={null} tone="orange" />
      </div>
      <Card>
        <div className="o-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div className="o-search" style={{ width: 280 }}><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search contacts…', 'ابحث في جهات الاتصال…')} /></div>
          <div className="o-flex" style={{ flexWrap: 'wrap' }}>{stages.map(([k, label, n]) => <button key={k} className={`o-chip ${stage === k ? 'violet' : 'neutral'} pill`} onClick={() => setStage(k as typeof stage)}>{label} {n}</button>)}</div>
        </div>
        {rows.length ? (
          <Table columns={[t('Contact', 'جهة الاتصال'), t('Company', 'الشركة'), t('Stage', 'المرحلة'), t('Sent', 'مُرسل'), t('Replies', 'ردود'), t('Last activity', 'آخر نشاط'), '']}>
            {rows.map((x) => (
              <tr key={x.id} className="o-row-click" onClick={() => x.lead ? setSel(x.lead) : go(TAB.outreach)}>
                <td><div className="o-company"><Avatar text={(x.name || x.email).split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()} />{x.name || '—'}</div>{x.lead_id ? <><br /><span className="o-id" style={{ marginInlineStart: 39 }}>{x.lead_id}</span></> : null}</td>
                <td>{x.company || '—'}<br /><small className="o-muted">{x.email}</small></td>
                <td><Chip tone={stageTone[stageOf(x)]}>{stageOf(x) === 'new' ? t('New', 'جديد') : stageOf(x) === 'contacted' ? t('Contacted', 'تم التواصل') : stageOf(x) === 'replied' ? t('Replied', 'ردّوا') : t('Closed', 'مغلق')}</Chip></td>
                <td>{x.messages.filter((m) => m.direction === 'out').length}</td>
                <td>{x.messages.filter((m) => m.direction === 'in').length}</td>
                <td>{x.last_activity ? new Date(x.last_activity).toLocaleDateString() : '—'}</td>
                <td><MoreBtn /></td>
              </tr>
            ))}
          </Table>
        ) : threads.length ? <EmptyState icon={Search} title={t('No matches', 'لا نتائج')} text={t('Try another search or stage filter.', 'جرّب بحثاً أو مرحلة أخرى.')} /> : <EmptyState icon={Users} title={t('No contacts yet', 'لا توجد جهات اتصال بعد')} text={t('Add leads with emails to Outreach and they appear here as CRM records.', 'أضف عملاء لديهم إيميلات إلى التواصل وسيظهرون هنا كسجلات CRM.')} action={<Btn size="sm" onClick={() => go(TAB.leads)}>{t('Find leads', 'ابحث عن عملاء')}</Btn>} />}
      </Card>
      {sel && <LeadCard t={t} lead={sel} onClose={() => setSel(null)} onOutreach={() => go(TAB.outreach)} />}
    </>
  );
}

type MBox = { id: string; label: string; kind: string; from: string; username: string; smtp_host: string; smtp_port: number; security: string; imap: boolean; enabled: boolean; daily_cap: number; verified_at?: string | null; sent_today: number };

/** Multiple sending accounts. Campaigns rotate across every enabled mailbox, each with a daily cap. */
function Mailboxes({ t, mailboxes, reload }: { t: T; mailboxes: MBox[]; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: 'green' | 'coral'; text: string } | null>(null);
  const [add, setAdd] = useState<'none' | 'gmail' | 'smtp'>('none');
  const [g, setG] = useState({ address: '', app_password: '', cap: 100 });
  const [s, setS] = useState({ label: '', smtp_host: '', smtp_port: '587', security: 'starttls', username: '', from: '', password: '', imap_host: '', imap_port: '993', cap: 100 });
  const act = async (k: string, fn: () => Promise<string>) => { setBusy(k); setMsg(null); try { setMsg({ tone: 'green', text: await fn() }); await reload(); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const enabled = mailboxes.filter((m) => m.enabled).length;
  const totalCap = mailboxes.filter((m) => m.enabled).reduce((a2, m) => a2 + m.daily_cap, 0);
  const sentToday = mailboxes.reduce((a2, m) => a2 + m.sent_today, 0);
  return (
    <Card>
      <CardHead title={t('Sending mailboxes', 'صناديق الإرسال')} sub={t('Add several Gmail or SMTP accounts. Outreach and campaigns rotate across every enabled mailbox and respect each one’s daily cap, so volume spreads and no single account gets flagged.', 'أضف عدة حسابات Gmail أو SMTP. التواصل والحملات تتناوب على كل صندوق مُفعّل وتحترم الحد اليومي لكل واحد، فيتوزّع الحجم ولا يُعلَّم أي حساب.')}
        action={<div className="o-flex"><Chip tone={enabled ? 'green' : 'neutral'}>{enabled}/{mailboxes.length} {t('active', 'نشط')}</Chip><Chip tone="neutral">{sentToday}/{totalCap} {t('today', 'اليوم')}</Chip><Btn size="sm" icon={Mail} onClick={() => setAdd(add === 'gmail' ? 'none' : 'gmail')}>{t('Add Gmail', 'إضافة Gmail')}</Btn><Btn size="sm" variant="secondary" icon={Send} onClick={() => setAdd(add === 'smtp' ? 'none' : 'smtp')}>{t('Add SMTP', 'إضافة SMTP')}</Btn></div>} />
      {msg && <div className={`o-result${msg.tone === 'coral' ? ' error' : ''}`}><Check size={16} />{msg.text}</div>}

      {add === 'gmail' && (
        <div className="o-int-form">
          <GmailTutorial t={t} />
          <div className="o-form-grid">
            <label className="o-field">{t('Gmail address', 'عنوان Gmail')}<input value={g.address} onChange={(e) => setG({ ...g, address: e.target.value })} placeholder="you@gmail.com" /></label>
            <label className="o-field">{t('App password', 'كلمة مرور التطبيق')}<input type="password" value={g.app_password} onChange={(e) => setG({ ...g, app_password: e.target.value })} placeholder="xxxx xxxx xxxx xxxx" /></label>
            <label className="o-field">{t('Daily cap', 'الحد اليومي')}<input type="number" min={1} max={500} value={g.cap} onChange={(e) => setG({ ...g, cap: Number(e.target.value) || 100 })} /></label>
          </div>
          <div className="o-flex o-mt"><Btn size="sm" disabled={!!busy || !g.address || !g.app_password} onClick={() => act('add-gmail', async () => { await invoke('mailbox_add_gmail', { address: g.address, appPassword: g.app_password, dailyCap: g.cap }); setG({ address: '', app_password: '', cap: 100 }); setAdd('none'); return t(`Gmail mailbox added and verified.`, `تمت إضافة صندوق Gmail والتحقق منه.`); })}>{busy === 'add-gmail' ? t('Verifying…', 'جاري التحقق…') : t('Add & verify', 'إضافة وتحقق')}</Btn></div>
        </div>
      )}
      {add === 'smtp' && (
        <div className="o-int-form">
          <div className="o-form-grid">
            <label className="o-field">{t('Label', 'التسمية')}<input value={s.label} onChange={(e) => setS({ ...s, label: e.target.value })} placeholder={t('Team inbox', 'صندوق الفريق')} /></label>
            <label className="o-field">{t('From address', 'عنوان المرسل')}<input value={s.from} onChange={(e) => setS({ ...s, from: e.target.value })} placeholder="you@company.com" /></label>
            <label className="o-field">SMTP host<input value={s.smtp_host} onChange={(e) => setS({ ...s, smtp_host: e.target.value })} placeholder="smtp.company.com" /></label>
            <label className="o-field">{t('Port', 'المنفذ')}<input value={s.smtp_port} onChange={(e) => setS({ ...s, smtp_port: e.target.value })} /></label>
            <label className="o-field">{t('Username', 'اسم المستخدم')}<input value={s.username} onChange={(e) => setS({ ...s, username: e.target.value })} /></label>
            <label className="o-field">{t('Password', 'كلمة المرور')}<input type="password" value={s.password} onChange={(e) => setS({ ...s, password: e.target.value })} /></label>
            <label className="o-field">{t('Security', 'الأمان')}<select value={s.security} onChange={(e) => setS({ ...s, security: e.target.value })}><option value="starttls">STARTTLS (587)</option><option value="ssl">SSL/TLS (465)</option></select></label>
            <label className="o-field">{t('Daily cap', 'الحد اليومي')}<input type="number" min={1} value={s.cap} onChange={(e) => setS({ ...s, cap: Number(e.target.value) || 100 })} /></label>
            <label className="o-field">IMAP host <small className="o-muted">{t('(optional, for replies)', '(اختياري، للردود)')}</small><input value={s.imap_host} onChange={(e) => setS({ ...s, imap_host: e.target.value })} placeholder="imap.company.com" /></label>
            <label className="o-field">IMAP {t('port', 'منفذ')}<input value={s.imap_port} onChange={(e) => setS({ ...s, imap_port: e.target.value })} /></label>
          </div>
          <div className="o-flex o-mt"><Btn size="sm" disabled={!!busy || !s.smtp_host || !s.from || !s.username || !s.password} onClick={() => act('add-smtp', async () => { await invoke('mailbox_add', { id: null, label: s.label, kind: 'smtp', smtpHost: s.smtp_host, smtpPort: Number(s.smtp_port) || 587, security: s.security, username: s.username, from: s.from, imapHost: s.imap_host || null, imapPort: Number(s.imap_port) || 993, password: s.password, dailyCap: s.cap }); setS({ ...s, password: '' }); setAdd('none'); return t('SMTP mailbox added and verified.', 'تمت إضافة صندوق SMTP والتحقق منه.'); })}>{busy === 'add-smtp' ? t('Verifying…', 'جاري التحقق…') : t('Add & verify', 'إضافة وتحقق')}</Btn></div>
        </div>
      )}

      {mailboxes.length ? (
        <div className="o-mt">
          {mailboxes.map((m) => (
            <div key={m.id} className="o-row">
              <IconTile icon={m.kind === 'gmail' ? Mail : Send} tone={m.enabled ? 'green' : 'neutral'} />
              <div>
                <b>{m.label} {m.imap ? <Chip tone="sky">IMAP</Chip> : null}{!m.verified_at ? <Chip tone="coral">{t('unverified', 'غير مُتحقق')}</Chip> : null}</b>
                <small>{m.from} · {m.smtp_host}:{m.smtp_port} · {t('sent today', 'أُرسل اليوم')} {m.sent_today}/{m.daily_cap}</small>
              </div>
              <div className="o-flex">
                <label className="o-flex" style={{ fontSize: 11 }}>{t('cap', 'الحد')} <input className="o-input" style={{ height: 28, width: 60 }} type="number" min={1} defaultValue={m.daily_cap} onBlur={(e) => { const v = Number(e.target.value) || 0; if (v && v !== m.daily_cap) void act('cap', async () => { await invoke('mailbox_set_cap', { id: m.id, cap: v }); return t('Cap updated', 'تم تحديث الحد'); }); }} /></label>
                <Btn size="sm" variant="ghost" disabled={!!busy} onClick={() => act('test-' + m.id, async () => { await invoke('mailbox_test', { id: m.id }); return t(`${m.label}: SMTP OK`, `${m.label}: SMTP سليم`); })}>{busy === 'test-' + m.id ? '…' : t('Test', 'اختبار')}</Btn>
                <Switch on={m.enabled} onChange={(v) => void act('toggle', async () => { await invoke('mailbox_toggle', { id: m.id, enabled: v }); return v ? t(`${m.label} enabled`, `${m.label} مُفعّل`) : t(`${m.label} paused`, `${m.label} متوقّف`); })} label="Enabled" />
                <button className="o-more" aria-label="Remove" onClick={() => act('rm', async () => { await invoke('mailbox_remove', { id: m.id }); return t('Mailbox removed', 'تمت إزالة الصندوق'); })}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={Mail} title={t('No mailboxes yet', 'لا توجد صناديق بعد')} text={t('Add a Gmail (app password) or SMTP account to send. Add several to spread the volume.', 'أضف حساب Gmail (كلمة مرور تطبيق) أو SMTP للإرسال. أضف عدة حسابات لتوزيع الحجم.')} />}
    </Card>
  );
}

type JAppMsg = { id: string; direction: string; subject: string; body: string; at: string; attachments: string[] };
type JApp = { id: string; company: string; role: string; location: string; country: string; url: string; source: string; status: string; job_desc: string; contact_email?: string | null; tailored_resume: string; cover_letter: string; applied_at?: string | null; follow_ups: { at: string; done: boolean }[]; notes: string; created_at: string; messages?: JAppMsg[] };
type JState = { applications: JApp[]; settings: { follow_up_max: number; follow_up_days: number } };
type JJob = { id: string; title: string; role: string; company: string; location: string; country: string; url: string; source: string; snippet: string; employment_type?: string; work_mode?: string; seniority?: string; salary?: string; posted?: string; logo?: string };
type JobResult = { query: string; count: number; jobs: JJob[]; demand: { country: string; count: number; lat: number; lon: number }[]; fetched_at: string };

function JobsDashboard({ t, ws, go }: { t: T; ws: WsSummary | null; go: (i: number) => void }) {
  const [js, setJs] = useState<JState | null>(null);
  /* oxlint-disable react/react-compiler -- load once */
  useEffect(() => { void invoke<JState>('jobs_state').then(setJs).catch(() => undefined); }, [ws?.workspace.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */
  const apps = js?.applications || [];
  const now = new Date().toISOString();
  const applied = apps.filter((a) => a.applied_at).length;
  const replied = apps.filter((a) => a.status === 'replied').length;
  const dueFu = apps.flatMap((a) => a.follow_ups.filter((f) => !f.done && f.at <= now).map(() => a)).length;
  const name = ws?.workspace.profile.name?.split(' ')[0];
  const hasResume = (ws?.workspace.profile.resume_text || ws?.workspace.profile.offer || '').length > 60;
  return (
    <>
      <PageHead title={name ? t(`Let's land your next role, ${name}!`, `يلا نجيبلك وظيفتك الجاية يا ${name}!`) : t('Job search', 'البحث عن عمل')} spark={false} sub={t('Your applications, follow-ups and hiring demand at a glance.', 'تقديماتك ومتابعاتك والطلب على الوظائف في لمحة.')} actions={<><Btn variant="secondary" onClick={() => go(1)}>{t('Review résumé', 'راجع السيرة')}</Btn><Btn icon={Briefcase} onClick={() => go(2)}>{t('Find jobs', 'ابحث عن وظائف')}</Btn></>} />
      <div className="o-grid o-grid-4">
        <StatCard icon={Briefcase} label={t('In pipeline', 'في القائمة')} value={String(apps.length)} trend={null} tone="violet" />
        <StatCard icon={Send} label={t('Applied', 'تم التقديم')} value={String(applied)} trend={null} tone="sky" />
        <StatCard icon={MessageSquare} label={t('Responses', 'ردود')} value={String(replied)} trend={null} tone="green" />
        <StatCard icon={Clock} label={t('Follow-ups due', 'متابعات مستحقة')} value={String(dueFu)} trend={null} tone="orange" />
      </div>
      <div className="o-grid o-grid-2">
        <Card>
          <CardHead title={t('Get started', 'ابدأ')} />
          <button className={`o-check${hasResume ? ' done' : ''}`} onClick={() => go(1)}><i>{hasResume ? '✓' : ''}</i><span>{t('Add and review your résumé (ATS check)', 'أضف وراجع سيرتك (فحص ATS)')}</span><ChevronRight size={14} /></button>
          <button className={`o-check${apps.length ? ' done' : ''}`} onClick={() => go(2)}><i>{apps.length ? '✓' : ''}</i><span>{t('Find jobs and add them to your pipeline', 'ابحث عن وظائف وأضفها لقائمتك')}</span><ChevronRight size={14} /></button>
          <button className={`o-check${apps.some((a) => a.tailored_resume) ? ' done' : ''}`} onClick={() => go(3)}><i>{apps.some((a) => a.tailored_resume) ? '✓' : ''}</i><span>{t('Tailor a résumé + cover letter per company', 'خصّص سيرة + خطاب تغطية لكل شركة')}</span><ChevronRight size={14} /></button>
          <button className={`o-check${applied ? ' done' : ''}`} onClick={() => go(3)}><i>{applied ? '✓' : ''}</i><span>{t('Apply and schedule your follow-ups', 'قدّم وجدول متابعاتك')}</span><ChevronRight size={14} /></button>
        </Card>
        <Card>
          <CardHead title={t('Recent applications', 'أحدث التقديمات')} action={<ViewAll label={t('All', 'الكل')} onClick={() => go(3)} />} />
          {apps.length ? apps.slice(0, 6).map((x) => <Row key={x.id} icon={Briefcase} title={`${x.role} · ${x.company || x.source}`} meta={`${x.location || x.country} · ${x.status}`} right={<Chip tone={x.status === 'replied' ? 'green' : x.status === 'applied' ? 'violet' : 'neutral'}>{x.status}</Chip>} />) : <EmptyState icon={Briefcase} title={t('No applications yet', 'لا توجد تقديمات بعد')} text={t('Find jobs to build your pipeline.', 'ابحث عن وظائف لبناء قائمتك.')} />}
        </Card>
      </div>
    </>
  );
}

// ---- Résumé file I/O + word diff (all client-side, no libraries) ----
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** Read selected entries out of a .docx (ZIP) via its central directory + DecompressionStream. */
async function unzipDocx(buf: ArrayBuffer, want: string[]): Promise<Record<string, string>> {
  const bytes = new Uint8Array(buf); const dv = new DataView(buf); const dec = new TextDecoder();
  let p = bytes.length - 22;
  while (p >= 0 && dv.getUint32(p, true) !== 0x06054b50) p--;
  if (p < 0) throw new Error('Not a valid .docx file');
  const count = dv.getUint16(p + 10, true); let off = dv.getUint32(p + 16, true);
  const out: Record<string, string> = {};
  for (let n = 0; n < count && off + 46 <= bytes.length; n++) {
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const cmtLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = dec.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    if (want.includes(name)) {
      const lNameLen = dv.getUint16(localOff + 26, true);
      const lExtra = dv.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + lNameLen + lExtra;
      const comp = bytes.subarray(dataStart, dataStart + compSize);
      out[name] = dec.decode(method === 0 ? comp : await inflateRaw(comp));
    }
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}
/** Extract a .docx as Markdown, preserving headings, bold, bullet lists, section separators and hyperlinks. */
async function docxToMarkdown(buf: ArrayBuffer): Promise<string> {
  const parts = await unzipDocx(buf, ['word/document.xml', 'word/_rels/document.xml.rels']);
  const docXml = parts['word/document.xml'];
  if (!docXml) throw new Error('document.xml not found in .docx');
  const rels: Record<string, string> = {};
  if (parts['word/_rels/document.xml.rels']) {
    const rd = new DOMParser().parseFromString(parts['word/_rels/document.xml.rels'], 'application/xml');
    for (const r of Array.from(rd.getElementsByTagName('Relationship'))) {
      if ((r.getAttribute('Type') || '').includes('/hyperlink')) rels[r.getAttribute('Id') || ''] = r.getAttribute('Target') || '';
    }
  }
  const doc = new DOMParser().parseFromString(docXml, 'application/xml');
  const el = (parent: Element, tag: string) => Array.from(parent.getElementsByTagName(tag));
  const runMd = (r: Element): string => {
    let txt = '';
    for (const c of Array.from(r.childNodes)) { const nn = (c as Element).nodeName; if (nn === 'w:t') txt += c.textContent || ''; else if (nn === 'w:tab') txt += '  '; else if (nn === 'w:br') txt += ' '; }
    if (!txt) return '';
    const rpr = r.getElementsByTagName('w:rPr')[0];
    const bEl = rpr && rpr.getElementsByTagName('w:b')[0];
    const bold = !!bEl && !['0', 'false', 'none'].includes((bEl.getAttribute('w:val') || '').toLowerCase());
    return bold ? `**${txt}**` : txt;
  };
  const lines: string[] = [];
  const paras = el(doc.documentElement, 'w:p');
  for (const par of paras) {
    const ppr = par.getElementsByTagName('w:pPr')[0];
    const styleEl = ppr && ppr.getElementsByTagName('w:pStyle')[0];
    const style = styleEl ? (styleEl.getAttribute('w:val') || '') : '';
    const isBullet = !!(ppr && ppr.getElementsByTagName('w:numPr')[0]);
    const hasRule = !!(ppr && ppr.getElementsByTagName('w:pBdr')[0]);
    // inline content in document order: runs and hyperlinks
    let content = '';
    for (const node of Array.from(par.childNodes)) {
      const nn = (node as Element).nodeName;
      if (nn === 'w:r') content += runMd(node as Element);
      else if (nn === 'w:hyperlink') {
        const inner = el(node as Element, 'w:r').map(runMd).join('').replace(/\*\*/g, '').trim();
        const id = (node as Element).getAttribute('r:id') || '';
        const url = rels[id];
        content += url ? `[${inner}](${url})` : inner;
      }
    }
    content = content.replace(/\*\*\s*\*\*/g, '').trim();
    const hMatch = /^Heading(\d)/i.exec(style);
    const wholeBold = content.length > 0 && /^\*\*[^*]+\*\*$/.test(content) && content.length <= 64;
    if (content) {
      if (hMatch) lines.push(`${'#'.repeat(Math.min(6, Number(hMatch[1]) + 1))} ${content.replace(/\*\*/g, '')}`);
      else if (wholeBold) lines.push(`## ${content.replace(/\*\*/g, '')}`);
      else if (isBullet) lines.push(`- ${content}`);
      else lines.push(content);
    } else if (!lines.length || lines[lines.length - 1] !== '') {
      lines.push('');
    }
    if (hasRule) lines.push('---');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
const CRC_TABLE = (() => { const tbl = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); tbl[n] = c >>> 0; } return tbl; })();
function crc32(b: Uint8Array): number { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function catBytes(parts: Uint8Array[]): Uint8Array { let len = 0; for (const q of parts) len += q.length; const out = new Uint8Array(len); let o = 0; for (const q of parts) { out.set(q, o); o += q.length; } return out; }
const _u16 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
const _u32 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
/** Minimal store-method (uncompressed) ZIP — enough for a valid .docx. */
function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder(); const locals: Uint8Array[] = []; const centrals: Uint8Array[] = []; let offset = 0;
  for (const f of files) {
    const nb = enc.encode(f.name); const crc = crc32(f.data); const sz = f.data.length;
    const local = catBytes([_u32(0x04034b50), _u16(20), _u16(0), _u16(0), _u16(0), _u16(0), _u32(crc), _u32(sz), _u32(sz), _u16(nb.length), _u16(0), nb, f.data]);
    locals.push(local);
    centrals.push(catBytes([_u32(0x02014b50), _u16(20), _u16(20), _u16(0), _u16(0), _u16(0), _u16(0), _u32(crc), _u32(sz), _u32(sz), _u16(nb.length), _u16(0), _u16(0), _u16(0), _u16(0), _u32(0), _u32(offset), nb]));
    offset += local.length;
  }
  const cd = catBytes(centrals);
  const eocd = catBytes([_u32(0x06054b50), _u16(0), _u16(0), _u16(files.length), _u16(files.length), _u32(cd.length), _u32(offset), _u16(0)]);
  return catBytes([...locals, cd, eocd]);
}
function xmlEsc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
/** Build a formatted .docx from Markdown: ## headings (bold), - bullets, --- rules, **bold**, and real hyperlinks. */
function buildDocx(md: string): Uint8Array {
  const enc = new TextEncoder();
  const linkRels: { id: string; target: string }[] = [];
  const run = (text: string, opts: { bold?: boolean; link?: boolean } = {}) => text === '' ? '' : `<w:r><w:rPr>${opts.bold ? '<w:b/>' : ''}${opts.link ? '<w:color w:val="0563C1"/><w:u w:val="single"/>' : ''}</w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
  const inline = (s: string, forceBold = false): string => {
    let out = ''; const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g; let last = 0; let m: RegExpExecArray | null;
    const emitPlain = (chunk: string) => { for (const p of chunk.split(/(\*\*[^*]+\*\*)/g)) { if (!p) continue; const b = /^\*\*[^*]+\*\*$/.test(p); out += run(b ? p.slice(2, -2) : p, { bold: forceBold || b }); } };
    while ((m = linkRe.exec(s))) { emitPlain(s.slice(last, m.index)); const id = `rIdL${linkRels.length + 1}`; linkRels.push({ id, target: m[2] }); out += `<w:hyperlink r:id="${id}">${run(m[1], { link: true, bold: forceBold })}</w:hyperlink>`; last = m.index + m[0].length; }
    emitPlain(s.slice(last));
    return out || run(' ');
  };
  const paras = md.replace(/\r/g, '').split('\n').map((line) => {
    const s = line.trim();
    if (!s) return '<w:p/>';
    if (/^---+$/.test(s)) return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C9C9D4"/></w:pBdr></w:pPr></w:p>';
    const h = /^(#{1,6})\s+(.*)$/.exec(s);
    if (h) return `<w:p><w:pPr><w:spacing w:before="180" w:after="60"/></w:pPr>${inline(h[2], true)}</w:p>`;
    const b = /^[-*•]\s+(.*)$/.exec(s);
    if (b) return `<w:p><w:pPr><w:ind w:left="360" w:hanging="200"/></w:pPr>${run('•  ')}${inline(b[1])}</w:p>`;
    return `<w:p>${inline(s)}</w:p>`;
  }).join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${paras}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${linkRels.map((l) => `<Relationship Id="${l.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEsc(l.target)}" TargetMode="External"/>`).join('')}</Relationships>`;
  return zipStore([
    { name: '[Content_Types].xml', data: enc.encode(ct) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'word/document.xml', data: enc.encode(doc) },
    { name: 'word/_rels/document.xml.rels', data: enc.encode(docRels) },
  ]);
}
type DiffTok = { t: 'same' | 'add' | 'del'; s: string };
/** Line-level diff (LCS) between the original and the rewrite — keeps each line's Markdown intact so
 *  the rendered diff shows headings, separators and links, not broken plain text. */
function diffLines(a: string, b: string): DiffTok[] {
  const A = a.replace(/\r/g, '').split('\n'), B = b.replace(/\r/g, '').split('\n'); const n = A.length, m = B.length;
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = norm(A[i]) === norm(B[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffTok[] = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (norm(A[i]) === norm(B[j])) { out.push({ t: 'same', s: B[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: 'del', s: A[i] }); i++; }
    else { out.push({ t: 'add', s: B[j] }); j++; }
  }
  while (i < n) { out.push({ t: 'del', s: A[i] }); i++; }
  while (j < m) { out.push({ t: 'add', s: B[j] }); j++; }
  return out;
}

function ResumePage({ t, ws, reload }: { t: T; ws: WsSummary | null; reload: () => Promise<void> }) {
  const [resume, setResume] = useState(ws?.workspace.profile.offer || '');
  const [portfolio, setPortfolio] = useState(ws?.workspace.profile.persona || '');
  const [role, setRole] = useState(ws?.workspace.profile.target_roles || ws?.workspace.profile.role || '');
  const [report, setReport] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: 'green' | 'coral'; text: string } | null>(null);
  const [improved, setImproved] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [baseAtStream, setBaseAtStream] = useState('');
  const [view, setView] = useState<'diff' | 'new' | 'original'>('diff');
  const [pendingUse, setPendingUse] = useState<string | null>(null);
  const versions = ws?.workspace.profile.resume_versions || [];
  const fileRef = useRef<HTMLInputElement>(null);
  const jobRef = useRef<string | null>(null);
  const un = useRef<UnlistenFn | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  /* oxlint-disable react/react-compiler -- sync from workspace once */
  useEffect(() => { if (ws) { setResume(ws.workspace.profile.offer || ''); setPortfolio(ws.workspace.profile.persona || ''); setRole(ws.workspace.profile.target_roles || ws.workspace.profile.role || ''); } }, [ws?.workspace.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (jobRef.current) void invoke('job_cancel', { jobId: jobRef.current }); un.current?.(); }, []);
  useEffect(() => { if (streaming && resultRef.current) resultRef.current.scrollTop = resultRef.current.scrollHeight; }, [improved, streaming]);
  /* oxlint-enable react/react-compiler */
  const save = async () => { if (!ws) return; setBusy('save'); try { await invoke('workspace_save', { workspace: { ...ws.workspace, profile: { ...ws.workspace.profile, offer: resume, persona: portfolio, target_roles: role } } }); await reload(); setMsg({ tone: 'green', text: t('Saved', 'تم الحفظ') }); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const review = async () => { setBusy('review'); setMsg(null); try { await save(); setReport(await invoke<string>('jobs_review_resume', { resume, targetRole: role })); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const onUpload = async (f: File | undefined) => {
    if (!f) return; setMsg(null);
    try {
      const lower = f.name.toLowerCase();
      let text = '';
      if (lower.endsWith('.docx')) text = await docxToMarkdown(await f.arrayBuffer());
      else if (lower.endsWith('.txt') || lower.endsWith('.md')) text = await f.text();
      else { setMsg({ tone: 'coral', text: t('Upload a .docx or .txt file (for PDF, paste the text).', 'ارفع ملف .docx أو .txt (لملفات PDF الصق النص).') }); return; }
      if (!text.trim()) { setMsg({ tone: 'coral', text: t('Could not read any text from that file.', 'تعذّر قراءة أي نص من الملف.') }); return; }
      setResume(text); setImproved(''); setMsg({ tone: 'green', text: t(`Loaded ${f.name} (${text.length} chars)`, `تم تحميل ${f.name} (${text.length} حرف)`) });
    } catch (e) { setMsg({ tone: 'coral', text: `${t('Could not read file', 'تعذّرت قراءة الملف')}: ${String(e)}` }); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  const improve = async () => {
    if (resume.trim().length < 60) { setMsg({ tone: 'coral', text: t('Add your résumé text first.', 'أضف نص سيرتك أولاً.') }); return; }
    setMsg(null); await save();
    const id = `resume-${Date.now()}`; jobRef.current = id; setImproved(''); setBaseAtStream(resume); setView('diff'); setStreaming(true);
    un.current = await listen<{ type: string; text?: string; error?: string }>(`resume://${id}`, (ev) => {
      const e = ev.payload;
      if (e.type === 'delta') setImproved((prev) => prev + (e.text || ''));
      else if (e.type === 'done') { const finalText = e.text || ''; if (finalText) { setImproved(finalText); void saveVersion(finalText, role ? `${role}` : t('Rewrite', 'صياغة')); } setStreaming(false); jobRef.current = null; un.current?.(); un.current = null; }
      else if (e.type === 'error') { setMsg({ tone: 'coral', text: e.error || 'failed' }); setStreaming(false); jobRef.current = null; un.current?.(); un.current = null; }
      else if (e.type === 'cancelled') { setStreaming(false); jobRef.current = null; un.current?.(); un.current = null; }
    });
    try { await invoke('jobs_resume_improve', { jobId: id, resume, targetRole: role }); }
    catch (e) { setMsg({ tone: 'coral', text: String(e) }); setStreaming(false); jobRef.current = null; }
  };
  const cancel = async () => { if (jobRef.current) await invoke('job_cancel', { jobId: jobRef.current }); };
  const useAsBase = async () => { setResume(improved); if (ws) { setBusy('use'); try { await invoke('workspace_save', { workspace: { ...ws.workspace, profile: { ...ws.workspace.profile, offer: improved, persona: portfolio, target_roles: role } } }); await reload(); setMsg({ tone: 'green', text: t('Saved as your base résumé.', 'تم الحفظ كسيرتك الأساسية.') }); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } } };
  const saveVersion = async (text: string, label: string) => {
    if (!ws || !text.trim()) return;
    const v: ResumeVersion = { id: `rv-${Date.now()}`, label: label.slice(0, 60) || t('Version', 'نسخة'), text, created_at: new Date().toISOString() };
    const list = [v, ...(ws.workspace.profile.resume_versions || []).filter((x) => x.text !== text)].slice(0, 20);
    try { await invoke('workspace_save', { workspace: { ...ws.workspace, profile: { ...ws.workspace.profile, resume_versions: list } } }); await reload(); } catch { /* ignore */ }
  };
  const useVersion = async (v: ResumeVersion) => {
    if (!ws) return; setBusy(`use-${v.id}`); setPendingUse(null);
    try { setResume(v.text); await invoke('workspace_save', { workspace: { ...ws.workspace, profile: { ...ws.workspace.profile, offer: v.text } } }); await reload(); setMsg({ tone: 'green', text: t(`Now using “${v.label}” as your base résumé.`, `يتم الآن استخدام «${v.label}» كسيرتك الأساسية.`) }); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); }
  };
  const deleteVersion = async (id: string) => {
    if (!ws) return;
    const list = (ws.workspace.profile.resume_versions || []).filter((x) => x.id !== id);
    try { await invoke('workspace_save', { workspace: { ...ws.workspace, profile: { ...ws.workspace.profile, resume_versions: list } } }); await reload(); } catch { /* ignore */ }
  };
  const downloadDocx = async () => {
    setBusy('docx'); setMsg(null);
    try {
      const bytes = buildDocx(improved);
      const name = `${(ws?.workspace.profile.name || 'resume').replace(/\s+/g, '_')}_${(role || 'role').replace(/\s+/g, '_')}.docx`;
      const path = await invoke<string>('jobs_save_download', { name, bytes: Array.from(bytes) });
      setMsg({ tone: 'green', text: `${t('Saved & opened', 'تم الحفظ والفتح')}: ${path}` });
    } catch (e) { setMsg({ tone: 'coral', text: `${t('Could not save .docx', 'تعذّر حفظ ملف .docx')}: ${String(e)}` }); }
    finally { setBusy(''); }
  };
  const diff = (view === 'diff' && improved) ? diffLines(baseAtStream || resume, improved) : null;
  const added = diff ? diff.filter((d) => d.t === 'add' && d.s.trim()).length : 0;
  const removed = diff ? diff.filter((d) => d.t === 'del' && d.s.trim()).length : 0;
  return (
    <>
      <input ref={fileRef} type="file" accept=".docx,.txt,.md" hidden onChange={(e) => void onUpload(e.target.files?.[0])} />
      <PageHead eyebrow={t('Résumé & ATS', 'السيرة والـ ATS')} title={t('Resume & ATS check', 'السيرة وفحص ATS')} spark={false} sub={t('Upload your résumé (.docx) or paste it, then rewrite it live for ATS. Review the diff and export a clean .docx.', 'ارفع سيرتك (.docx) أو الصقها، ثم أعد صياغتها مباشرةً للـ ATS. راجع الفروقات وصدّر ملف .docx نظيف.')} actions={<><Btn variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()} disabled={!!busy || streaming}>{t('Upload résumé', 'ارفع السيرة')}</Btn><Btn variant="secondary" onClick={save} disabled={!!busy || streaming}>{busy === 'save' ? t('Saving…', 'جاري الحفظ…') : t('Save', 'حفظ')}</Btn><Btn icon={Sparkles} variant="ai" onClick={improve} disabled={!!busy || streaming}>{streaming ? t('Rewriting…', 'جاري الصياغة…') : t('Rewrite live for ATS', 'أعد الصياغة مباشرةً')}</Btn></>} />
      {msg && <div className={`o-result${msg.tone === 'coral' ? ' error' : ''}`}><Check size={16} /><span style={{ wordBreak: 'break-all' }}>{msg.text}</span></div>}
      <Card>
        <CardHead title={t('Base résumé — live editor', 'السيرة الأساسية — محرر مباشر')} sub={t('Edit the source on the left; the rendered résumé updates live on the right, like Overleaf. This is the .docx you export.', 'حرّر المصدر على اليسار؛ السيرة المنسّقة تتحدّث مباشرةً على اليمين، مثل Overleaf. هذا هو ملف .docx الذي تصدّره.')} action={<Btn variant="ghost" size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>{t('Upload', 'رفع')}</Btn>} />
        <label className="o-field">{t('Target role', 'الوظيفة المستهدفة')}<input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t('e.g. Senior Backend Engineer', 'مثال: مهندس Backend أول')} /></label>
        <div className="o-editor-split">
          <div className="o-editor-pane">
            <div className="o-editor-label">{t('Source', 'المصدر')}</div>
            <textarea className="o-input o-editor-src" value={resume} onChange={(e) => setResume(e.target.value)} placeholder={t('Paste your résumé text, or upload a .docx…', 'الصق نص سيرتك، أو ارفع ملف .docx…')} spellCheck={false} />
          </div>
          <div className="o-editor-pane">
            <div className="o-editor-label">{t('Rendered preview', 'المعاينة المنسّقة')}</div>
            <div className="o-editor-preview o-resume-view doc">{resume.trim() ? <Md text={resume} /> : <span className="o-muted">{t('Your résumé preview appears here as you type.', 'تظهر معاينة سيرتك هنا أثناء الكتابة.')}</span>}</div>
          </div>
        </div>
      </Card>
      <div className="o-grid o-grid-2">
        <Card><CardHead title={t('Portfolio / projects', 'معرض الأعمال / المشاريع')} sub={t('Links, projects, achievements used to tailor per job.', 'روابط ومشاريع وإنجازات تُستخدم للتخصيص لكل وظيفة.')} /><textarea className="o-input" rows={12} style={{ width: '100%', height: 'auto', padding: 10, fontFamily: 'var(--font-sans)' }} value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder={t('Projects, GitHub, live sites, notable results…', 'مشاريع، GitHub، مواقع حية، نتائج بارزة…')} /></Card>
        <Card>
          <CardHead title={t('Versions', 'النسخ')} sub={t('Each live rewrite is saved here. Pick one and confirm to make it your base résumé.', 'كل صياغة مباشرة تُحفظ هنا. اختر واحدة وأكّد لجعلها سيرتك الأساسية.')} />
          {versions.length ? (
            <div className="o-versions">
              {versions.map((v) => {
                const inUse = v.text.trim() === resume.trim();
                return (
                  <div key={v.id} className={`o-version${inUse ? ' active' : ''}`}>
                    <div className="o-version-info"><b>{v.label}</b><small>{new Date(v.created_at).toLocaleString()} · {v.text.length} {t('chars', 'حرف')}</small></div>
                    <div className="o-flex">
                      {inUse ? <Chip tone="green">{t('In use', 'مستخدمة')}</Chip>
                        : pendingUse === v.id ? <><Btn size="sm" icon={Check} onClick={() => useVersion(v)} disabled={!!busy}>{t('Confirm use', 'تأكيد الاستخدام')}</Btn><Btn size="sm" variant="ghost" onClick={() => setPendingUse(null)}>{t('Cancel', 'إلغاء')}</Btn></>
                        : <Btn size="sm" variant="secondary" onClick={() => setPendingUse(v.id)}>{t('Use this version', 'استخدم هذه النسخة')}</Btn>}
                      <Btn size="sm" variant="ghost" onClick={() => { setResume(v.text); setImproved(''); }}>{t('Open', 'فتح')}</Btn>
                      <button className="o-more" aria-label={t('Delete', 'حذف')} onClick={() => deleteVersion(v.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState icon={History} title={t('No versions yet', 'لا توجد نسخ بعد')} text={t('Run a live rewrite — each result is saved as a version you can switch to.', 'شغّل صياغة مباشرة — كل نتيجة تُحفظ كنسخة يمكنك التبديل إليها.')} />}
          <Btn variant="ghost" size="sm" icon={Copy} onClick={() => void saveVersion(resume, `${role || t('Manual', 'يدوي')} · ${t('current', 'حالية')}`)} disabled={!resume.trim() || !!busy}>{t('Save current as a version', 'احفظ الحالية كنسخة')}</Btn>
        </Card>
      </div>
      {(streaming || improved) && (
        <Card>
          <CardHead title={t('Live rewrite', 'الصياغة المباشرة')} sub={streaming ? t('Watching the model rewrite your résumé…', 'شاهد النموذج يعيد صياغة سيرتك…') : t('ATS-optimized version, aligned to a clean .docx.', 'نسخة محسّنة للـ ATS، متوافقة مع ملف .docx نظيف.')}
            action={
              <div className="o-flex">
                {!streaming && improved && <div className="o-seg">
                  <button className={view === 'diff' ? 'active' : ''} onClick={() => setView('diff')}><GitCompare size={13} /> {t('Diff', 'الفروقات')}</button>
                  <button className={view === 'new' ? 'active' : ''} onClick={() => setView('new')}>{t('New', 'الجديد')}</button>
                  <button className={view === 'original' ? 'active' : ''} onClick={() => setView('original')}>{t('Original', 'الأصلي')}</button>
                </div>}
                {streaming ? <Btn variant="ghost" size="sm" onClick={cancel}>{t('Stop', 'إيقاف')}</Btn> : improved && <>
                  <Btn variant="ghost" size="sm" icon={Copy} onClick={() => navigator.clipboard.writeText(improved)}>{t('Copy', 'نسخ')}</Btn>
                  <Btn variant="secondary" size="sm" onClick={useAsBase} disabled={!!busy}>{t('Use as base', 'اعتمدها أساساً')}</Btn>
                  <Btn size="sm" icon={Download} onClick={downloadDocx} disabled={!!busy}>{busy === 'docx' ? t('Saving…', 'جاري الحفظ…') : t('Export .docx', 'صدّر .docx')}</Btn>
                </>}
              </div>
            } />
          {!streaming && improved && view === 'diff' && <div className="o-diff-legend"><span className="o-diff-add">+{added} {t('lines added', 'سطر مضاف')}</span><span className="o-diff-del">−{removed} {t('lines removed', 'سطر محذوف')}</span></div>}
          <div className={`o-resume-view${view === 'diff' && !streaming ? ' diff' : ' doc'}`} ref={resultRef}>
            {streaming ? <>{improved}<span className="o-type-caret" /></>
              : view === 'new' ? <Md text={improved} />
              : view === 'original' ? <Md text={baseAtStream || resume} />
              : diff ? diff.map((d, i) => d.s.trim() ? <div key={i} className={`o-diff-line ${d.t}`}><Md text={d.s} compact /></div> : <div key={i} className="o-diff-gap" />)
              : <Md text={improved} />}
          </div>
        </Card>
      )}
      {report && <Card><CardHead title={t('ATS review', 'فحص ATS')} action={<Btn variant="ghost" size="sm" icon={FileCheck} onClick={review} disabled={!!busy}>{t('Re-run', 'إعادة')}</Btn>} /><Md text={report} /></Card>}
      {!report && <Card><EmptyState icon={FileCheck} title={t('Run an ATS review', 'شغّل فحص ATS')} text={t('Get a score, missing keywords and concrete fixes for your target role.', 'احصل على درجة وكلمات مفتاحية ناقصة وإصلاحات محددة لوظيفتك المستهدفة.')} action={<Btn variant="secondary" size="sm" icon={FileCheck} onClick={review} disabled={!!busy}>{busy === 'review' ? t('Analysing…', 'جاري التحليل…') : t('Run ATS review', 'شغّل فحص ATS')}</Btn>} /></Card>}
    </>
  );
}

// Equirectangular projection + a crude dotted landmask (self-authored; the polygons only gate
// which grid dots light up, so exact borders don't matter — the dots read clearly as a world map).
const WM_W = 1000, WM_H = 470;
const WM_LAT_TOP = 80, WM_LAT_BOT = -56, WM_LAT_SPAN = WM_LAT_TOP - WM_LAT_BOT;
const wmProj = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * WM_W, ((WM_LAT_TOP - lat) / WM_LAT_SPAN) * WM_H];
const WM_CONTINENTS: [number, number][][] = [
  [[-168, 65], [-150, 70], [-125, 70], [-95, 72], [-60, 82], [-55, 62], [-78, 50], [-52, 47], [-66, 44], [-80, 26], [-98, 25], [-110, 23], [-116, 31], [-124, 40], [-130, 54], [-150, 59], [-168, 65]],
  [[-80, 9], [-60, 11], [-35, -5], [-38, -22], [-58, -34], [-70, -50], [-74, -52], [-72, -30], [-78, -14], [-81, -4], [-80, 9]],
  [[-10, 36], [-2, 48], [3, 51], [-5, 58], [10, 64], [28, 70], [42, 66], [45, 55], [38, 48], [28, 41], [15, 40], [10, 44], [0, 43], [-9, 43], [-10, 36]],
  [[-17, 14], [-6, 32], [11, 37], [25, 33], [33, 31], [44, 11], [51, 12], [41, -3], [40, -16], [33, -27], [20, -35], [13, -17], [8, 4], [-8, 5], [-17, 14]],
  [[28, 41], [40, 47], [55, 50], [60, 44], [75, 45], [62, 55], [80, 56], [100, 53], [122, 54], [142, 55], [162, 62], [178, 67], [170, 71], [135, 73], [100, 77], [68, 73], [48, 66], [40, 52], [30, 46], [28, 41]],
  [[60, 25], [68, 24], [73, 20], [77, 8], [82, 8], [90, 22], [95, 16], [99, 10], [105, 10], [110, 20], [122, 24], [119, 15], [104, 1], [98, 4], [89, 21], [80, 13], [72, 17], [62, 23], [60, 25]],
  [[100, 53], [120, 50], [135, 45], [142, 40], [130, 33], [122, 30], [120, 40], [110, 42], [100, 45], [100, 53]],
  [[113, -22], [122, -18], [131, -12], [142, -11], [147, -20], [153, -28], [145, -38], [130, -32], [118, -34], [113, -22]],
];
function wmInside(lon: number, lat: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
const WM_LAND: [number, number][] = (() => {
  const dots: [number, number][] = [];
  for (let lon = -178; lon <= 178; lon += 3.4) for (let lat = WM_LAT_BOT + 2; lat <= WM_LAT_TOP - 4; lat += 3.4) {
    if (WM_CONTINENTS.some((p) => wmInside(lon, lat, p))) dots.push(wmProj(lon, lat));
  }
  return dots;
})();

function WorldDemandMap({ t, demand }: { t: T; demand: { country: string; count: number; lat: number; lon: number }[] }) {
  const pts = demand.filter((d) => d.country !== 'Unknown' && d.country !== 'Remote' && !(d.lat === 0 && d.lon === 0));
  const max = Math.max(1, ...pts.map((d) => d.count));
  const remote = demand.find((d) => d.country === 'Remote')?.count || 0;
  const unknown = demand.find((d) => d.country === 'Unknown')?.count || 0;
  const color = (n: number) => { const x = n / max; return x > 0.66 ? 'var(--coral)' : x > 0.33 ? 'var(--orange)' : 'var(--violet)'; };
  const total = demand.reduce((n, d) => n + d.count, 0);
  const ranked = [...pts].sort((a, b) => b.count - a.count);
  return (
    <div className="o-worldmap-wrap">
      <div className="o-worldmap">
        <svg viewBox={`0 0 ${WM_W} ${WM_H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="World hiring demand map">
          <rect width={WM_W} height={WM_H} rx="14" fill="var(--surface-2)" stroke="var(--line)" />
          {WM_LAND.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.3} fill="var(--muted-2)" opacity={0.32} />)}
          {ranked.map((d) => {
            const [x, y] = wmProj(d.lon, d.lat); const r = 8 + (d.count / max) * 22;
            return (
              <g key={d.country}>
                <title>{`${d.country}: ${d.count}`}</title>
                <circle cx={x} cy={y} r={r} fill={color(d.count)} fillOpacity="0.8" stroke="#fff" strokeWidth="2" />
                <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">{d.count}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="o-demand-list">
        <div className="o-demand-head">{ranked.length ? t('By location', 'حسب الموقع') : t('Locations', 'المواقع')}</div>
        {ranked.map((d) => (
          <div className="o-demand-row" key={d.country} title={`${d.country}: ${d.count}`}>
            <span className="o-demand-dot" style={{ background: color(d.count) }} />
            <span className="o-demand-name">{d.country}</span>
            <span className="o-demand-bar"><i style={{ width: `${Math.max(6, (d.count / max) * 100)}%`, background: color(d.count) }} /></span>
            <b className="o-demand-count">{d.count}</b>
          </div>
        ))}
        {remote > 0 && <div className="o-demand-row"><span className="o-demand-dot" style={{ background: 'var(--green)' }} /><span className="o-demand-name">🌍 {t('Remote', 'عن بُعد')}</span><span className="o-demand-bar"><i style={{ width: `${Math.max(6, (remote / max) * 100)}%`, background: 'var(--green)' }} /></span><b className="o-demand-count">{remote}</b></div>}
        {unknown > 0 && <div className="o-demand-row muted"><span className="o-demand-dot" style={{ background: 'var(--muted-2)' }} /><span className="o-demand-name">📍 {t('Not specified', 'غير محدّد')}</span><span className="o-demand-bar" /><b className="o-demand-count">{unknown}</b></div>}
        {ranked.length === 0 && remote === 0 && unknown === 0 && <div className="o-muted" style={{ fontSize: 12, padding: 8 }}>{t('No location data for this search yet.', 'لا توجد بيانات مواقع لهذا البحث بعد.')}</div>}
        {total > 0 && <div className="o-demand-foot">{t(`${total} postings`, `${total} إعلان`)}</div>}
      </div>
    </div>
  );
}

const LOGO_TONES = ['#6358E8', '#4E9BE9', '#32AD70', '#EB9944', '#EC7560', '#8B5CF6'];
function JobLogo({ job }: { job: JJob }) {
  const [failed, setFailed] = useState(false);
  const label = (job.company || job.source || job.role || '?').trim();
  const ch = (label.replace(/^https?:\/\/(www\.)?/, '')[0] || '?').toUpperCase();
  let h = 0; for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  const bg = LOGO_TONES[h % LOGO_TONES.length];
  // Show the real site/company logo; fall back to a colored initial if it can't load (WebView-safe).
  if (job.logo && !failed) return <div className="o-joblogo" title={job.company || job.source}><img src={job.logo} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /></div>;
  return <div className="o-joblogo" style={{ background: bg }} title={job.company || job.source}><span>{ch}</span></div>;
}

/* oxlint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions -- backdrop click + Escape close the dialog */
function JobCard({ t, job, onClose, onAdd, added }: { t: T; job: JJob; onClose: () => void; onAdd?: (j: JJob) => void; added?: boolean }) {
  const [analysis, setAnalysis] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [logoOk, setLogoOk] = useState(true);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  /* oxlint-disable react/react-compiler */
  useEffect(() => { setAnalysis(''); setErr(''); void analyze(); }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */
  const analyze = async () => { setBusy(true); setErr(''); try { setAnalysis(await invoke<string>('jobs_analyze', { title: job.title || job.role, company: job.company, snippet: job.snippet || '' })); } catch (e) { setErr(String(e)); } finally { setBusy(false); } };
  const meta: [string, string | undefined][] = [
    [t('Company', 'الشركة'), job.company || undefined],
    [t('Location', 'الموقع'), job.location || job.country],
    [t('Work mode', 'نمط العمل'), job.work_mode || undefined],
    [t('Type', 'النوع'), job.employment_type || undefined],
    [t('Seniority', 'المستوى'), job.seniority || undefined],
    [t('Salary', 'الراتب'), job.salary || undefined],
    [t('Posted', 'النشر'), job.posted || undefined],
    [t('Source', 'المصدر'), job.source],
  ];
  return (
    <div className="o-backdrop" onClick={onClose}>
      <div className="o-jobcard" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={job.role}>
        <div className="o-jobcard-head">
          <div className="o-jobcard-logo">{job.logo && logoOk ? <img src={job.logo} alt="" onError={() => setLogoOk(false)} /> : <span>{(job.company || job.role || '?')[0]?.toUpperCase()}</span>}</div>
          <div className="o-jobcard-titles">
            <h2>{job.role || job.title}</h2>
            <p>{job.company || job.source}{job.location ? ` · ${job.location}` : job.country ? ` · ${job.country}` : ''}</p>
            <div className="o-flex" style={{ flexWrap: 'wrap', marginTop: 8 }}>
              <span className="o-id">{job.id}</span>
              {job.work_mode && <Chip tone={job.work_mode === 'Remote' ? 'green' : 'sky'}>{job.work_mode}</Chip>}
              {job.employment_type && <Chip tone="violet">{job.employment_type}</Chip>}
              {job.seniority && <Chip tone="orange">{job.seniority}</Chip>}
              {job.country && job.country !== 'Unknown' && <Chip tone="neutral">{job.country}</Chip>}
            </div>
          </div>
          <button className="o-iconbtn o-jobcard-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="o-jobcard-body">
          <div className="o-jobcard-main">
            <div className="o-between"><h3>{t('Breakdown', 'التفاصيل')}</h3>{busy ? <span className="o-muted" style={{ fontSize: 12 }}><span className="o-spinner" /> {t('Analysing…', 'جاري التحليل…')}</span> : <Btn variant="ghost" size="sm" icon={RefreshCw} onClick={analyze}>{t('Re-analyze', 'إعادة التحليل')}</Btn>}</div>
            {err && <div className="o-result error">{err}</div>}
            {analysis ? <Md text={analysis} /> : !busy && <p className="o-note">{t('AI breakdown of requirements, responsibilities and benefits will appear here.', 'سيظهر هنا تحليل الذكاء الاصطناعي للمتطلبات والمسؤوليات والمزايا.')}</p>}
            {job.snippet && <details className="o-jobcard-raw"><summary>{t('Original posting text', 'نص الإعلان الأصلي')}</summary><p>{job.snippet}</p></details>}
          </div>
          <div className="o-jobcard-side">
            <h3>{t('Details', 'المعلومات')}</h3>
            <dl className="o-facts">{meta.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <div className="o-jobcard-actions">
              <a className="o-btn o-btn-secondary" href={job.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {t('Open posting', 'فتح الإعلان')}</a>
              {onAdd && (added ? <Chip tone="green">{t('In pipeline', 'في القائمة')}</Chip> : <Btn icon={Send} onClick={() => onAdd(job)}>{t('Add to pipeline', 'أضف للقائمة')}</Btn>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
/* oxlint-enable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions */

function JobFinder({ t, openRunId, onOpened }: { t: T; openRunId?: string | null; onOpened?: () => void }) {
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState(150);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [res, setRes] = useState<JobResult | null>(null);
  const [live, setLive] = useState<JJob[]>([]);
  const [progress, setProgress] = useState<{ percent: number; label: string }>({ percent: 0, label: '' });
  const [fCountry, setFCountry] = useState('all');
  const [fSource, setFSource] = useState('all');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<RunMeta[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [selected, setSelected] = useState<JJob | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [addProg, setAddProg] = useState<{ percent: number; label: string } | null>(null);
  const [bulkInfo, setBulkInfo] = useState('');
  const addRef = useRef<string | null>(null);
  const addUn = useRef<UnlistenFn | null>(null);
  const jobRef = useRef<string | null>(null);
  const un = useRef<UnlistenFn | null>(null);
  const stop = () => { un.current?.(); un.current = null; jobRef.current = null; };
  const loadHistory = async () => { try { const all = await invoke<RunMeta[]>('run_list'); setHistory(all.filter((r) => r.mode === 'jobs')); } catch { /* ignore */ } };
  const openRun = async (id: string) => {
    try {
      const r = await invoke<{ id: string; query: string; result: JobResult; saved_at: string }>('run_get', { id });
      setRes(r.result); setLive(r.result.jobs); setQuery(r.query); setRunId(r.id); setFCountry('all'); setFSource('all');
      setProgress({ percent: 100, label: t(`Loaded from history · ${new Date(r.saved_at).toLocaleString()}`, `تم التحميل من السجل · ${new Date(r.saved_at).toLocaleString()}`) });
    } catch (e) { setError(String(e)); }
  };
  /* oxlint-disable react/react-compiler */
  useEffect(() => { void loadHistory(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (openRunId) { void openRun(openRunId); onOpened?.(); } }, [openRunId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (jobRef.current) void invoke('bridge_cancel', { jobId: jobRef.current }); if (addRef.current) void invoke('job_cancel', { jobId: addRef.current }); addUn.current?.(); stop(); }, []);
  /* oxlint-enable react/react-compiler */
  const run = async () => {
    if (!query.trim()) { setError(t('Type a role, skills or title first.', 'اكتب وظيفة أو مهارات أولاً.')); return; }
    const id = `jobs-${Date.now()}`; jobRef.current = id; setBusy(true); setError(''); setRes(null); setLive([]); setRunId(null); setFCountry('all'); setFSource('all'); setProgress({ percent: 0, label: t('Searching job boards…', 'جاري البحث في مواقع التوظيف…') });
    un.current = await listen<Record<string, unknown>>(`bridge://${id}`, (ev) => {
      const e = ev.payload as { type: string; percent?: number; query?: string; count?: number; new?: number; leads?: JJob[]; error?: string; fatal?: boolean; result?: JobResult };
      if (e.type === 'call') setProgress({ percent: e.percent ?? 0, label: e.query || '' });
      else if (e.type === 'batch') { setLive((l) => [...l, ...(e.leads || [])]); setProgress({ percent: e.percent ?? 0, label: t(`+${e.new} · ${e.count} jobs`, `+${e.new} · ${e.count} وظيفة`) }); }
      else if (e.type === 'error') { if (e.fatal) { setError(e.error || 'failed'); setBusy(false); stop(); } }
      else if (e.type === 'done' && e.result) { setRes(e.result); setLive(e.result.jobs); setRunId(id); setProgress({ percent: 100, label: t(`${e.result.count} jobs found`, `${e.result.count} وظيفة`) }); void saveRun(id, e.result); void invoke('workspace_log', { kind: 'research', text: `Job search: "${e.result.query}" → ${e.result.count} jobs` }); setBusy(false); stop(); }
      else if (e.type === 'cancelled') { setBusy(false); stop(); }
    });
    try { await invoke('jobs_search_stream', { jobId: id, query, target }); } catch (e) { setError(String(e)); setBusy(false); stop(); }
  };
  const saveRun = async (id: string, r: JobResult) => { try { await invoke('run_save', { run: { id, mode: 'jobs', query: r.query, target, calls: [], fetched_at: r.fetched_at, leads: r.jobs, result: r, saved_at: new Date().toISOString() } }); await loadHistory(); } catch { /* ignore */ } };
  const deleteRun = async (id: string) => { try { await invoke('run_delete', { id }); if (id === runId) { setRes(null); setLive([]); setRunId(null); } await loadHistory(); } catch { /* ignore */ } };
  const cancel = async () => { if (jobRef.current) await invoke('bridge_cancel', { jobId: jobRef.current }); };
  const addToPipeline = async (j: JJob) => {
    setError(''); setAdding((s) => new Set([...s, j.id]));
    try { await invoke<string>('jobs_application_add_verified', { company: j.company, role: j.role, location: j.location, country: j.country, url: j.url, source: j.source, snippet: j.snippet }); setAdded((s) => new Set([...s, j.id])); }
    catch (e) { setError(`${j.company || j.role}: ${String(e)}`); }
    finally { setAdding((s) => { const n = new Set(s); n.delete(j.id); return n; }); }
  };
  const bulkAdd = async () => {
    const items = selShown.map((j) => ({ id: j.id, company: j.company, role: j.role, location: j.location, country: j.country, url: j.url, source: j.source, snippet: j.snippet }));
    if (!items.length) return;
    const jid = `addver-${Date.now()}`; addRef.current = jid; setError(''); setBulkInfo(''); setAddProg({ percent: 0, label: t('Verifying company emails…', 'التحقق من إيميلات الشركات…') });
    addUn.current = await listen<{ type: string; percent?: number; label?: string; id?: string; ok?: boolean; added?: number; skipped?: number }>(`jobs://${jid}`, (ev) => {
      const e = ev.payload;
      if (e.type === 'start' || e.type === 'progress') setAddProg({ percent: e.percent ?? 0, label: e.label || '' });
      else if (e.type === 'item') { if (e.ok && e.id) setAdded((a) => new Set([...a, e.id!])); setAddProg((p) => p ? { ...p, percent: e.percent ?? p.percent } : p); }
      else if (e.type === 'done') { setAddProg(null); addRef.current = null; addUn.current?.(); addUn.current = null; setSel(new Set()); setBulkInfo(t(`${e.added ?? 0} added with a contact email · ${e.skipped ?? 0} skipped (no public email found)`, `${e.added ?? 0} أُضيفت ببريد تواصل · ${e.skipped ?? 0} تم تخطيها (لا يوجد بريد عام)`)); }
      else if (e.type === 'cancelled') { setAddProg(null); addRef.current = null; addUn.current?.(); addUn.current = null; }
    });
    try { await invoke('jobs_add_verified', { jobId: jid, items }); } catch (e) { setError(String(e)); setAddProg(null); addRef.current = null; }
  };
  const jobs = res ? res.jobs : live;
  const countries = [...new Set(jobs.map((j) => j.country))].sort();
  const sources = [...new Set(jobs.map((j) => j.source))].sort();
  const shown = jobs.filter((j) => (fCountry === 'all' || j.country === fCountry) && (fSource === 'all' || j.source === fSource));
  const selShown = shown.filter((j) => sel.has(j.id));
  const allSel = shown.length > 0 && shown.every((j) => sel.has(j.id));
  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSel((s) => { if (shown.every((j) => s.has(j.id))) { const n = new Set(s); shown.forEach((j) => n.delete(j.id)); return n; } return new Set([...s, ...shown.map((j) => j.id)]); });
  return (
    <>
      <PageHead eyebrow={t('Global · Arab · Gulf boards', 'مواقع عالمية · عربية · خليجية')} title={t('Find Jobs', 'ابحث عن وظائف')} spark={false} sub={t('One search across LinkedIn, Indeed, Glassdoor, Bayt, Wuzzuf, GulfTalent, NaukriGulf and more, through Agent Reach.', 'بحث واحد عبر LinkedIn وIndeed وGlassdoor وBayt وWuzzuf وGulfTalent وNaukriGulf وغيرها، عبر Agent Reach.')} />
      <Card>
        <div className="o-research-input">
          <IconTile icon={Briefcase} tone="violet" />
          <input className="o-input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder={t('e.g. Backend engineer Node.js, or Product manager fintech', 'مثال: Backend engineer Node.js أو Product manager fintech')} />
          <label className="o-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{t('Target', 'العدد')}<input type="number" min={10} max={2000} step={50} value={target} onChange={(e) => setTarget(Number(e.target.value) || 150)} style={{ width: 80 }} /></label>
          <Btn onClick={run} disabled={busy}>{busy ? t('Searching…', 'جاري البحث…') : t('Find jobs', 'ابحث')}</Btn>
        </div>
        {(busy || progress.percent > 0) && <div className="o-loader"><div className="o-loader-head"><span className={`o-spinner${busy ? '' : ' done'}`} /><b>{progress.percent}%</b><span className="o-loader-label">{progress.label}</span>{busy && <Btn variant="ghost" size="sm" onClick={cancel}>{t('Cancel', 'إلغاء')}</Btn>}</div><div className="o-progress lg"><i style={{ width: `${progress.percent}%` }} /></div></div>}
        {error && <div className="o-result error">{error}</div>}
      </Card>
      {res && res.demand.length > 0 && <Card><CardHead title={t('Where the jobs are', 'أين الوظائف')} sub={t('Hiring demand for this search, by country.', 'الطلب على التوظيف لهذا البحث، حسب الدولة.')} /><WorldDemandMap t={t} demand={res.demand} /></Card>}
      {jobs.length > 0 && (
        <Card>
          <CardHead title={t(`${shown.length} of ${jobs.length} jobs`, `${shown.length} من ${jobs.length} وظيفة`)} action={<div className="o-flex">{sel.size > 0 && <><Btn size="sm" icon={Send} onClick={bulkAdd} disabled={!!addProg}>{addProg ? t('Verifying…', 'جاري التحقق…') : t(`Add ${selShown.length} (verify emails)`, `أضف ${selShown.length} (تحقق من الإيميل)`)}</Btn><Btn size="sm" variant="ghost" onClick={() => setSel(new Set())}>{t('Clear', 'مسح')}</Btn></>}<select className="o-input" aria-label="Country" style={{ height: 32 }} value={fCountry} onChange={(e) => setFCountry(e.target.value)}><option value="all">{t('All countries', 'كل الدول')}</option>{countries.map((c) => <option key={c} value={c}>{c}</option>)}</select><select className="o-input" aria-label="Source" style={{ height: 32 }} value={fSource} onChange={(e) => setFSource(e.target.value)}><option value="all">{t('All sources', 'كل المصادر')}</option>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>} />
          {addProg && <div className="o-loader"><div className="o-loader-head"><span className="o-spinner" /><b>{addProg.percent}%</b><span className="o-loader-label">{t('Finding a contact email for each company — only ones with an email are added', 'إيجاد بريد تواصل لكل شركة — تُضاف فقط التي لها بريد')} · {addProg.label}</span></div><div className="o-progress lg"><i style={{ width: `${addProg.percent}%` }} /></div></div>}
          {bulkInfo && <div className="o-result"><Check size={16} />{bulkInfo}</div>}
          <div className="o-jobs-table">
          <Table columns={[<input key="all" type="checkbox" aria-label="Select all" checked={allSel} onChange={toggleAll} />, t('Role', 'الوظيفة'), t('Company', 'الشركة'), t('Location', 'الموقع'), t('Work mode', 'نمط العمل'), t('Salary', 'الراتب'), t('Source', 'المصدر'), '']}>
            {shown.slice(0, 200).map((j) => (
              <tr key={j.url} className={`o-clickrow${sel.has(j.id) ? ' o-row-sel' : ''}`} onClick={() => setSelected(j)}>
                <td style={{ width: 46, paddingInlineEnd: 0 }} onClick={(e) => e.stopPropagation()}><div className="o-flex" style={{ gap: 6 }}><input type="checkbox" aria-label="Select" checked={sel.has(j.id)} onChange={() => toggleSel(j.id)} /><JobLogo job={j} /></div></td>
                <td style={{ whiteSpace: 'normal', maxWidth: 300 }}><b className="o-link">{j.role || j.title}</b></td>
                <td>{j.company || '—'}</td>
                <td>{j.location || j.country}</td>
                <td>{j.work_mode || j.employment_type ? <div className="o-flex" style={{ gap: 4, flexWrap: 'wrap' }}>{j.work_mode && <Chip tone={j.work_mode === 'Remote' ? 'green' : 'sky'}>{j.work_mode}</Chip>}{j.employment_type && <Chip tone="neutral">{j.employment_type}</Chip>}</div> : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{j.salary || '—'}</td>
                <td>{j.source}</td>
                <td onClick={(e) => e.stopPropagation()}>{added.has(j.id) ? <Chip tone="green">{t('Added', 'مضاف')}</Chip> : <Btn size="sm" variant="secondary" onClick={() => addToPipeline(j)} disabled={adding.has(j.id)}>{adding.has(j.id) ? t('Searching…', 'بحث…') : t('Add', 'إضافة')}</Btn>}</td>
              </tr>
            ))}
          </Table>
          </div>
        </Card>
      )}
      <Card>
        <div className="o-history">
          <div className="o-between"><b><History size={14} /> {t('Saved searches', 'عمليات بحث محفوظة')}</b><span className="o-muted" style={{ fontSize: 11 }}>{history.length ? `${history.length} ${t('saved', 'محفوظة')}` : t('auto-saved when a search finishes', 'تُحفظ تلقائياً عند انتهاء البحث')}</span></div>
          {history.length ? (
            <div className="o-history-list">
              {history.slice(0, 10).map((r) => (
                <div key={r.id} className={`o-history-item${r.id === runId ? ' active' : ''}`} style={{ position: 'relative' }}>
                  <button style={{ textAlign: 'start', width: '100%' }} onClick={() => openRun(r.id)}>
                    <b>{r.query}</b>
                    <small>{r.count} {t('jobs', 'وظيفة')} · {new Date(r.saved_at).toLocaleString()}</small>
                  </button>
                  <button className="o-more" aria-label={t('Delete', 'حذف')} style={{ position: 'absolute', top: 8, insetInlineEnd: 8 }} onClick={() => deleteRun(r.id)}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          ) : <p className="o-note" style={{ marginTop: 6 }}>{t('Your past searches will appear here to reopen — same as Lead Finder and the other finders.', 'ستظهر عمليات بحثك السابقة هنا لإعادة فتحها — مثل البحث عن العملاء وباقي أدوات البحث.')}</p>}
        </div>
      </Card>
      {selected && <JobCard t={t} job={selected} onClose={() => setSelected(null)} onAdd={(j) => addToPipeline(j)} added={added.has(selected.id)} />}
    </>
  );
}

function ApplicationsPage({ t, ws }: { t: T; ws: WsSummary | null }) {
  const [js, setJs] = useState<JState | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [filter, setFilter] = useState<'all' | 'saved' | 'applied' | 'replied'>('all');
  const [compose, setCompose] = useState<{ subject: string; body: string } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'green' | 'coral'; text: string } | null>(null);
  const [prep, setPrep] = useState<{ percent: number; label: string } | null>(null);
  const prepRef = useRef<string | null>(null);
  const prepUn = useRef<UnlistenFn | null>(null);
  const load = async () => { try { setJs(await invoke<JState>('jobs_state')); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } };
  /* oxlint-disable react/react-compiler */
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (prepRef.current) void invoke('job_cancel', { jobId: prepRef.current }); prepUn.current?.(); }, []);
  /* oxlint-enable react/react-compiler */
  const startAutoPrep = async () => {
    const id = `autoprep-${Date.now()}`; prepRef.current = id; setMsg(null); setPrep({ percent: 0, label: t('Preparing…', 'جاري التحضير…') });
    prepUn.current = await listen<{ type: string; percent?: number; label?: string; tailored?: number; found?: number }>(`jobs://${id}`, (ev) => {
      const e = ev.payload;
      if (e.type === 'progress' || e.type === 'item' || e.type === 'start') setPrep({ percent: e.percent ?? 0, label: e.label || t('Preparing…', 'جاري التحضير…') });
      else if (e.type === 'done') { setPrep(null); prepRef.current = null; prepUn.current?.(); prepUn.current = null; void load(); setMsg({ tone: 'green', text: t(`Pipeline prepared — ${e.tailored ?? 0} résumés tailored, ${e.found ?? 0} contact emails found.`, `تم تحضير القائمة — ${e.tailored ?? 0} سيرة مخصّصة، ${e.found ?? 0} بريد تواصل.`) }); }
      else if (e.type === 'cancelled') { setPrep(null); prepRef.current = null; prepUn.current?.(); prepUn.current = null; void load(); }
    });
    try { await invoke('jobs_auto_prepare', { jobId: id }); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); setPrep(null); prepRef.current = null; }
  };
  const findEmail = (a: JApp) => act('email-' + a.id, async () => { setJs(await invoke<JState>('jobs_discover_contact', { id: a.id })); return t('Contact email discovered.', 'تم اكتشاف بريد التواصل.'); });
  const act = async (k: string, fn: () => Promise<string>) => { setBusy(k); setMsg(null); try { setMsg({ tone: 'green', text: await fn() }); await load(); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } finally { setBusy(''); } };
  const apps = js?.applications || [];
  const app = apps.find((a) => a.id === sel) || null;
  const setCfg = (max: number, days: number) => act('cfg', async () => { setJs(await invoke<JState>('jobs_set_settings', { followUpMax: max, followUpDays: days })); return t('Follow-up settings saved', 'تم حفظ إعدادات المتابعة'); });
  const hasResume = (ws?.workspace.profile.offer || '').length > 40;
  const nowIso = new Date().toISOString();
  const stats = { total: apps.length, applied: apps.filter((a) => a.applied_at).length, replied: apps.filter((a) => a.status === 'replied').length, due: apps.flatMap((a) => a.follow_ups.filter((f) => !f.done && f.at <= nowIso)).length };
  const matchFilter = (a: JApp) => filter === 'all' || (filter === 'saved' ? (a.status === 'saved' || a.status === 'tailored') : a.status === filter);
  const shownApps = apps.filter(matchFilter);
  const patchContact = (id: string, email: string) => { setJs((s) => s ? { ...s, applications: s.applications.map((y) => y.id === id ? { ...y, contact_email: email } : y) } : s); };
  const draftEmail = (a: JApp) => act('draft', async () => { const d = await invoke<{ subject: string; body: string }>('jobs_outreach_draft', { id: a.id }); setCompose(d); return t('Draft ready — review and send.', 'المسودة جاهزة — راجع وأرسل.'); });
  const sendEmail = (a: JApp) => act('send', async () => {
    if (!compose) throw new Error(t('Draft an email first.', 'اكتب مسودة أولاً.'));
    if (!a.contact_email || !a.contact_email.includes('@')) throw new Error(t('Add a contact email (the hiring/careers address).', 'أضف بريد التواصل (عنوان التوظيف).'));
    const resumeMd = a.tailored_resume?.trim() ? a.tailored_resume : (ws?.workspace.profile.offer || '');
    const nameSlug = (ws?.workspace.profile.name || 'resume').replace(/\s+/g, '_');
    const resumeBytes = resumeMd.trim() ? buildDocx(resumeMd) : new Uint8Array();
    const coverBytes = a.cover_letter?.trim() ? buildDocx(a.cover_letter) : new Uint8Array();
    setJs(await invoke<JState>('jobs_outreach_send', { id: a.id, subject: compose.subject, body: compose.body, resumeDocx: Array.from(resumeBytes), resumeName: `${nameSlug}_resume.docx`, coverDocx: Array.from(coverBytes), coverName: `${nameSlug}_cover_letter.docx` }));
    setCompose(null);
    return t(`Application sent to ${a.contact_email} with résumé + cover letter.`, `تم إرسال التقديم إلى ${a.contact_email} مع السيرة والخطاب.`);
  });
  return (
    <>
      <PageHead eyebrow={t('Application inbox', 'صندوق التقديمات')} title={t('Applications', 'التقديمات')} spark={false} sub={t('A WhatsApp-style inbox for your job outreach: draft, attach your résumé + cover letter, send, and track follow-ups per company.', 'صندوق يشبه واتساب لتواصل التوظيف: اكتب، أرفق سيرتك وخطابك، أرسل، وتابع لكل شركة.')} actions={<div className="o-flex">{apps.length > 0 && <Btn variant="ai" size="sm" icon={Sparkles} onClick={startAutoPrep} disabled={!!prep}>{prep ? t('Preparing…', 'جاري التحضير…') : t('Auto-prepare pipeline', 'تحضير القائمة تلقائياً')}</Btn>}<label className="o-flex" style={{ fontSize: 12 }}>{t('Follow-ups', 'متابعات')}<input className="o-input" style={{ height: 30, width: 50 }} type="number" min={0} max={5} defaultValue={js?.settings.follow_up_max ?? 2} onBlur={(e) => setCfg(Number(e.target.value) || 0, js?.settings.follow_up_days ?? 4)} /></label><label className="o-flex" style={{ fontSize: 12 }}>{t('every', 'كل')}<input className="o-input" style={{ height: 30, width: 50 }} type="number" min={1} defaultValue={js?.settings.follow_up_days ?? 4} onBlur={(e) => setCfg(js?.settings.follow_up_max ?? 2, Number(e.target.value) || 4)} />{t('days', 'يوم')}</label></div>} />
      {prep && <div className="o-loader"><div className="o-loader-head"><span className="o-spinner" /><b>{prep.percent}%</b><span className="o-loader-label">{t('Tailoring résumés + finding contact emails', 'تخصيص السير + إيجاد بريد التواصل')} · {prep.label}</span></div><div className="o-progress lg"><i style={{ width: `${prep.percent}%` }} /></div></div>}
      <div className="o-grid o-grid-4">
        <StatCard icon={Briefcase} label={t('In pipeline', 'في القائمة')} value={String(stats.total)} trend={null} tone="violet" />
        <StatCard icon={Send} label={t('Applied', 'تم التقديم')} value={String(stats.applied)} trend={null} tone="sky" />
        <StatCard icon={MessageSquare} label={t('Responses', 'ردود')} value={String(stats.replied)} trend={null} tone="green" />
        <StatCard icon={Clock} label={t('Follow-ups due', 'متابعات مستحقة')} value={String(stats.due)} trend={null} tone="orange" />
      </div>
      {msg && <div className={`o-result${msg.tone === 'coral' ? ' error' : ''}`}><Check size={16} />{msg.text}</div>}
      {!hasResume && <div className="o-result"><FileCheck size={16} />{t('Add your base résumé under Resume & ATS first, so it can be attached and tailored.', 'أضف سيرتك الأساسية تحت السيرة والـ ATS أولاً حتى تُرفق وتُخصّص.')}</div>}
      {apps.length ? (
        <div className="o-chat" style={{ height: 'calc(100vh - 320px)' }}>
          <aside className="o-chat-list">
            <div className="o-seg" style={{ margin: '10px', width: 'calc(100% - 20px)' }}>
              {(['all', 'saved', 'applied', 'replied'] as const).map((f) => <button key={f} className={filter === f ? 'active' : ''} style={{ flex: 1 }} onClick={() => setFilter(f)}>{f === 'all' ? t('All', 'الكل') : f === 'saved' ? t('New', 'جديد') : f === 'applied' ? t('Applied', 'مُقدَّم') : t('Replied', 'ردّ')}</button>)}
            </div>
            <div className="o-chat-items">
              {shownApps.map((x) => {
                const last = x.messages && x.messages.length ? x.messages[x.messages.length - 1] : null;
                return (
                  <button key={x.id} className={`o-chat-item${sel === x.id ? ' active' : ''}`} onClick={() => { setSel(x.id); setCompose(null); }}>
                    <div className="o-avatar">{(x.company || x.role)[0]?.toUpperCase()}</div>
                    <div className="o-chat-item-body"><div className="o-between"><b>{x.role}</b><Chip tone={x.status === 'replied' ? 'green' : x.status === 'applied' ? 'violet' : x.status === 'tailored' ? 'sky' : 'neutral'}>{x.status}</Chip></div><span className="o-chat-snippet">{last ? `↗ ${last.subject}` : `${x.company || x.source} · ${x.location || x.country}`}</span></div>
                  </button>
                );
              })}
              {!shownApps.length && <div className="o-muted" style={{ padding: 16, fontSize: 12 }}>{t('No applications in this filter.', 'لا توجد تقديمات في هذا التصفية.')}</div>}
            </div>
          </aside>
          <section className="o-chat-pane" style={{ overflow: 'auto', padding: 18 }}>
            {app ? (
              <>
                <div className="o-between" style={{ flexWrap: 'wrap' }}>
                  <div><h2 style={{ fontSize: 18 }}>{app.role}</h2><small className="o-muted">{app.company || app.source} · {app.location || app.country} · <a href={app.url} target="_blank" rel="noreferrer">{t('view posting', 'عرض الإعلان')}</a></small></div>
                  <div className="o-flex">
                    <Btn variant="ai" size="sm" icon={Sparkles} onClick={() => act('tailor-' + app.id, async () => { setJs(await invoke<JState>('jobs_tailor', { id: app.id })); return t('Résumé + cover letter tailored to this job.', 'تم تخصيص السيرة وخطاب التغطية لهذه الوظيفة.'); })} disabled={!!busy}>{busy === 'tailor-' + app.id ? t('Tailoring…', 'جاري التخصيص…') : t('Tailor', 'خصّص')}</Btn>
                    {app.status === 'applied' && <Btn size="sm" variant="secondary" onClick={() => act('replied', async () => { setJs(await invoke<JState>('jobs_application_update', { id: app.id, patch: { status: 'replied' } })); return t('Marked as responded', 'تم التعليم كرد'); })}>{t('Got a response', 'وصل رد')}</Btn>}
                    <button className="o-more" aria-label="Delete" onClick={() => act('del', async () => { setJs(await invoke<JState>('jobs_application_delete', { id: app.id })); setSel(null); return t('Removed', 'تمت الإزالة'); })}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="o-flex o-mt" style={{ alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                  <label className="o-field" style={{ flex: 1, minWidth: 260 }}>{t('Contact email (hiring / careers address)', 'بريد التواصل (عنوان التوظيف)')}<input type="email" value={app.contact_email || ''} onChange={(e) => patchContact(app.id, e.target.value)} onBlur={(e) => void invoke('jobs_application_update', { id: app.id, patch: { contact_email: e.target.value } })} placeholder="careers@company.com" /></label>
                  <Btn variant="secondary" size="sm" icon={Search} onClick={() => findEmail(app)} disabled={!!busy}>{busy === 'email-' + app.id ? t('Searching…', 'جاري البحث…') : t('Find email', 'ابحث عن البريد')}</Btn>
                </div>
                {app.follow_ups.length > 0 && <div className="o-flex o-mt" style={{ flexWrap: 'wrap' }}>{app.follow_ups.map((f, i) => <Chip key={i} tone={f.done ? 'green' : f.at <= nowIso ? 'orange' : 'neutral'}>{t(`Follow-up ${i + 1}`, `متابعة ${i + 1}`)} · {new Date(f.at).toLocaleDateString()}{f.done ? ' ✓' : ''}</Chip>)}</div>}
                <div className="o-appthread o-mt">
                  {(app.messages || []).length ? (app.messages || []).map((m) => (
                    <div key={m.id} className={`o-appmsg ${m.direction}`}>
                      <b>{m.subject}</b>
                      <div className="o-appmsg-body">{m.body}</div>
                      {m.attachments?.length > 0 && <div className="o-flex" style={{ flexWrap: 'wrap', marginTop: 6 }}>{m.attachments.map((n) => <Chip key={n} tone="sky"><FileText size={11} /> {n}</Chip>)}</div>}
                      <small className="o-muted">{new Date(m.at).toLocaleString()}</small>
                    </div>
                  )) : <EmptyState icon={Send} title={t('No emails sent yet', 'لم تُرسل رسائل بعد')} text={t('Draft an application email below — your résumé and cover letter attach automatically.', 'اكتب رسالة تقديم بالأسفل — تُرفق سيرتك وخطابك تلقائياً.')} />}
                </div>
                {compose ? (
                  <div className="o-compose o-mt">
                    <input className="o-input" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} placeholder={t('Subject', 'الموضوع')} />
                    <textarea className="o-input" rows={7} value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} placeholder={t('Email body…', 'نص الرسالة…')} />
                    <div className="o-between">
                      <small className="o-muted"><FileText size={12} /> {t('Attaches: résumé' + (app.cover_letter?.trim() ? ' + cover letter' : ''), 'يُرفق: السيرة' + (app.cover_letter?.trim() ? ' + الخطاب' : ''))} (.docx)</small>
                      <div className="o-flex"><Btn variant="ghost" size="sm" onClick={() => setCompose(null)}>{t('Discard', 'تجاهل')}</Btn><Btn size="sm" icon={Send} onClick={() => sendEmail(app)} disabled={!!busy}>{busy === 'send' ? t('Sending…', 'جاري الإرسال…') : t('Send with attachments', 'أرسل مع المرفقات')}</Btn></div>
                    </div>
                  </div>
                ) : (
                  <div className="o-flex o-mt">
                    <Btn variant="ai" icon={Mail} onClick={() => draftEmail(app)} disabled={!!busy}>{busy === 'draft' ? t('Drafting…', 'جاري الكتابة…') : t('Draft application email', 'اكتب رسالة التقديم')}</Btn>
                  </div>
                )}
                <div className="o-grid o-grid-2 o-mt">
                  <Card><CardHead title={t('Tailored résumé', 'السيرة المخصصة')} action={app.tailored_resume ? <Btn variant="ghost" size="sm" icon={Copy} onClick={() => navigator.clipboard.writeText(app.tailored_resume)}>{t('Copy', 'نسخ')}</Btn> : undefined} />{app.tailored_resume ? <Md text={app.tailored_resume} /> : <EmptyState icon={FileText} title={t('Using your base résumé', 'يُستخدم السيرة الأساسية')} text={t('Click Tailor to customize for this job.', 'اضغط خصّص للتخصيص لهذه الوظيفة.')} />}</Card>
                  <Card><CardHead title={t('Cover letter', 'خطاب التغطية')} action={app.cover_letter ? <Btn variant="ghost" size="sm" icon={Copy} onClick={() => navigator.clipboard.writeText(app.cover_letter)}>{t('Copy', 'نسخ')}</Btn> : undefined} />{app.cover_letter ? <div className="o-md" style={{ whiteSpace: 'pre-wrap' }}>{app.cover_letter}</div> : <EmptyState icon={FileText} title={t('No cover letter yet', 'لا يوجد خطاب بعد')} text={t('Tailor to generate one.', 'خصّص لتوليده.')} />}</Card>
                </div>
              </>
            ) : <EmptyState icon={Briefcase} title={t('Pick an application', 'اختر تقديماً')} text="" />}
          </section>
        </div>
      ) : <Card><EmptyState icon={Briefcase} title={t('No applications yet', 'لا توجد تقديمات بعد')} text={t('Go to Find Jobs, select postings and add them to your pipeline.', 'اذهب لابحث عن وظائف، اختر إعلانات وأضفها لقائمتك.')} /></Card>}
    </>
  );
}

type LogEntry = { id: string; at: string; level: string; kind: string; message: string };
function LogCenterPage({ t }: { t: T }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<{ forward_url: string; forward_enabled: boolean; count: number }>({ forward_url: '', forward_enabled: false, count: 0 });
  const [ev, setEv] = useState<{ url: string; enabled: boolean; target: string; forward_logs: boolean; has_secret: boolean; pending: number; sent: number }>({ url: '', enabled: false, target: 'url', forward_logs: false, has_secret: false, pending: 0, sent: 0 });
  const [level, setLevel] = useState<'all' | 'info' | 'success' | 'warn' | 'error'>('all');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: 'green' | 'coral'; text: string } | null>(null);
  const load = async () => { try { const [e, s, ev2] = await Promise.all([invoke<LogEntry[]>('log_center_list', { limit: 500 }), invoke<{ forward_url: string; forward_enabled: boolean; count: number }>('log_center_status'), invoke<typeof ev>('events_status')]); setEntries(e); setStatus(s); setEv(ev2); } catch (e) { setMsg({ tone: 'coral', text: String(e) }); } };
  /* oxlint-disable react/react-compiler */
  useEffect(() => { void load(); const id = window.setInterval(() => { void load(); }, 15000); return () => window.clearInterval(id); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* oxlint-enable react/react-compiler */
  const clear = () => { if (!window.confirm(t('Clear all log entries?', 'مسح كل السجلات؟'))) return; void invoke('log_center_clear').then(load); };
  const shown = entries.filter((e) => level === 'all' || e.level === level);
  const tone = (l: string): Tone => l === 'error' ? 'coral' : l === 'warn' ? 'orange' : l === 'success' ? 'green' : 'neutral';
  const forwarding = ev.enabled && ev.target === 'racore';
  return (
    <>
      <PageHead eyebrow={t('Everything the app does', 'كل ما يفعله التطبيق')} title={t('Log Center', 'مركز السجلات')} sub={t('One live stream of every event — searches, sends, follow-ups, bounces, errors. Streamed to the Racore analytics endpoint automatically.', 'دفق حيّ لكل حدث — عمليات بحث، إرسال، متابعات، ارتدادات، أخطاء. يُرسَل إلى تحليلات Racore تلقائياً.')} actions={<div className="o-flex"><Btn variant="secondary" size="sm" icon={RefreshCw} onClick={load}>{t('Refresh', 'تحديث')}</Btn><Btn variant="ghost" size="sm" icon={Trash2} onClick={clear}>{t('Clear', 'مسح')}</Btn></div>} />
      {msg && <div className={`o-result${msg.tone === 'coral' ? ' error' : ''}`}><Check size={16} /><span style={{ wordBreak: 'break-all' }}>{msg.text}</span></div>}
      <div className="o-grid o-grid-4">
        <StatCard icon={Shield} label={t('Issues', 'مشاكل')} value={String(entries.filter((e) => e.level === 'error').length)} trend={null} tone="coral" />
        <StatCard icon={Zap} label={t('Warnings', 'تحذيرات')} value={String(entries.filter((e) => e.level === 'warn').length)} trend={null} tone="orange" />
        <StatCard icon={Check} label={t('Successful', 'ناجحة')} value={String(entries.filter((e) => e.level === 'success').length)} trend={null} tone="green" />
        <StatCard icon={Activity} label={t('Total events', 'إجمالي الأحداث')} value={String(status.count)} trend={null} tone="violet" />
      </div>
      {entries.some((e) => e.level === 'error') && level !== 'error' && <button className="o-result error" style={{ width: '100%', textAlign: 'start', cursor: 'pointer' }} onClick={() => setLevel('error')}><Shield size={16} />{t(`${entries.filter((e) => e.level === 'error').length} issue(s) need attention — click to view only errors.`, `${entries.filter((e) => e.level === 'error').length} مشكلة تحتاج انتباه — اضغط لعرض الأخطاء فقط.`)}</button>}
      <Card>
        <CardHead title={t('Automatic forwarding', 'توجيه تلقائي')} sub={t('Logs and events are sent to the Racore endpoint by the app — nothing to set up.', 'تُرسَل السجلات والأحداث إلى نقطة Racore بواسطة التطبيق — لا شيء لإعداده.')} action={<span className={`o-dot ${forwarding ? 'green' : 'neutral'}`} title={forwarding ? 'On' : 'Starting'} />} />
        <div className="o-facts-row"><span>{t('Destination', 'الوجهة')}</span><b>api.racore.xyz/webhooks/desktop</b></div>
        <div className="o-facts-row"><span>{t('Status', 'الحالة')}</span><b>{forwarding ? t('Active', 'مفعّل') : t('Starting…', 'جارٍ التشغيل…')}</b></div>
        <div className="o-facts-row"><span>{t('Queued / sent', 'بالانتظار / مُرسل')}</span><b>{ev.pending} / {ev.sent}</b></div>
      </Card>
      <Card>
        <CardHead title={t(`${shown.length} events`, `${shown.length} حدث`)} action={<div className="o-seg">{(['all', 'info', 'success', 'warn', 'error'] as const).map((l) => <button key={l} className={level === l ? 'active' : ''} onClick={() => setLevel(l)}>{l === 'all' ? t('All', 'الكل') : l}</button>)}</div>} />
        {shown.length ? (
          <div className="o-logs">
            {shown.map((e) => (
              <div key={e.id} className="o-logline">
                <span className="o-log-time">{new Date(e.at).toLocaleString()}</span>
                <Chip tone={tone(e.level)}>{e.level}</Chip>
                <span className="o-log-kind">{e.kind}</span>
                <span className="o-log-msg">{e.message}</span>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={Activity} title={t('No events yet', 'لا أحداث بعد')} text={t('Use the app — searches, sends and follow-ups stream in here.', 'استخدم التطبيق — عمليات البحث والإرسال والمتابعات تتدفق هنا.')} />}
      </Card>
    </>
  );
}

function JobMapPage({ t }: { t: T }) {
  const [demand, setDemand] = useState<{ country: string; count: number; lat: number; lon: number }[]>([]);
  const [runs, setRuns] = useState<RunMeta[]>([]);
  /* oxlint-disable react/react-compiler */
  useEffect(() => {
    void invoke<JState>('jobs_state').then((s) => {
      const by = new Map<string, number>();
      const LL: Record<string, [number, number]> = { Egypt: [26.8, 30.8], 'Saudi Arabia': [23.9, 45.1], 'United Arab Emirates': [23.4, 53.8], Qatar: [25.3, 51.2], Kuwait: [29.3, 47.5], Bahrain: [26, 50.5], Oman: [21.5, 55.9], Jordan: [31.2, 36.5], Morocco: [31.8, -7.1], 'United Kingdom': [55.4, -3.4], Germany: [51.2, 10.5], France: [46.2, 2.2], Netherlands: [52.1, 5.3], 'United States': [37.1, -95.7], Canada: [56.1, -106.3], India: [20.6, 78.9], Singapore: [1.35, 103.8], Remote: [0, 0] };
      s.applications.forEach((a) => by.set(a.country, (by.get(a.country) || 0) + 1));
      setDemand([...by.entries()].map(([country, count]) => ({ country, count, lat: (LL[country] || [0, 0])[0], lon: (LL[country] || [0, 0])[1] })).sort((x, y) => y.count - x.count));
    }).catch(() => undefined);
    void invoke<RunMeta[]>('run_list').then((r) => setRuns(r.filter((x) => x.query))).catch(() => undefined);
  }, []);
  /* oxlint-enable react/react-compiler */
  return (
    <>
      <PageHead eyebrow={t('Global hiring demand', 'الطلب العالمي على التوظيف')} title={t('Job Map', 'خريطة الوظائف')} spark={false} sub={t('Hiring hotspots from your pipeline and searches. Bigger, warmer circles mean more openings.', 'بؤر التوظيف من قائمتك وأبحاثك. الدوائر الأكبر والأدفأ تعني وظائف أكثر.')} />
      <Card><WorldDemandMap t={t} demand={demand} /></Card>
      <div className="o-grid o-grid-2">
        <Card><CardHead title={t('Top countries', 'أعلى الدول')} />{demand.length ? demand.filter((d) => d.country !== 'Unknown').slice(0, 10).map((d) => <Row key={d.country} icon={MapPin} title={d.country} meta={t(`${d.count} in your pipeline`, `${d.count} في قائمتك`)} right={<Chip tone="violet">{d.count}</Chip>} />) : <EmptyState icon={Globe2} title={t('No data yet', 'لا توجد بيانات بعد')} text={t('Add jobs to your pipeline to populate the map.', 'أضف وظائف لقائمتك لملء الخريطة.')} />}</Card>
        <Card><CardHead title={t('Recent searches', 'أحدث عمليات البحث')} />{runs.slice(0, 8).map((r) => <Row key={r.id} icon={Briefcase} title={r.query} meta={`${r.count} · ${new Date(r.saved_at).toLocaleDateString()}`} />)}{!runs.length && <EmptyState icon={Search} title={t('No searches yet', 'لا يوجد بحث بعد')} text="" />}</Card>
      </div>
    </>
  );
}
