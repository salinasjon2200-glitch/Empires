'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ChatSidebar from '@/components/ChatSidebar';
import Link from 'next/link';

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false });

interface Session { playerName: string; empireName: string; color: string; sessionToken: string; status: string; eliminatedYear?: number; }
interface Player { name: string; empire: string; color: string; status: string; }

export default function SubmitPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [territories, setTerritories] = useState({});
  const [players, setPlayers] = useState<Player[]>([]);
  const [submittedNames, setSubmittedNames] = useState<Set<string>>(new Set());
  const [year, setYear] = useState(2032);
  const [actionText, setActionText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prevSummary, setPrevSummary] = useState('');
  const [warChest, setWarChest] = useState<{ balance: number; threshold: number; contributions: Array<{ name: string; amount: number; timestamp: number }>; lastTurnCost: number } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [lastTurnAt, setLastTurnAt] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('empires-player');
    if (stored) try { setSession(JSON.parse(stored)); } catch {}

    Promise.all([
      fetch('/api/map/territories').then(r => r.json()),
      fetch('/api/game/players').then(r => r.json()),
      fetch('/api/game/state').then(r => r.json()),
    ]).then(([map, playerData, state]) => {
      setTerritories(map.territories ?? {});
      setPlayers(playerData.players ?? []);
      const yr = state.currentYear ?? 2032;
      setYear(yr);

      if (state.lastTurnCompletedAt) setLastTurnAt(state.lastTurnCompletedAt);

      // Load previous summary
      const prevYear = yr - 1;
      fetch(`/api/turns/${prevYear}/summary`).then(r => r.ok ? r.json() : null).then(s => {
        if (s?.publicSummary) setPrevSummary(s.publicSummary);
      }).catch(() => {});

      // Load initial submission status
      fetch('/api/turns/status').then(r => r.ok ? r.json() : null).then(d => {
        if (d?.submitted) setSubmittedNames(new Set(d.submitted));
      }).catch(() => {});
    }).catch(() => {});

    // Check if already submitted
    const submittedKey = `submitted-${year}`;
    if (localStorage.getItem(submittedKey)) setSubmitted(true);
  }, [year]);

  // Load war chest
  useEffect(() => {
    fetch('/api/war-chest').then(r => r.json()).then(d => setWarChest(d.warChest)).catch(() => {});
  }, []);

  // Poll submission status every 15s
  useEffect(() => {
    const poll = () => {
      fetch('/api/turns/status').then(r => r.ok ? r.json() : null).then(d => {
        if (d?.submitted) setSubmittedNames(new Set(d.submitted));
      }).catch(() => {});
    };
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, []);

  // Mark as submitted if the server says so (covers different devices / cleared localStorage)
  useEffect(() => {
    if (session && submittedNames.has(session.playerName)) {
      setSubmitted(true);
      localStorage.setItem(`submitted-${year}`, '1');
    }
  }, [submittedNames, session, year]);

  // Countdown interval
  useEffect(() => {
    if (!lastTurnAt) return;
    const interval = setInterval(() => {
      const remaining = (lastTurnAt + 24 * 60 * 60 * 1000) - Date.now();
      setCountdown(Math.max(0, remaining));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastTurnAt]);

  async function submitAction() {
    if (!actionText.trim() || !session) return;
    setLoading(true); setError('');
    const r = await fetch('/api/turns/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.sessionToken}` },
      body: JSON.stringify({ action: actionText }),
    });
    const d = await r.json();
    if (r.ok) {
      setSubmitted(true);
      localStorage.setItem(`submitted-${year}`, '1');
      if (session) setSubmittedNames(prev => { const s = new Set(Array.from(prev)); s.add(session.playerName); return s; });
    } else {
      setError(d.error ?? 'Submission failed');
    }
    setLoading(false);
  }

  // Eliminated screen
  if (session?.status === 'eliminated') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-lg text-center space-y-6">
          <div className="text-6xl">💀</div>
          <h1 className="display-font text-4xl font-black danger">YOUR EMPIRE HAS FALLEN</h1>
          <p className="text-lg" style={{ color: 'var(--text2)' }}>
            {session.empireName} was eliminated in {session.eliminatedYear ?? 'an unknown year'}.
          </p>
          <p style={{ color: 'var(--text2)' }}>Your legacy lives in infamy. Or obscurity. Probably obscurity.</p>
          <div className="flex gap-4 justify-center">
            <Link href="/results" className="btn-primary">View World Summary</Link>
          </div>
        </div>
        <ChatSidebar sessionToken={session.sessionToken} playerName={session.playerName} empireName={session.empireName} color={session.color} />
      </div>
    );
  }

  const activePlayers = players.filter(p => p.status === 'active');
  const submittedCount = submittedNames.size;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="display-font text-2xl font-black" style={{ color: 'var(--accent)' }}>
              DECLARE ACTIONS — YEAR {year}
            </h1>
            {session && (
              <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
                Authenticated as <span style={{ color: session.color }} className="font-semibold">{session.empireName}</span> ({session.playerName})
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Link href="/results" className="btn-ghost text-sm">Results →</Link>
            <Link href="/gm" className="btn-ghost text-sm">GM</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Action submission */}
          <div className="lg:col-span-2 space-y-6">

            {/* Previous summary */}
            {prevSummary && (
              <div className="card">
                <p className="label mb-3">Previous Turn Summary (Year {year - 1})</p>
                <div className="text-sm leading-relaxed max-h-48 overflow-y-auto" style={{ color: 'var(--text2)' }}>
                  {prevSummary.split('\n').slice(0, 15).join('\n')}...
                </div>
                <Link href="/results" className="text-xs mt-2 block" style={{ color: 'var(--accent)' }}>Read full summary →</Link>
              </div>
            )}

            {/* Map */}
            <div className="card">
              <p className="label mb-3">Current Territory Map</p>
              <WorldMap territories={territories} mode="territories" height={280} />
            </div>

            {/* Action form */}
            {!session ? (
              <div className="card text-center py-8">
                <p style={{ color: 'var(--text2)' }}>You must authenticate to submit actions.</p>
                <Link href="/login" className="btn-primary inline-block mt-4">Empire Login</Link>
              </div>
            ) : submitted ? (
              <div className="card text-center py-8 space-y-3">
                <div className="text-4xl">✅</div>
                <p className="text-lg font-semibold success">Actions Declared</p>
                <p style={{ color: 'var(--text2)' }}>Your orders for Year {year} have been logged. Await the GM's processing.</p>
              </div>
            ) : (
              <div className="card space-y-4">
                <p className="label">Declare Your Actions for Year {year}</p>
                <p className="text-sm" style={{ color: 'var(--text2)' }}>
                  Describe everything your empire does this year. Be specific. The AI GM evaluates all actions for realism.
                  Fantasy and impossible actions will be rejected or downscaled.
                </p>
                <textarea
                  className="input"
                  style={{ minHeight: 200 }}
                  placeholder="This year, our empire will... (be as specific and detailed as you want)"
                  value={actionText}
                  onChange={e => setActionText(e.target.value)}
                />
                {error && <p className="danger text-sm">{error}</p>}
                <button className="btn-primary w-full" onClick={submitAction} disabled={loading || !actionText.trim()}>
                  {loading ? 'Submitting...' : 'Declare Actions'}
                </button>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>⚠️ Actions are final once submitted. No edits allowed.</p>
              </div>
            )}
          </div>

          {/* RIGHT: Submission tracker + players + war chest */}
          <div className="space-y-4">
            <div className="card">
              <p className="label mb-3">Submission Status</p>
              <p className="text-sm mb-3" style={{ color: 'var(--text2)' }}>
                {submittedCount}/{activePlayers.length} submitted
              </p>
              <div className="space-y-2">
                {players.map(p => (
                  <div key={p.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-sm flex-1">{p.empire}</span>
                    {p.status === 'eliminated' ? (
                      <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>ELIMINATED</span>
                    ) : submittedNames.has(p.name) ? (
                      <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>SUBMITTED</span>
                    ) : (
                      <span className="badge badge-neutral" style={{ fontSize: '0.6rem' }}>PENDING</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <p className="label mb-3">Empire Roster</p>
              <div className="space-y-2">
                {players.filter(p => p.status === 'active').map(p => (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span style={{ color: 'var(--text)' }}>{p.empire}</span>
                    <span style={{ color: 'var(--text2)' }}>({p.name})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* War Chest */}
            {warChest && (
              <div className="card space-y-3">
                <p className="label mb-1">Community War Chest</p>
                <div className="flex justify-between items-end">
                  <span className="text-lg font-bold display-font" style={{ color: warChest.balance >= warChest.threshold ? 'var(--success)' : 'var(--accent)' }}>
                    ${warChest.balance.toFixed(2)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text2)' }}>/ ${warChest.threshold.toFixed(2)}</span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (warChest.balance / Math.max(0.01, warChest.threshold)) * 100)}%`,
                      background: warChest.balance >= warChest.threshold ? 'var(--success)' : 'var(--accent)',
                    }}
                  />
                </div>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>
                  {warChest.balance >= warChest.threshold
                    ? 'Threshold met — GM can process turn'
                    : `$${(warChest.threshold - warChest.balance).toFixed(2)} more needed to run next turn`}
                </p>
                {warChest.contributions.length > 0 && (
                  <div className="space-y-1">
                    <p className="label" style={{ fontSize: '0.6rem' }}>Recent Contributors</p>
                    {[...warChest.contributions].reverse().slice(0, 5).map((c, i) => (
                      <p key={i} className="text-xs" style={{ color: 'var(--text2)' }}>{c.name} — ${Number(c.amount).toFixed(2)}</p>
                    ))}
                  </div>
                )}
                {countdown > 0 && (
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>
                    Next turn in: {Math.floor(countdown / 3600000)}h {Math.floor((countdown % 3600000) / 60000)}m
                  </p>
                )}
              </div>
            )}
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
