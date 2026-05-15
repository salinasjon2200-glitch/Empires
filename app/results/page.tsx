'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ChatSidebar from '@/components/ChatSidebar';
import Link from 'next/link';

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false });

interface Session { playerName: string; empireName: string; color: string; sessionToken: string; status: string; }

// ── Stats types (mirrors lib/types.ts EmpireStats, minus gmNotes) ──────────
interface EmpireStatsPublic {
  empire: string;
  generatedYear: number;
  isInitial: boolean;
  gdp: number;
  gdpPerCapita: number;
  areaSqMiles: number;
  population: number;
  birthRate: number;
  stockMarket: string;
  inflationRate: number;
  socialCohesion: string;
  publicApproval: number;
  governmentType: string;
  debt: number;
  revenue: number;
  spending: number;
  interestRate: number;
  technologyYears: number;
  tradeDeficit: number;
  tradeSurplus: number;
  military: Record<string, number>;
  militaryTech: Record<string, number>;
  intelligence: string;
  trainingLevel: string;
  militarySupply: string;
  spaceProgram?: string;
}

function fmt(n: number, decimals = 1) {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}T`;
  return `$${n.toFixed(decimals)}B`;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function techLabel(years: number) {
  if (years === 0) return '2025 baseline';
  const sign = years > 0 ? '+' : '';
  return `${sign}${years} yrs`;
}

function StatRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text2)' }}>{label}</span>
      <span className="text-xs font-semibold text-right" style={{ color: 'var(--text)' }}>
        {value}{sub && <span className="font-normal ml-1" style={{ color: 'var(--text2)', fontSize: '0.65rem' }}>{sub}</span>}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0">
      <p className="text-xs font-bold display-font uppercase mb-1 mt-4" style={{ color: 'var(--accent)', letterSpacing: '0.1em' }}>{title}</p>
      {children}
    </div>
  );
}

function StatsSheet({ stats, empireName, year }: { stats: EmpireStatsPublic; empireName: string; year: number | null }) {
  const milKeys: [keyof typeof stats.military, string][] = [
    ['infantry', 'Infantry (k)'],
    ['armor', 'Armor'],
    ['artillery', 'Artillery'],
    ['fighters', 'Fighters'],
    ['bombers', 'Bombers'],
    ['antiAir', 'Anti-Air'],
    ['navy', 'Navy'],
    ['nukes', 'Nukes'],
    ['missiles', 'Missiles'],
    ['antiMissiles', 'Anti-Missiles'],
  ];

  return (
    <div>
      <p className="text-xs mb-3 display-font" style={{ color: 'var(--accent)', letterSpacing: '0.08em' }}>
        EMPIRE STATISTICS — {empireName} — YEAR {year}
        {stats.isInitial && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text2)' }}>(initial baseline)</span>}
      </p>

      <Section title="Economy">
        <StatRow label="GDP" value={fmt(stats.gdp)} />
        <StatRow label="GDP per Capita" value={`$${stats.gdpPerCapita.toFixed(1)}K`} />
        <StatRow label="Area" value={`${stats.areaSqMiles.toFixed(1)}K sq mi`} />
        <StatRow label="Population" value={`${stats.population.toFixed(1)}M`} />
        <StatRow label="Birth Rate" value={`${stats.birthRate.toFixed(1)}/1000`} />
        <StatRow label="Stock Market" value={stats.stockMarket} />
        <StatRow label="Inflation Rate" value={`${stats.inflationRate.toFixed(1)}%`} />
        <StatRow label="Interest Rate" value={`${stats.interestRate.toFixed(1)}%`} />
        <StatRow label="Government Revenue" value={fmt(stats.revenue, 0)} sub="/yr" />
        <StatRow label="Government Spending" value={fmt(stats.spending, 0)} sub="/yr" />
        <StatRow label="National Debt" value={fmt(stats.debt, 0)} />
        <StatRow label="Trade Deficit" value={stats.tradeDeficit < 0 ? `${fmt(Math.abs(stats.tradeDeficit), 0)} surplus` : fmt(stats.tradeDeficit, 0)} />
        <StatRow label="Trade Surplus" value={stats.tradeSurplus >= 0 ? fmt(stats.tradeSurplus, 0) : `${fmt(Math.abs(stats.tradeSurplus), 0)} deficit`} />
        <StatRow label="Technology" value={techLabel(stats.technologyYears)} sub="vs avg" />
      </Section>

      <Section title="Society">
        <StatRow label="Social Cohesion" value={stats.socialCohesion} />
        <StatRow label="Public Approval" value={`${stats.publicApproval}%`} />
        <StatRow label="Government Type" value={stats.governmentType} />
        <StatRow label="Space Program" value={stats.spaceProgram || 'None'} />
      </Section>

      <Section title="Military — Forces">
        {milKeys.map(([key, label]) => (
          <StatRow key={key} label={label} value={fmtNum(stats.military[key] ?? 0)} />
        ))}
      </Section>

      <Section title="Military — Technology">
        {milKeys.map(([key, label]) => (
          <StatRow key={key} label={label} value={techLabel(stats.militaryTech[key] ?? 0)} />
        ))}
      </Section>

      <Section title="Qualitative">
        <StatRow label="Intelligence" value={stats.intelligence} />
        <StatRow label="Training Level" value={stats.trainingLevel} />
        <StatRow label="Military Supply" value={stats.militarySupply} />
      </Section>
    </div>
  );
}

const POLL_INTERVAL = 20_000; // 20 seconds

export default function ResultsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [territories, setTerritories] = useState({});
  const [summary, setSummary] = useState('');
  const [advisorReport, setAdvisorReport] = useState('');
  const [archive, setArchive] = useState<number[]>([]);
  const [year, setYear] = useState(2032);           // currentYear (open turn)
  const [viewYear, setViewYear] = useState<number | null>(null);
  const [players, setPlayers] = useState<{ name: string; empire: string; color: string; status: string }[]>([]);
  const [loadingAdvisors, setLoadingAdvisors] = useState(false);
  const [advisorError, setAdvisorError] = useState('');
  const [advisorGenerating, setAdvisorGenerating] = useState(false); // report exists but isn't ready yet
  const [activeTab, setActiveTab] = useState<'summary' | 'advisors' | 'stats' | 'archive'>('summary');

  // Stats
  const [empireStats, setEmpireStats] = useState<EmpireStatsPublic | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [newResultBanner, setNewResultBanner] = useState<number | null>(null);
  const [awaitingResults, setAwaitingResults] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [biddingLive, setBiddingLive] = useState(false);

  // Refs for stale-closure-safe access inside intervals/callbacks
  const viewYearRef = useRef<number | null>(null);
  const activeTabRef = useRef<'summary' | 'advisors' | 'stats' | 'archive'>('summary');
  const sessionRef = useRef<Session | null>(null);
  const latestKnownYear = useRef<number | null>(null); // highest archive year we've ever seen
  const advisorPollRef = useRef<ReturnType<typeof setInterval> | null>(null); // polling when report is generating

  // Keep refs in sync
  useEffect(() => { viewYearRef.current = viewYear; }, [viewYear]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // ── Stop any in-progress advisor poll ───────────────────────────────────
  const stopAdvisorPoll = useCallback(() => {
    if (advisorPollRef.current) { clearInterval(advisorPollRef.current); advisorPollRef.current = null; }
  }, []);

  // ── Advisor loader (stable ref) ──────────────────────────────────────────
  const loadAdvisors = useCallback(async (forYear: number, { silent = false } = {}) => {
    const sess = sessionRef.current;
    if (!sess) return;
    if (!silent) { setLoadingAdvisors(true); setAdvisorError(''); setAdvisorReport(''); setAdvisorGenerating(false); }
    try {
      const r = await fetch(
        `/api/turns/${forYear}/advisors/${encodeURIComponent(sess.playerName)}`,
        { headers: { Authorization: `Bearer ${sess.sessionToken}` } }
      );
      if (r.ok) {
        const d = await r.json();
        setAdvisorReport(d.report ?? '');
        setAdvisorGenerating(false);
        stopAdvisorPoll(); // report arrived — stop polling
      } else if (r.status === 401) {
        // Token expired — clear stale session so UI shows login prompt
        localStorage.removeItem('empires-player');
        setSession(null);
        setAdvisorError('Your session has expired. Please log in again.');
        stopAdvisorPoll();
      } else {
        // 404: report not ready yet (still generating or never run)
        const d = await r.json().catch(() => ({}));
        if (!silent) {
          if (d?.generating !== false) {
            // Server flagged this as "generating" — poll silently every 15s
            setAdvisorGenerating(true);
            setAdvisorError('');
            stopAdvisorPoll();
            advisorPollRef.current = setInterval(() => loadAdvisors(forYear, { silent: true }), 15_000);
          } else {
            setAdvisorError(`No advisor report available for Year ${forYear}.`);
          }
        }
        // silent poll: if still not ready, keep polling; nothing to update in UI
      }
    } catch {
      if (!silent) setAdvisorError('Failed to load advisor report.');
    }
    if (!silent) setLoadingAdvisors(false);
  }, [stopAdvisorPoll]);

  // ── Summary loader ───────────────────────────────────────────────────────
  const loadSummary = useCallback((yr: number) => {
    setSummary('');
    fetch(`/api/turns/${yr}/summary`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.publicSummary) setSummary(d.publicSummary); })
      .catch(() => {});
  }, []);

  // ── Stats loader ─────────────────────────────────────────────────────────
  // Tries `forYear` first; if not found, falls back to `year` (current game year)
  // so that starting stats generated before any turn is archived are still visible.
  const loadStats = useCallback(async (forYear: number) => {
    const sess = sessionRef.current;
    if (!sess) return;
    setLoadingStats(true);
    setStatsError('');
    setEmpireStats(null);
    try {
      const tryYear = async (y: number) => {
        const r = await fetch(`/api/turns/${y}/stats`, {
          headers: { Authorization: `Bearer ${sess.sessionToken}` },
        });
        if (r.ok) {
          const d = await r.json();
          return (d.stats as EmpireStatsPublic) ?? null;
        }
        if (r.status === 401) {
          localStorage.removeItem('empires-player');
          setSession(null);
          setStatsError('Session expired. Please log in again.');
        }
        return null;
      };

      // Try the requested year first
      let stats = await tryYear(forYear);

      // Fall back to current game year if the requested year has no stats yet
      if (!stats && forYear !== year) {
        stats = await tryYear(year);
      }

      if (stats) {
        setEmpireStats(stats);
      } else {
        setStatsError(`No statistics available yet.`);
      }
    } catch {
      setStatsError('Failed to load statistics.');
    }
    setLoadingStats(false);
  }, [year]);

  // ── Switch to a viewed year (updates state + loads content) ─────────────
  const switchToYear = useCallback((yr: number, tab?: typeof activeTab) => {
    setViewYear(yr);
    viewYearRef.current = yr;
    loadSummary(yr);
    const targetTab = tab ?? activeTabRef.current;
    if (targetTab === 'advisors') loadAdvisors(yr);
    if (targetTab === 'stats') loadStats(yr);
  }, [loadSummary, loadAdvisors, loadStats]);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Verify stored session token against server before trusting it
    const stored = localStorage.getItem('empires-player');
    if (stored) {
      try {
        const s: Session = JSON.parse(stored);
        fetch('/api/auth/session', { headers: { Authorization: `Bearer ${s.sessionToken}` } })
          .then(r => {
            if (r.ok) { setSession(s); sessionRef.current = s; }
            else { localStorage.removeItem('empires-player'); } // token expired/invalid
          })
          .catch(() => {}); // network error — leave session unset; page still usable without it
      } catch { localStorage.removeItem('empires-player'); }
    }

    fetch('/api/bidding/state').then(r => r.ok ? r.json() : null).then(d => { if (d) setBiddingLive(d.open ?? false); }).catch(() => {});

    Promise.all([
      fetch('/api/map/territories').then(r => r.json()),
      fetch('/api/game/state').then(r => r.json()),
      fetch('/api/game/archive').then(r => r.json()),
      fetch('/api/game/players').then(r => r.json()),
    ]).then(([map, state, arch, playerData]) => {
      setTerritories(map.territories ?? {});
      const yr: number = state.currentYear ?? 2032;
      setYear(yr);
      setPlayers(playerData.players ?? []);

      const archYears: number[] = (arch.archive ?? []).sort((a: number, b: number) => b - a);
      setArchive(archYears);

      const latest = archYears[0] ?? null;
      latestKnownYear.current = latest;

      // Awaiting if no turns archived yet, or current turn not yet processed
      const isAwaiting = latest === null || latest < yr - 1;
      setAwaitingResults(isAwaiting);

      if (latest !== null) {
        setViewYear(latest);
        viewYearRef.current = latest;
        loadSummary(latest);
        setLastUpdated(new Date());
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Polling: detect new turns ────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const [archR, stateR, mapR, bidR] = await Promise.all([
          fetch('/api/game/archive').then(r => r.json()),
          fetch('/api/game/state').then(r => r.json()),
          fetch('/api/map/territories').then(r => r.json()),
          fetch('/api/bidding/state').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (bidR) setBiddingLive(bidR.open ?? false);
        const archYears: number[] = (archR.archive ?? []).sort((a: number, b: number) => b - a);
        const yr: number = stateR.currentYear ?? 2032;
        const newLatest = archYears[0] ?? null;

        setYear(yr);
        setArchive(archYears);
        setTerritories(mapR.territories ?? {});

        const isAwaiting = newLatest === null || newLatest < yr - 1;
        setAwaitingResults(isAwaiting);

        if (newLatest !== null && newLatest !== latestKnownYear.current) {
          // A new turn result has appeared!
          latestKnownYear.current = newLatest;
          setLastUpdated(new Date());

          const currentlyViewing = viewYearRef.current;
          const wasViewingLatest =
            currentlyViewing === null ||
            currentlyViewing === newLatest - 1 ||
            currentlyViewing === newLatest;

          if (wasViewingLatest) {
            // Auto-advance to the new year
            setViewYear(newLatest);
            viewYearRef.current = newLatest;
            loadSummary(newLatest);
            if (activeTabRef.current === 'advisors') loadAdvisors(newLatest);
            setNewResultBanner(newLatest);
          } else {
            // User is browsing history — just show banner
            setNewResultBanner(newLatest);
          }
        }
      } catch {}
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [loadSummary, loadAdvisors]);

  // ── Reload advisors whenever the relevant context changes ────────────────
  useEffect(() => {
    stopAdvisorPoll(); // cancel any in-flight poll before loading fresh
    if (activeTab === 'advisors' && sessionRef.current && viewYear !== null) {
      loadAdvisors(viewYear);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, viewYear, session]); // session dep ensures we load once session arrives

  // ── Reload stats when tab/year/session changes ───────────────────────────
  useEffect(() => {
    if (activeTab === 'stats' && sessionRef.current) {
      // If no archived year yet, try current game year directly
      loadStats(viewYear ?? year);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, viewYear, session, year]);

  // ── Clean up advisor poll on unmount ─────────────────────────────────────
  useEffect(() => () => stopAdvisorPoll(), [stopAdvisorPoll]);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="display-font text-2xl font-black" style={{ color: 'var(--accent)' }}>
              RESULTS{viewYear ? ` — YEAR ${viewYear}` : ''}
            </h1>
            {lastUpdated && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                Last updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Link href="/submit" className="btn-ghost text-sm">← Submission</Link>
          </div>
        </div>

        {/* Awaiting results banner */}
        {awaitingResults && (
          <div className="card flex items-center gap-3" style={{ borderColor: 'var(--accent)', background: 'rgba(0,212,255,0.04)' }}>
            <span style={{ fontSize: '1.2rem' }}>⏳</span>
            <div>
              <p className="font-semibold text-sm display-font" style={{ color: 'var(--accent)', letterSpacing: '0.05em' }}>
                AWAITING YEAR {year} RESULTS
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                The GM is processing this turn. This page will update automatically when results are published.
              </p>
            </div>
          </div>
        )}

        {/* New results banner */}
        {newResultBanner !== null && (
          <div
            className="card flex items-center justify-between gap-3"
            style={{ borderColor: '#22c55e', background: 'rgba(34,197,94,0.06)' }}
          >
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '1.2rem' }}>🎯</span>
              <p className="font-semibold text-sm display-font" style={{ color: '#22c55e', letterSpacing: '0.05em' }}>
                NEW RESULTS — YEAR {newResultBanner} IS LIVE
              </p>
            </div>
            <button
              className="text-xs btn-ghost"
              onClick={() => {
                switchToYear(newResultBanner);
                setNewResultBanner(null);
              }}
              style={{ color: '#22c55e', borderColor: '#22c55e' }}
            >
              View →
            </button>
            <button onClick={() => setNewResultBanner(null)} style={{ color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
          </div>
        )}

        {/* Live bidding banner */}
        {biddingLive && session && (
          <div className="card flex items-center justify-between gap-3" style={{ borderColor: 'var(--accent)', background: 'rgba(0,212,255,0.05)' }}>
            <div className="flex items-center gap-3">
              <span className="inline-block w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: 'var(--accent)' }} />
              <div>
                <p className="font-semibold text-sm display-font" style={{ color: 'var(--accent)', letterSpacing: '0.06em' }}>TERRITORY BIDDING IS LIVE</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>Bidding is open. Place or raise bids before time runs out.</p>
              </div>
            </div>
            <Link href="/bid" className="btn-primary text-sm flex-shrink-0">Bid Now →</Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Summary + advisors */}
          <div className="lg:col-span-2 space-y-4">

            {/* Tabs */}
            <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
              {([['summary', 'World Summary'], ['advisors', 'Classified Intel'], ['stats', 'Empire Stats'], ['archive', 'Archive']] as const).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className="px-4 py-2 text-sm font-semibold transition-colors display-font"
                  style={{
                    color: activeTab === t ? 'var(--accent)' : 'var(--text2)',
                    borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                    background: 'transparent',
                    letterSpacing: '0.06em',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* World Summary tab */}
            {activeTab === 'summary' && (
              <div className="card prose-sm max-w-none" style={{ color: 'var(--text)' }}>
                {viewYear === null ? (
                  <p style={{ color: 'var(--text2)' }}>No turn results available yet.</p>
                ) : summary ? (
                  <div className="markdown-content" style={{ lineHeight: 1.7 }}>
                    {summary.split('\n').map((line, i) => {
                      if (line.startsWith('## ')) return <h2 key={i} className="display-font text-sm font-bold mt-6 mb-2" style={{ color: 'var(--accent)', letterSpacing: '0.08em' }}>{line.slice(3)}</h2>;
                      if (line.startsWith('### ')) return <h3 key={i} className="font-bold mt-4 mb-1 text-sm" style={{ color: 'var(--text)' }}>{line.slice(4)}</h3>;
                      if (line.startsWith('- ') || line.startsWith('✅') || line.startsWith('❌') || line.startsWith('⚠️') || line.startsWith('💀')) {
                        return <p key={i} className="text-sm my-1 pl-2" style={{ color: 'var(--text)' }}>{line}</p>;
                      }
                      if (line.trim() === '') return <br key={i} />;
                      return <p key={i} className="text-sm my-1" style={{ color: 'var(--text)' }}>{line}</p>;
                    })}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text2)' }}>No summary available for Year {viewYear}.</p>
                )}
              </div>
            )}

            {/* Classified Intel tab */}
            {activeTab === 'advisors' && (
              <div className="card space-y-4">
                {!session ? (
                  <div className="text-center py-8">
                    <p style={{ color: 'var(--text2)' }}>Login to view your classified advisor reports.</p>
                    <Link href="/login" className="btn-primary inline-block mt-4">Empire Login</Link>
                  </div>
                ) : session.status === 'eliminated' ? (
                  <p style={{ color: 'var(--text2)' }}>Your empire was eliminated. No new advisor reports are generated.</p>
                ) : loadingAdvisors ? (
                  <div className="text-center py-8 space-y-2">
                    <div className="inline-block w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                    <p className="text-sm" style={{ color: 'var(--text2)' }}>Loading classified intel...</p>
                  </div>
                ) : advisorGenerating ? (
                  <div className="text-center py-8 space-y-3">
                    <div className="inline-block w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#f59e0b', borderTopColor: 'transparent' }} />
                    <p className="text-sm font-semibold display-font" style={{ color: '#f59e0b', letterSpacing: '0.06em' }}>
                      ADVISORS BRIEFING IN PROGRESS
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text2)' }}>
                      Your classified intel is being compiled. This page will update automatically.
                    </p>
                  </div>
                ) : advisorError ? (
                  <div className="space-y-3">
                    <p className="danger">{advisorError}</p>
                    {viewYear !== null && (
                      <button className="btn-primary" onClick={() => loadAdvisors(viewYear)}>Retry</button>
                    )}
                  </div>
                ) : advisorReport ? (
                  <div style={{ color: 'var(--text)', lineHeight: 1.7 }}>
                    <p className="text-xs mb-4 display-font" style={{ color: 'var(--accent)', letterSpacing: '0.08em' }}>
                      CLASSIFIED — {session.empireName} — YEAR {viewYear}
                    </p>
                    {advisorReport.split('\n').map((line, i) => {
                      if (line.startsWith('### ')) return <h3 key={i} className="display-font text-sm font-bold mt-6 mb-2" style={{ color: 'var(--accent)' }}>{line.slice(4)}</h3>;
                      if (line.startsWith('## ')) return <h2 key={i} className="display-font text-sm font-bold mt-6 mb-2" style={{ color: 'var(--accent)' }}>{line.slice(3)}</h2>;
                      if (line.trim() === '') return <br key={i} />;
                      return <p key={i} className="text-sm my-1">{line}</p>;
                    })}
                  </div>
                ) : viewYear === null ? (
                  <p style={{ color: 'var(--text2)' }}>No turn results available yet.</p>
                ) : (
                  <div className="text-center py-8">
                    <button className="btn-primary" onClick={() => loadAdvisors(viewYear!)} disabled={loadingAdvisors}>
                      Load Classified Intel
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Empire Stats tab */}
            {activeTab === 'stats' && (
              <div className="card space-y-4">
                {!session ? (
                  <div className="text-center py-8">
                    <p style={{ color: 'var(--text2)' }}>Login to view your empire statistics.</p>
                    <Link href="/login" className="btn-primary inline-block mt-4">Empire Login</Link>
                  </div>
                ) : loadingStats ? (
                  <div className="text-center py-8 space-y-2">
                    <div className="inline-block w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                    <p className="text-sm" style={{ color: 'var(--text2)' }}>Loading statistics…</p>
                  </div>
                ) : statsError ? (
                  <div className="space-y-3">
                    <p className="text-sm" style={{ color: 'var(--text2)' }}>{statsError}</p>
                    {viewYear !== null && (
                      <button className="btn-primary" onClick={() => loadStats(viewYear!)}>Retry</button>
                    )}
                  </div>
                ) : empireStats ? (
                  <StatsSheet stats={empireStats} empireName={session.empireName} year={viewYear} />
                ) : viewYear === null ? (
                  <p style={{ color: 'var(--text2)' }}>No turn results available yet.</p>
                ) : (
                  <div className="text-center py-8">
                    <button className="btn-primary" onClick={() => loadStats(viewYear!)} disabled={loadingStats}>
                      Load Empire Statistics
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Archive tab */}
            {activeTab === 'archive' && (
              <div className="card space-y-2">
                <p className="label mb-3">Turn Archive</p>
                {archive.length === 0 && <p style={{ color: 'var(--text2)' }}>No archived turns yet.</p>}
                {archive.map(yr => (
                  <button
                    key={yr}
                    className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
                    style={{
                      background: viewYear === yr ? 'rgba(0,212,255,0.1)' : 'var(--surface2)',
                      border: `1px solid ${viewYear === yr ? 'var(--accent)' : 'var(--border)'}`,
                      color: viewYear === yr ? 'var(--accent)' : 'var(--text)',
                    }}
                    onClick={() => { switchToYear(yr); setActiveTab('summary'); }}
                  >
                    Year {yr}
                    {yr === archive[0] && (
                      <span className="ml-2 text-xs" style={{ color: 'var(--accent)' }}>● latest</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Map + empire status */}
          <div className="space-y-4">
            <div className="card">
              <p className="label mb-3">World Map{viewYear ? ` — Year ${viewYear}` : ''}</p>
              <WorldMap territories={territories} mode="territories" height={250} />
            </div>

            <div className="card">
              <p className="label mb-3">Empire Status</p>
              <div className="space-y-2">
                {players.map(p => (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.status === 'eliminated' ? '#6b7280' : p.color }} />
                    <span style={{ color: p.status === 'eliminated' ? 'var(--text2)' : 'var(--text)', textDecoration: p.status === 'eliminated' ? 'line-through' : 'none' }}>
                      {p.empire}
                    </span>
                    {p.status === 'eliminated' && <span className="badge badge-danger" style={{ fontSize: '0.55rem' }}>FALLEN</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Live poll indicator */}
            <div className="flex items-center gap-2 text-xs px-1" style={{ color: 'var(--text2)' }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: awaitingResults ? '#f59e0b' : '#22c55e' }} />
              {awaitingResults ? `Awaiting Year ${year} results…` : 'Live — updates automatically'}
            </div>
          </div>
        </div>
      </div>

      {session && (
        <ChatSidebar
          sessionToken={session.sessionToken}
          playerName={session.playerName}
          empireName={session.empireName}
          color={session.color}
        />
      )}
    </div>
  );
}
