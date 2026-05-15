'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import ChatSidebar from '@/components/ChatSidebar';
import Link from 'next/link';

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false });

interface Session { playerName: string; empireName: string; color: string; sessionToken: string; status: string; eliminatedYear?: number; isMergedLeader?: boolean; leaderWeight?: number; allLeaders?: { name: string; weight: number }[]; }
interface Player { name: string; empire: string; color: string; status: string; }

export default function SubmitPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [territories, setTerritories] = useState({});
  const [players, setPlayers] = useState<Player[]>([]);
  const [submittedNames, setSubmittedNames] = useState<Set<string>>(new Set());
  const [year, setYear] = useState(2032);
  const [actionText, setActionText] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false); // optimistic flag for this session only
  const yearRef = useRef(2032);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [warChest, setWarChest] = useState<{ balance: number; threshold: number; contributions: Array<{ name: string; amount: number; timestamp: number }>; lastTurnCost: number } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [lastTurnAt, setLastTurnAt] = useState<number | null>(null);
  const [biddingLive, setBiddingLive] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('empires-player');
    if (stored) try { setSession(JSON.parse(stored)); } catch {}

    fetch('/api/bidding/state').then(r => r.ok ? r.json() : null).then(d => { if (d) setBiddingLive(d.open ?? false); }).catch(() => {});

    Promise.all([
      fetch('/api/map/territories').then(r => r.json()),
      fetch('/api/game/players').then(r => r.json()),
      fetch('/api/game/state').then(r => r.json()),
    ]).then(([map, playerData, state]) => {
      setTerritories(map.territories ?? {});
      setPlayers(playerData.players ?? []);
      const yr = state.currentYear ?? 2032;
      setYear(yr);
      yearRef.current = yr;
      if (state.lastTurnCompletedAt) setLastTurnAt(state.lastTurnCompletedAt);

      // Load submission status from server (authoritative — do not use localStorage)
      fetch('/api/turns/status').then(r => r.ok ? r.json() : null).then(d => {
        if (d?.submitted) setSubmittedNames(new Set(d.submitted));
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // Load war chest
  useEffect(() => {
    fetch('/api/war-chest').then(r => r.json()).then(d => setWarChest(d.warChest)).catch(() => {});
  }, []);

  // Poll submission status + year every 15s — server is the only source of truth
  useEffect(() => {
    const poll = async () => {
      try {
        const d = await fetch('/api/turns/status').then(r => r.ok ? r.json() : null);
        if (!d) return;
        setSubmittedNames(new Set(d.submitted ?? []));
        const serverYear: number = d.year ?? yearRef.current;
        if (serverYear !== yearRef.current) {
          // Year has advanced — new turn is open
          yearRef.current = serverYear;
          setYear(serverYear);
          setJustSubmitted(false);
          setActionText('');
          // Refresh map and players for the new year
          const [mapR, playersR] = await Promise.all([
            fetch('/api/map/territories').then(r => r.json()),
            fetch('/api/game/players').then(r => r.json()),
          ]);
          setTerritories(mapR.territories ?? {});
          setPlayers(playersR.players ?? []);
          // Refresh war chest
          fetch('/api/war-chest').then(r => r.json()).then(wc => setWarChest(wc.warChest)).catch(() => {});
        }
      } catch {}
    };
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, []);

  // Countdown interval
  useEffect(() => {
    if (!lastTurnAt) return;
    const interval = setInterval(() => {
      const next3PM = new Date(lastTurnAt); next3PM.setDate(next3PM.getDate() + 1); next3PM.setHours(15, 0, 0, 0);
      const remaining = next3PM.getTime() - Date.now();
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
      if (session) setSubmittedNames(prev => { const s = new Set(Array.from(prev)); s.add(session.playerName); return s; });
      setJustSubmitted(true);
      setEditing(false);
    } else {
      setError(d.error ?? 'Submission failed');
    }
    setLoading(false);
  }

  async function startEditing() {
    if (!session) return;
    setEditing(true);
    if (!actionText.trim()) {
      // Fetch their saved action to pre-fill the textarea
      try {
        const r = await fetch('/api/turns/actions', {
          headers: { 'Authorization': `Bearer ${session.sessionToken}` },
        });
        if (r.ok) {
          const d = await r.json();
          if (d.action) setActionText(d.action);
        }
      } catch {}
    }
  }

  // For merged leaders, submission is tracked under the empire name
  const submissionKey = session?.isMergedLeader ? session.empireName : session?.playerName ?? '';
  const submitted = justSubmitted || (!!session && submittedNames.has(submissionKey));

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
            <Link href="/warchest" className="btn-ghost text-sm">💰 War Chest</Link>
            <Link href="/gm" className="btn-ghost text-sm">GM</Link>
          </div>
        </div>

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

          {/* LEFT: Action submission */}
          <div className="lg:col-span-2 space-y-6">

            {/* World News Report link */}
            <Link href="/news" className="card flex items-center justify-between gap-4 hover:border-accent transition-colors" style={{ textDecoration: 'none' }}>
              <div>
                <p className="label mb-1">🌍 World News Report — Year {year - 1}</p>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>
                  Read the full public summary of last turn — what every empire knows heading into {year}.
                </p>
              </div>
              <span className="text-lg flex-shrink-0" style={{ color: 'var(--accent)' }}>→</span>
            </Link>

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
            ) : submitted && !editing ? (
              <div className="card text-center py-8 space-y-4">
                <div className="text-4xl">✅</div>
                <p className="text-lg font-semibold success">Actions Declared</p>
                {session?.isMergedLeader && (
                  <p className="text-sm" style={{ color: 'var(--text2)' }}>
                    Your orders as <strong>{session.playerName}</strong> (weight: {session.leaderWeight}/100) have been logged.
                  </p>
                )}
                <p style={{ color: 'var(--text2)' }}>Your orders for Year {year} have been logged. Await the GM's processing.</p>
                <button className="btn-ghost text-sm" onClick={startEditing}>
                  ✏️ Edit Actions
                </button>
              </div>
            ) : (
              <div className="card space-y-4">
                {session?.isMergedLeader && (
                  <div className="rounded px-3 py-2 text-sm space-y-1" style={{ background: 'var(--surface2)', border: '1px solid var(--accent)' }}>
                    <p><span style={{ color: 'var(--accent)' }}>⚔️ Merged Empire:</span> <strong>{session.empireName}</strong></p>
                    <p style={{ color: 'var(--text2)' }}>
                      You are <strong>{session.playerName}</strong> — Action Weight: <strong>{session.leaderWeight}/100</strong>
                    </p>
                    {session.allLeaders && session.allLeaders.length > 1 && (
                      <p className="text-xs" style={{ color: 'var(--text2)' }}>
                        Co-leaders: {session.allLeaders.filter(l => l.name !== session.playerName).map(l => `${l.name} (${l.weight}/100)`).join(', ')}
                      </p>
                    )}
                    <p className="text-xs" style={{ color: 'var(--text2)' }}>
                      Where your actions contradict your co-leaders, the higher-weighted leader wins.
                    </p>
                  </div>
                )}
                <p className="label">{editing ? `Edit Your Actions for Year ${year}` : `Declare Your Actions for Year ${year}`}</p>
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
                <div className="flex gap-3">
                  {editing && (
                    <button className="btn-ghost flex-1" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                  )}
                  <button className="btn-primary flex-1" onClick={submitAction} disabled={loading || !actionText.trim()}>
                    {loading ? 'Saving...' : editing ? 'Save Changes' : 'Declare Actions'}
                  </button>
                </div>
                {editing && (
                  <p className="text-xs" style={{ color: 'var(--accent)' }}>⚠️ Saving will overwrite your previous submission.</p>
                )}
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
                <div className="flex items-center justify-between">
                  <p className="label">💰 Community War Chest</p>
                  <Link href="/warchest" className="text-xs" style={{ color: 'var(--accent)' }}>Full history →</Link>
                </div>
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
                    ? '✅ Threshold met — GM can process turn'
                    : `$${(warChest.threshold - warChest.balance).toFixed(2)} more needed to run next turn`}
                </p>
                {countdown > 0 && (
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>
                    Next turn in: {Math.floor(countdown / 3600000)}h {Math.floor((countdown % 3600000) / 60000)}m
                  </p>
                )}
                <a
                  href="https://www.patreon.com/c/empires438/posts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full text-sm text-center block"
                  style={{ textDecoration: 'none' }}
                >
                  🎖️ Support on Patreon
                </a>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>
                  ⚠️ Contributions won't appear immediately — message the GM in chat with your Patreon account name to verify. Funds added within 24 hours.
                </p>
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
