'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ChatSidebar from '@/components/ChatSidebar';
import Link from 'next/link';

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false });

interface Session { playerName: string; empireName: string; color: string; sessionToken: string; status: string; }

export default function ResultsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [territories, setTerritories] = useState({});
  const [summary, setSummary] = useState('');
  const [advisorReport, setAdvisorReport] = useState('');
  const [archive, setArchive] = useState<number[]>([]);
  const [year, setYear] = useState(2032);
  const [viewYear, setViewYear] = useState(2032);
  const [players, setPlayers] = useState<{ name: string; empire: string; color: string; status: string }[]>([]);
  const [loadingAdvisors, setLoadingAdvisors] = useState(false);
  const [advisorError, setAdvisorError] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'advisors' | 'archive'>('summary');

  useEffect(() => {
    const stored = localStorage.getItem('empires-player');
    if (stored) try { setSession(JSON.parse(stored)); } catch {}

    Promise.all([
      fetch('/api/map/territories').then(r => r.json()),
      fetch('/api/game/state').then(r => r.json()),
      fetch('/api/game/archive').then(r => r.json()),
      fetch('/api/game/players').then(r => r.json()),
    ]).then(([map, state, arch, playerData]) => {
      setTerritories(map.territories ?? {});
      const yr = state.currentYear ?? 2032;
      setYear(yr);
      setViewYear(yr);
      const archYears = (arch.archive ?? []).sort((a: number, b: number) => b - a);
      setArchive(archYears);
      setPlayers(playerData.players ?? []);
      loadSummary(yr);
    }).catch(() => {});
  }, []);

  function loadSummary(yr: number) {
    setViewYear(yr);
    setSummary('');
    fetch(`/api/turns/${yr}/summary`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.publicSummary) setSummary(d.publicSummary);
    }).catch(() => {});
  }

  async function loadAdvisors() {
    if (!session) return;
    setLoadingAdvisors(true);
    setAdvisorError('');
    const r = await fetch(`/api/turns/${year}/advisors/${encodeURIComponent(session.playerName)}`, {
      headers: { 'Authorization': `Bearer ${session.sessionToken}` },
    });
    if (r.ok) {
      const d = await r.json();
      setAdvisorReport(d.report ?? '');
    } else {
      setAdvisorError('No advisor report available for this turn.');
    }
    setLoadingAdvisors(false);
  }

  useEffect(() => {
    if (activeTab === 'advisors' && session && !advisorReport) loadAdvisors();
  }, [activeTab]);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="display-font text-2xl font-black" style={{ color: 'var(--accent)' }}>
            WORLD SUMMARY — YEAR {viewYear}
          </h1>
          <div className="flex gap-3">
            <Link href="/submit" className="btn-ghost text-sm">← Submission</Link>
            <Link href="/gm" className="btn-ghost text-sm">GM Dashboard</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Summary + advisors */}
          <div className="lg:col-span-2 space-y-4">

            {/* Tabs */}
            <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
              {[['summary', 'World Summary'], ['advisors', 'Classified Intel'], ['archive', 'Archive']].map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t as typeof activeTab)}
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

            {activeTab === 'summary' && (
              <div className="card prose-sm max-w-none" style={{ color: 'var(--text)' }}>
                {summary ? (
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

            {activeTab === 'advisors' && (
              <div className="card space-y-4">
                {!session ? (
                  <div className="text-center py-8">
                    <p style={{ color: 'var(--text2)' }}>Login to view your classified advisor reports.</p>
                    <Link href="/login" className="btn-primary inline-block mt-4">Empire Login</Link>
                  </div>
                ) : session.status === 'eliminated' ? (
                  <p style={{ color: 'var(--text2)' }}>Your empire was eliminated. No new advisor reports are generated.</p>
                ) : advisorError ? (
                  <div className="space-y-3">
                    <p className="danger">{advisorError}</p>
                    <button className="btn-primary" onClick={loadAdvisors}>Retry</button>
                  </div>
                ) : advisorReport ? (
                  <div style={{ color: 'var(--text)', lineHeight: 1.7 }}>
                    {advisorReport.split('\n').map((line, i) => {
                      if (line.startsWith('### ')) return <h3 key={i} className="display-font text-sm font-bold mt-6 mb-2" style={{ color: 'var(--accent)' }}>{line.slice(4)}</h3>;
                      if (line.trim() === '') return <br key={i} />;
                      return <p key={i} className="text-sm my-1">{line}</p>;
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <button className="btn-primary" onClick={loadAdvisors} disabled={loadingAdvisors}>
                      {loadingAdvisors ? 'Loading...' : 'Load Classified Intel'}
                    </button>
                  </div>
                )}
              </div>
            )}

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
                    onClick={() => { loadSummary(yr); setActiveTab('summary'); }}
                  >
                    Year {yr}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Map + empire status */}
          <div className="space-y-4">
            <div className="card">
              <p className="label mb-3">World Map — Year {viewYear}</p>
              <WorldMap territories={territories} mode="territories" height={250} />
            </div>

            <div className="card">
              <p className="label mb-3">Empire Status</p>
              <div className="space-y-2">
                {players.map(p => (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ background: p.status === 'eliminated' ? '#6b7280' : p.color }} />
                    <span style={{ color: p.status === 'eliminated' ? 'var(--text2)' : 'var(--text)', textDecoration: p.status === 'eliminated' ? 'line-through' : 'none' }}>
                      {p.empire}
                    </span>
                    {p.status === 'eliminated' && <span className="badge badge-danger" style={{ fontSize: '0.55rem' }}>FALLEN</span>}
                  </div>
                ))}
              </div>
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
