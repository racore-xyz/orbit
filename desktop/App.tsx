import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { siAnthropic, siGooglegemini, siMistralai, siOpenrouter } from 'simple-icons';
import { Activity, BarChart3, Bot, Check, ChevronRight, Compass, Copy, Download, ExternalLink, History, Inbox, KeyRound, Mail, MessageSquare, Plug, RefreshCw, Search, Send, Settings2, Shield, Sparkles, Target, Trash2, Users, X, Zap } from 'lucide-react';
import {
  AppShell,
  Btn,
  Card,
  CardHead,
  Chip,
  EmptyState,
  IconTile,
  LangToggle,
  Brand,
  ModuleHero,
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

export default function DesktopApp() {
  const { dark, toggleDark, lang, toggleLang, rtl, t } = useTheme();
  const [tab, setTab] = useState(0);
  const [ws, setWs] = useState<WsSummary | null>(null);
  const reloadWs = async () => { try { setWs(await invoke<WsSummary>('workspace_get')); } catch { /* first run */ } };
  /* oxlint-disable react/react-compiler -- load the workspace once; refresh when the tab changes */
  useEffect(() => { void reloadWs(); }, [tab]);
  /* oxlint-enable react/react-compiler */
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [guideStep, setGuideStep] = useState(0);
  const [guideHidden, setGuideHidden] = useState(false);
  const endDemo = async () => { try { await invoke('workspace_demo_clear'); } finally { setGuideHidden(true); setGuideStep(0); setTab(0); await reloadWs(); } };
  const openSavedRun = (id: string, mode: string) => { setOpenRun(id); setTab(mode === 'research' ? 5 : 1); };
  const [outreachSeed, setOutreachSeed] = useState<Lead[] | null>(null);
  const sendToOutreach = (leads: Lead[]) => { setOutreachSeed(leads); setTab(4); };
  const [agentic, setAgentic] = useState(() => localStorage.getItem('orbit.agenticMode') !== 'off');
  const [connected, setConnected] = useState<string[]>(() => JSON.parse(localStorage.getItem('orbit.connected') || '[]'));

  const groups: NavGroup[] = [
    {
      label: t('Workspace', 'مساحة العمل'),
      items: [
        { label: t('Dashboard', 'لوحة التحكم'), icon: BarChart3 },
        { label: t('Lead Finder', 'البحث عن العملاء'), icon: Search },
        { label: t('CRM', 'إدارة العملاء'), icon: Users },
        { label: t('Campaigns', 'الحملات'), icon: Send },
        { label: t('Outreach', 'التواصل'), icon: MessageSquare },
        { label: t('Market Research', 'أبحاث السوق'), icon: Compass },
        { label: t('AI Agents', 'وكلاء الذكاء الاصطناعي'), icon: Bot },
        { label: t('Integrations', 'التكاملات'), icon: Plug },
        { label: t('History', 'سجل البحث'), icon: History },
      ],
    },
    { label: t('System', 'النظام'), items: [{ label: t('Settings', 'الإعدادات'), icon: Settings2 }] },
  ];

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
      aiLabel={t('Get AI Insight', 'رؤية ذكية')}
      onAi={() => setTab(6)}
    >
      {tab === 0 && <Dashboard t={t} go={setTab} ws={ws} />}
      {tab === 1 && <LeadFinder t={t} openRunId={openRun} onOpened={() => setOpenRun(null)} onOutreach={sendToOutreach} />}
      {tab === 2 && <Module t={t} title={t('CRM', 'إدارة العملاء')} icon={Users} action={t('Add contact', 'إضافة جهة اتصال')} />}
      {tab === 3 && <Module t={t} title={t('Campaigns', 'الحملات')} icon={Send} action={t('Create campaign', 'إنشاء حملة')} />}
      {tab === 4 && <Outreach t={t} seed={outreachSeed} onSeeded={() => setOutreachSeed(null)} />}
      {tab === 5 && <LeadFinder t={t} mode="research" openRunId={openRun} onOpened={() => setOpenRun(null)} onOutreach={sendToOutreach} />}
      {tab === 6 && <Agents t={t} agentic={agentic} setAgentic={(v) => { setAgentic(v); localStorage.setItem('orbit.agenticMode', v ? 'on' : 'off'); }} />}
      {tab === 7 && <Integrations t={t} connected={connected} setConnected={setConnected} />}
      {tab === 8 && <HistoryPage t={t} onOpen={openSavedRun} />}
      {tab === 9 && <WorkspacePage t={t} ws={ws} reload={reloadWs} />}
    </AppShell>
      {ws && !ws.workspace.onboarding.completed && <Onboarding t={t} ws={ws} done={reloadWs} />}
      {ws?.workspace.onboarding.completed && ws.workspace.demo && !guideHidden && <Guide t={t} step={guideStep} setStep={setGuideStep} go={setTab} openRun={(id) => setOpenRun(id)} finish={endDemo} hide={() => setGuideHidden(true)} />}
      {ws?.workspace.demo && <div className="o-demo-bar"><Sparkles size={14} /> <b>{t('Demo mode', 'وضع التجربة')}</b> {t('Sample data is loaded so you can see every module working. It is removed the moment you finish the tour.', 'بيانات تجريبية محمّلة لترى كل الوحدات تعمل. تُحذف فور إنهاء الجولة.')} {guideHidden && <button onClick={() => { setGuideHidden(false); }}>{t('Resume tour', 'استئناف الجولة')}</button>}<button className="primary" onClick={endDemo}>{t('I understand, let’s start', 'فهمت كل شيء، هيا لنبدأ')}</button></div>}
    </>
  );
}

function Dashboard({ t, go, ws }: { t: T; go: (i: number) => void; ws: WsSummary | null }) {
  const p = ws?.progress;
  const name = ws?.workspace.profile.name?.split(' ')[0];
  const goFor: Record<string, number> = { profile: 9, email: 7, inbox: 7, llm: 6, style: 4, leads: 1, research: 5, outreach: 4, reply: 4 };
  return (
    <>
      <PageHead
        title={name ? t(`Welcome back, ${name}!`, `مرحباً بعودتك، ${name}!`) : t('Welcome back!', 'مرحباً بعودتك!')}
        spark={false}
        sub={ws ? t(`${ws.workspace.profile.company || 'Your workspace'} · ${p?.percent}% set up · ${p?.leads_total.toLocaleString()} leads · ${p?.sent} emails sent`, `${ws.workspace.profile.company || 'مساحتك'} · ${p?.percent}% مكتمل · ${p?.leads_total.toLocaleString()} عميل · ${p?.sent} رسالة مرسلة`) : t("Here's what's happening in your workspace today.", 'إليك ما يحدث في مساحة عملك اليوم.')}
        actions={
          <>
            <Btn variant="secondary" onClick={() => go(1)}>{t('Find leads', 'ابحث عن عملاء')}</Btn>
            <Btn icon={MessageSquare} onClick={() => go(4)}>{t('Open Outreach', 'فتح التواصل')}</Btn>
          </>
        }
      />
      <div className="o-grid o-grid-4">
        <StatCard icon={Users} label={t('Leads collected', 'العملاء المجمّعون')} value={(p?.leads_total || 0).toLocaleString()} trend={null} tone="violet" />
        <StatCard icon={Compass} label={t('Research runs', 'عمليات بحث')} value={String(p?.runs || 0)} trend={null} tone="sky" />
        <StatCard icon={Send} label={t('Emails sent', 'رسائل مرسلة')} value={String(p?.sent || 0)} trend={null} tone="orange" />
        <StatCard icon={MessageSquare} label={t('Replies', 'ردود')} value={String(p?.replied || 0)} trend={null} tone="green" />
      </div>
      <div className="o-grid o-grid-main">
        <Card>
          <CardHead title={t('Getting started', 'البدء')} sub={t('Your workspace progress. Everything here is saved on this machine.', 'تقدم مساحة عملك. كل شيء هنا محفوظ على هذا الجهاز.')} action={<Chip tone={p && p.percent === 100 ? 'green' : 'violet'} pill>{p?.percent ?? 0}%</Chip>} />
          <Progress value={p?.percent ?? 0} />
          <div className="o-mt">
            {(p?.checklist || []).map((c) => (
              <button key={c.id} className={`o-check${c.done ? ' done' : ''}`} onClick={() => go(goFor[c.id] ?? 0)}>
                <i>{c.done ? '✓' : ''}</i><span>{c.label}</span><ChevronRight size={14} />
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <CardHead title={t('Outreach pipeline', 'خط التواصل')} sub={t('Live from your conversations', 'مباشر من محادثاتك')} action={<ViewAll label={t('Open', 'فتح')} onClick={() => go(4)} />} />
          <Tile title={t('Contacts', 'جهات الاتصال')} big={String(p?.contacts || 0)} left={t(`${p?.drafts || 0} drafts`, `${p?.drafts || 0} مسودة`)} right={t(`${p?.sent || 0} sent`, `${p?.sent || 0} مُرسل`)} progress={p?.contacts ? ((p.sent || 0) / p.contacts) * 100 : 0} />
          <Tile title={t('Follow-ups', 'المتابعات')} big={String(p?.followups || 0)} left={t(`${p?.replied || 0} replied`, `${p?.replied || 0} ردّوا`)} right={p?.style_learned ? t('style learned', 'الأسلوب مُتعلَّم') : t('style not learned', 'الأسلوب غير مُتعلَّم')} progress={p?.sent ? ((p.replied || 0) / p.sent) * 100 : 0} />
        </Card>
        <Card>
          <CardHead title={t('Recent activity', 'النشاط الأخير')} action={<ViewAll label={t('All', 'الكل')} onClick={() => go(9)} />} />
          {ws?.workspace.activity.length ? ws.workspace.activity.slice(-6).reverse().map((x, i) => (
            <Row key={i} icon={x.kind === 'outreach' ? Send : x.kind === 'research' ? Compass : x.kind === 'integration' ? Plug : Activity} title={x.text} meta={new Date(x.at).toLocaleString()} />
          )) : <EmptyState icon={Activity} title={t('No activity yet', 'لا يوجد نشاط بعد')} text={t('Runs, sends, replies and connections show up here.', 'عمليات البحث والإرسال والردود والاتصالات تظهر هنا.')} />}
        </Card>
      </div>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Module({ t, title, icon, action }: { t: T; title: string; icon: any; action: string }) {
  const [message, setMessage] = useState('');
  return (
    <>
      <PageHead eyebrow={t('Workspace module', 'وحدة مساحة العمل')} title={title} sub={t('This module starts empty until you connect a source or add a record.', 'تبدأ هذه الوحدة فارغة حتى تربط مصدراً أو تضيف سجلاً.')} actions={<Btn icon={Zap} onClick={() => setMessage(t(`${action} is ready. Connect a source to create real records.`, `${action} جاهز. اربط مصدرًا لإنشاء سجلات حقيقية.`))}>{action}</Btn>} />
      {message && <div className="o-result"><Check size={16} />{message}</div>}
      <ModuleHero icon={icon} title={t('No records yet', 'لا توجد سجلات بعد')} text={t('Real data will appear here after a connected source returns results.', 'ستظهر البيانات الحقيقية هنا بعد أن يعيد مصدر متصل نتائج.')} />
      <div className="o-grid o-grid-3">
        <StatCard icon={Activity} label={t('Active workflows', 'سير العمل النشط')} value="0" trend={null} tone="violet" />
        <StatCard icon={Check} label={t('Completed today', 'المكتمل اليوم')} value="0" trend={null} tone="green" />
        <StatCard icon={Users} label={t('Records synced', 'السجلات المتزامنة')} value="0" trend={null} tone="sky" />
      </div>
    </>
  );
}



type LlmStatus = { default: { provider?: string | null; model?: string | null }; providers: { id: string; name: string; models: string[]; docs: string; configured: boolean }[] };

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
              <div className="o-provider-logo">{icon ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icon.path} fill="currentColor" /></svg> : <span>{p.name[0]}</span>}</div>
              <div>
                <h2>{p.name}</h2>
                <p>{p.models.join(' · ')}</p>
                <small><a href={p.docs} target="_blank" rel="noreferrer">{t('Get API key', 'احصل على مفتاح')}</a></small>
              </div>
              <Chip tone={p.configured ? 'green' : 'neutral'} pill>{p.configured ? t('Key saved', 'المفتاح محفوظ') : t('No key', 'بدون مفتاح')}</Chip>
              <div className="o-llm-key">
                <input className="o-input" style={{ height: 34, flex: 1, minWidth: 0 }} type="password" value={keys[p.id] || ''} onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })} placeholder={p.configured ? t('(stored · paste to replace)', '(محفوظ · الصق للاستبدال)') : 'API key'} />
                <Btn size="sm" disabled={!!busy || !(keys[p.id] || '').trim()} onClick={() => act(p.id, async () => { await invoke('llm_set_key', { provider: p.id, key: keys[p.id] }); setKeys({ ...keys, [p.id]: '' }); return t(`${p.name} key saved to the credential store`, `تم حفظ مفتاح ${p.name} في مخزن الاعتماد`); })}>{t('Save', 'حفظ')}</Btn>
                {p.configured && <Btn size="sm" variant="secondary" disabled={!!busy} onClick={() => act(p.id + '-test', async () => { const r = await invoke<string>('llm_test', { provider: p.id }); return `${p.name}: ${r}`; })}>{busy === p.id + '-test' ? '…' : t('Test', 'اختبار')}</Btn>}
                {p.configured && <Btn size="sm" variant="ghost" disabled={!!busy} onClick={() => act(p.id + '-rm', async () => { await invoke('llm_set_key', { provider: p.id, key: '' }); return t('Key removed', 'تمت إزالة المفتاح'); })}>{t('Remove', 'إزالة')}</Btn>}
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
  config_path: string;
};

function Integrations({ t, setConnected }: { t: T; connected: string[]; setConnected: (x: string[]) => void }) {
  const [st, setSt] = useState<IntStatus | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: 'green' | 'coral'; text: string } | null>(null);
  const [reach, setReach] = useState<{ ready: boolean; checks: { id: string; label: string; ok: boolean; required: boolean; detail?: string; fix?: string }[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [g, setG] = useState({ address: '', app_password: '', test_to: '' });
  const [s, setS] = useState({ host: '', port: '587', username: '', password: '', from: '', security: 'starttls', test_to: '' });
  const [w, setW] = useState({ url: '', secret: '', shown: '' });
  const [im, setIm] = useState({ host: '', port: '993', username: '', password: '' });

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
                {reach ? reach.checks.map((k) => (
                  <div key={k.id} className="o-row">
                    <Chip tone={k.ok ? 'green' : k.required ? 'coral' : 'neutral'}>{k.ok ? 'OK' : k.required ? t('Missing', 'مفقود') : t('Optional', 'اختياري')}</Chip>
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
        if (e.fatal) { setError(e.error || 'failed'); setBusy(null); stopListening(); }
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
        {history.length > 0 && (
          <div className="o-history">
            <div className="o-between"><b><History size={14} /> {t('Saved runs', 'عمليات محفوظة')}</b><span className="o-muted" style={{ fontSize: 11 }}>{history.length}</span></div>
            <div className="o-history-list">
              {history.slice(0, 8).map((r) => (
                <button key={r.id} className={`o-history-item${r.id === runId ? ' active' : ''}`} onClick={() => openRun(r.id)}>
                  <b>{r.query}</b>
                  <small>{r.count} {t('records', 'سجل')} · {new Date(r.saved_at).toLocaleString()}{r.enriched ? ' · ✓' : ''}</small>
                </button>
              ))}
            </div>
          </div>
        )}
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
                <td><Chip tone={r.mode === 'research' ? 'orange' : 'violet'}>{r.mode === 'research' ? t('Market Research', 'أبحاث السوق') : t('Lead Finder', 'البحث عن العملاء')}</Chip></td>
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

type OMsg = { id: string; direction: 'out' | 'in'; subject: string; body: string; at: string; provider?: string | null; step: number; external_id?: string | null };
type OThread = { id: string; lead_id?: string | null; name: string; company?: string | null; email: string; status: string; messages: OMsg[]; followup_count: number; max_followups: number; interval_days: number; next_followup_at?: string | null; last_activity: string; sequence_id?: string | null; lead?: Lead | null; notes?: string | null; unread: boolean };
type OStep = { delay_days: number; subject: string; body: string };
type OState = { threads: OThread[]; sequences: { id: string; name: string; steps: OStep[] }[]; style: { samples: string[]; guide: string; signature: string; learned: { draft: string; final_text: string; at: string }[]; language: string }; settings: { send_via: string; auto_followup: boolean; default_max_followups: number; default_interval_days: number }; updated_at: string };

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
  const [panel, setPanel] = useState<'none' | 'style' | 'sequence' | 'lead'>('none');
  const [samples, setSamples] = useState<string[]>(['', '', '']);
  const [signature, setSignature] = useState('');
  const [lang, setLang] = useState('en');
  const [autoTimer, setAutoTimer] = useState<number | null>(null);

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
  const draft = (x: OThread, step = nextStep(x)) => act('draft', async () => { const d = await invoke<{ subject: string; body: string }>('outreach_draft', { threadId: x.id, step }); setSubject(d.subject); setBody(d.body); setDraftRef(d.body); return t(`Draft for step ${step} ready in your style. Edit freely, the model learns from your changes.`, `المسودة للخطوة ${step} جاهزة بأسلوبك. عدّل بحرية، النموذج يتعلم من تعديلاتك.`); });
  const send = (x: OThread) => act('send', async () => {
    if (!subject.trim() || !body.trim()) throw new Error(t('Subject and body are required', 'العنوان والمحتوى مطلوبان'));
    const step = nextStep(x);
    if (draftRef) await invoke('outreach_record_edit', { draft: draftRef, finalText: body });
    await invoke<OThread>('outreach_send', { threadId: x.id, subject, body, step });
    setSubject(''); setBody(''); setDraftRef('');
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
    await load();
    return t(`${n} follow-ups sent`, `تم إرسال ${n} متابعة`);
  });
  const sync = () => act('sync', async () => { const r = await invoke<{ found: number; errors: string[] }>('outreach_sync'); await load(); if (r.found) void invoke('workspace_log', { kind: 'outreach', text: `${r.found} new replies synced from inbox` }); return t(`${r.found} new replies${r.errors.length ? ` · ${r.errors[0]}` : ''}`, `${r.found} رد جديد${r.errors.length ? ` · ${r.errors[0]}` : ''}`); });
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
            <Btn size="sm" icon={Send} onClick={sendDue} disabled={!!busy || !counts.due}>{busy === 'due' ? t('Sending…', 'جاري الإرسال…') : t(`Send due follow-ups (${counts.due})`, `إرسال المتابعات المستحقة (${counts.due})`)}</Btn>
            <Btn variant="secondary" size="sm" icon={Sparkles} onClick={() => setPanel(panel === 'style' ? 'none' : 'style')}>{t('My writing style', 'أسلوبي في الكتابة')}</Btn>
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
          <label className="o-flex" style={{ fontSize: 12 }}>{t('Auto follow-ups', 'متابعة تلقائية')} <Switch on={!!st?.settings.auto_followup} onChange={(v) => setSettings({ auto_followup: v })} label="Auto follow-ups" /></label>
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
                <button key={x.id} className={`o-chat-item${sel === x.id ? ' active' : ''}${x.unread ? ' unread' : ''}`} onClick={() => { setSel(x.id); setSubject(''); setBody(''); setDraftRef(''); if (x.unread) update({ unread: false }); }}>
                  <div className={`o-lead-avatar person`}>{x.lead?.photo ? <img src={x.lead.photo} alt="" /> : null}<span>{(x.name || x.email).split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span></div>
                  <div className="o-chat-item-body">
                    <div className="o-between"><b>{x.name}</b><small>{last ? new Date(last.at).toLocaleDateString() : ''}</small></div>
                    <div className="o-between"><span className="o-chat-snippet">{last ? `${last.direction === 'out' ? '↗ ' : '↙ '}${last.subject || last.body}` : x.company || x.email}</span><span className={`o-dot ${isDue(x) ? 'orange' : STATUS_TONE[x.status] || 'neutral'}`} title={x.status} /></div>
                    <small className="o-muted">{x.company || x.email} · {t('step', 'خطوة')} {Math.min(nextStep(x) - 1, x.max_followups + 1)}/{x.max_followups + 1}</small>
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
                    <Btn variant="ai" size="sm" icon={Sparkles} onClick={() => draft(thread)} disabled={!!busy}>{busy === 'draft' ? t('Drafting…', 'جاري الصياغة…') : t(`Draft step ${nextStep(thread)} in my style`, `صياغة الخطوة ${nextStep(thread)} بأسلوبي`)}</Btn>
                    <Chip tone="neutral">{t('via SMTP', 'عبر SMTP')}</Chip>
                    {draftRef && body !== draftRef && <Chip tone="green">{t('Your edits will be learned', 'تعديلاتك ستُتعلَّم')}</Chip>}
                  </div>
                  <input className="o-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('Subject', 'الموضوع')} />
                  <textarea className="o-input o-composer-body" rows={7} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('Write or generate the email…', 'اكتب الرسالة أو ولّدها…')} />
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

type WsProfile = { name: string; company: string; role: string; website: string; email: string; industry: string; target_market: string; persona: string; offer: string; goals: string; language: string };
type WsSummary = {
  workspace: { id: string; demo?: boolean; created_at: string; updated_at: string; profile: WsProfile; onboarding: { completed: boolean; step: number; completed_at?: string | null; skipped_connect: boolean }; activity: { at: string; kind: string; text: string }[]; notes: string };
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [gmail, setGmail] = useState({ address: '', app_password: '' });
  const [gmailOk, setGmailOk] = useState(false);
  const [llm, setLlm] = useState({ provider: 'openai', key: '' });
  const [llmOk, setLlmOk] = useState(false);
  const total = 3;
  const persist = async (patch: Partial<WsSummary['workspace']['onboarding']> = {}) => {
    const w = { ...ws.workspace, profile: p, onboarding: { ...ws.workspace.onboarding, step, ...patch } };
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
  const saveLlm = async () => {
    setBusy(true); setErr('');
    try { await invoke('llm_set_key', { provider: llm.provider, key: llm.key }); await invoke('llm_set_default', { provider: llm.provider, model: '' }); setLlmOk(true); void invoke('workspace_log', { kind: 'integration', text: `${llm.provider} API key saved` }); }
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
            <h2>{t('Who are you?', 'من أنت؟')}</h2>
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
                <div className="o-flex"><IconTile icon={KeyRound} tone={llmOk ? 'green' : 'violet'} /><b>{t('LLM API key', 'مفتاح نموذج اللغة')}</b>{llmOk && <Chip tone="green">{t('Saved', 'محفوظ')}</Chip>}</div>
                <p className="o-note" style={{ marginTop: 6 }}>{t('Drafts emails in your style. Stored in Windows Credential Manager.', 'يصيغ الرسائل بأسلوبك. يُحفظ في Windows Credential Manager.')}</p>
                <div className="o-form-grid" style={{ marginTop: 10 }}>
                  <label className="o-field">{t('Provider', 'المزوّد')}<select value={llm.provider} onChange={(e) => setLlm({ ...llm, provider: e.target.value })}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="google">Google Gemini</option><option value="mistral">Mistral</option><option value="groq">Groq</option><option value="openrouter">OpenRouter</option></select></label>
                  <label className="o-field">API key<input type="password" value={llm.key} onChange={(e) => setLlm({ ...llm, key: e.target.value })} /></label>
                </div>
                <Btn size="sm" onClick={saveLlm} disabled={busy || !llm.key}>{t('Save key', 'حفظ المفتاح')}</Btn>
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
    { title: t('Lead Finder', 'البحث عن العملاء'), text: t('Describe a persona, set a target, and results stream in live through Agent Reach. This sample run holds 8 leads with company facts, published emails and a stable ORB id. Click any row to open its identity card.', 'صف شخصية، حدد العدد، وتصل النتائج لحظياً عبر Agent Reach. هذه العملية التجريبية فيها 8 عملاء ببيانات الشركة والإيميلات المنشورة ومعرّف ORB ثابت. اضغط أي صف لفتح بطاقة الهوية.'), tab: 1, run: 'demo-leads', place: 'bottom' },
    { title: t('Enrich and export', 'الإثراء والتصدير'), text: t('“Enrich” reads each company site and LinkedIn page for logos, photos and published emails. Every run is exported to Excel in Documents\\orbit and saved to History automatically.', '“الإثراء” يقرأ موقع كل شركة وصفحة LinkedIn للشعارات والصور والإيميلات المنشورة. كل عملية تُصدَّر إلى Excel في Documents\\orbit وتُحفظ في السجل تلقائياً.'), tab: 1, place: 'bottom' },
    { title: t('Market Research', 'أبحاث السوق'), text: t('Same engine, different angles: reports, competitors, news, funding. Rows are typed (company, article, page) with Markdown notes.', 'نفس المحرك بزوايا مختلفة: تقارير، منافسون، أخبار، تمويل. الصفوف مصنّفة (شركة، مقال، صفحة) مع ملاحظات Markdown.'), tab: 5, run: 'demo-research', place: 'bottom' },
    { title: t('Outreach', 'التواصل'), text: t('A WhatsApp-style inbox. Sara already replied, Omar is on follow-up 1 and due today, Layla was sent this morning, two are drafts. Open a thread to see the stepper, the sequence and the composer.', 'صندوق بأسلوب واتساب. سارة ردّت بالفعل، عمر في المتابعة 1 ومستحق اليوم، ليلى أُرسل لها صباح اليوم، واثنان مسودات. افتح محادثة لترى الخطوات والتسلسل والمحرر.'), tab: 4, place: 'bottom' },
    { title: t('Your writing style', 'أسلوبك في الكتابة'), text: t('Click “My writing style”, paste a few emails you wrote, and Learn. Drafts then follow your tone, and every edit you make before sending is learned too. “Send due follow-ups” handles the rest.', 'اضغط “أسلوبي في الكتابة”، الصق رسائل كتبتها، ثم تعلّم. المسودات تتبع نبرتك بعدها، وكل تعديل قبل الإرسال يُتعلَّم أيضاً. “إرسال المتابعات المستحقة” يتكفل بالباقي.'), tab: 4, place: 'bottom' },
    { title: t('Integrations', 'التكاملات'), text: t('Gmail via app password (SMTP + IMAP), any SMTP server, signed webhooks, Agent Reach health, and LLM provider keys. Passwords and keys live only in Windows Credential Manager.', 'Gmail بكلمة مرور تطبيق (SMTP + IMAP)، أي خادم SMTP، webhooks موقّعة، صحة Agent Reach، ومفاتيح مزوّدي النماذج. كلمات المرور والمفاتيح في Windows Credential Manager فقط.'), tab: 7, place: 'bottom' },
    { title: t('History and Settings', 'السجل والإعدادات'), text: t('History keeps every run to reopen later. Settings holds your profile, notes, activity, backups, and a Delete button for every dataset.', 'السجل يحتفظ بكل عملية لإعادة فتحها. الإعدادات فيها ملفك وملاحظاتك ونشاطك والنسخ الاحتياطية وزر حذف لكل مجموعة بيانات.'), tab: 8, place: 'bottom' },
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
