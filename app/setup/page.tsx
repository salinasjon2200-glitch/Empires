'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { COUNTRIES } from '@/lib/constants';

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false });

interface Bid {
  playerName: string;
  empireName: string;
  color: string;
  amount: number;
  placedAt: number;
}

interface BidState { [country: string]: Bid | null; }
interface PlayerPoints { [name: string]: number; }

export default function SetupPage() {
  const [session, setSession] = useState<{ playerName: string; empireName: string; color: string; sessionToken: string } | null>(null);
  const [bids, setBids] = useState<BidState>({});
  const [points, setPoints] = useState<PlayerPoints>({});
  const [open, setOpen] = useState(false);
  const [closesAt, setClosesAt] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});
  const [feed, setFeed] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());

  // GM state
  const [gmPassword, setGmPassword] = useState('');
  const [gmAuthed, setGmAuthed] = useState(false);
  const [gmTimerMin, setGmTimerMin] = useState(10);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newEmpireName, setNewEmpireName] = useState('');
  const [newEmpirePassword, setNewEmpirePassword] = useState('');
  const [players, setPlayers] = useState<{ name: string; empire: string; color: string }[]>([]);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('empires-player');
    if (stored) try { setSession(JSON.parse(stored)); } catch {}
    const gmStored = localStorage.getItem('empires-gm');
    if (gmStored === process.env.NEXT_PUBLIC_GM_HINT || gmStored) setGmAuthed(true);
  }, []);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll bidding state every 2s
  useEffect(() => {
    const poll = async () => {
      const r = await fetch('/api/bidding/state');
      if (r.ok) {
        const d = await r.json();
        setBids(d.bids ?? {});
        setPoints(d.points ?? {});
        setOpen(d.open ?? false);
        setClosesAt(d.closesAt ?? null);
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  // Load players (GM)
  const loadPlayers = useCallback(async () => {
    if (!gmAuthed) return;
    const r = await fetch('/api/game/setup', { headers: { 'Authorization': `Bearer ${gmPassword}` } });
    if (r.ok) {
      const d = await r.json();
      setPlayers(d.players ?? []);
    }
  }, [gmAuthed, gmPassword]);

  useEffect(() => { loadPlayers(); }, [loadPlayers]);

  async function gmLogin() {
    const r = await fetch('/api/auth/gm-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: gmPassword }),
    });
    if (r.ok) {
      setGmAuthed(true);
      localStorage.setItem('empires-gm', gmPassword);
      loadPlayers();
    } else alert('Invalid GM password');
  }

  async function registerPlayer() {
    setRegistering(true);
    const r = await fetch('/api/game/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gmPassword}` },
      body: JSON.stringify({ name: newPlayerName, empire: newEmpireName, password: newEmpirePassword }),
    });
    if (r.ok) {
      setNewPlayerName(''); setNewEmpireName(''); setNewEmpirePassword('');
      loadPlayers();
    } else {
      const d = await r.json();
      alert(d.error ?? 'Failed');
    }
    setRegistering(false);
  }

  async function openBidding() {
    await fetch('/api/bidding/close', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gmPassword}` },
      body: JSON.stringify({ openMinutes: gmTimerMin }),
    });
  }

  async function closeBidding() {
    await fetch('/api/bidding/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gmPassword}` },
      body: JSON.stringify({ action: 'close' }),
    });
  }

  async function confirmBidding() {
    const r = await fetch('/api/bidding/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gmPassword}` },
      body: JSON.stringify({ action: 'confirm' }),
    });
    if (r.ok) window.location.href = '/submit';
    else alert('Failed to confirm');
  }

  async function placeBid(country: string) {
    if (!session) return;
    const amount = bidAmounts[country];
    if (!amount || amount < 10) return;
    const r = await fetch('/api/bidding/bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.sessionToken}` },
      body: JSON.stringify({ country, amount }),
    });
    const d = await r.json();
    if (!r.ok) { alert(d.error ?? 'Bid failed'); return; }
    setFeed(prev => [`${session.empireName} bid ${amount} on ${country}`, ...prev.slice(0, 19)]);
  }

  const filtered = COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase()));
  const myPoints = session ? (points[session.playerName] ?? 100) : 0;
  const secondsLeft = closesAt ? Math.max(0, Math.floor((closesAt - now) / 1000)) : null;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="display-font text-2xl font-black" style={{ color: 'var(--accent)' }}>TERRITORY BIDDING — PHASE 1</h1>
          <div className="flex items-center gap-4">
            {open && secondsLeft !== null && (
              <div className="display-font text-2xl font-bold" style={{ color: secondsLeft < 60 ? 'var(--danger)' : 'var(--warning)' }}>
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </div>
            )}
            <span className={`badge ${open ? 'badge-success' : 'badge-neutral'}`}>
              {open ? '● BIDDING OPEN' : '○ BIDDING CLOSED'}
            </span>
          </div>
        </div>

        {!open && !session && (
          <div className="card text-center py-12">
            <p className="text-lg" style={{ color: 'var(--text2)' }}>Waiting for GM to open bidding.</p>
            <p className="text-sm mt-2" style={{ color: 'var(--text2)' }}>Please authenticate with your empire password first.</p>
            <a href="/login" className="btn-primary inline-block mt-4">Empire Login</a>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Country list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <WorldMap bids={bids} mode="bidding" height={300} />
            </div>

            <div className="card space-y-3">
              <input className="input" placeholder="Search countries..." value={search} onChange={e => setSearch(e.target.value)} />

              <div className="space-y-1 max-h-96 overflow-y-auto">
                {filtered.map(country => {
                  const bid = bids[country];
                  const isMine = bid?.playerName === session?.playerName;
                  return (
                    <div key={country} className="flex items-center gap-3 px-3 py-2 rounded" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: bid ? bid.color : 'var(--border)' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{country}</div>
                        {bid ? (
                          <div className="text-xs" style={{ color: isMine ? 'var(--success)' : 'var(--text2)' }}>
                            {isMine ? '✓ You — ' : ''}{bid.empireName}: {bid.amount} pts
                          </div>
                        ) : (
                          <div className="text-xs" style={{ color: 'var(--text2)' }}>No bids</div>
                        )}
                      </div>
                      {session && open && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={10}
                            max={myPoints + (isMine ? (bid?.amount ?? 0) : 0)}
                            className="input w-20 text-sm py-1"
                            placeholder="pts"
                            value={bidAmounts[country] ?? ''}
                            onChange={e => setBidAmounts(prev => ({ ...prev, [country]: parseInt(e.target.value) || 0 }))}
                          />
                          <button
                            className="btn-primary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
                            onClick={() => placeBid(country)}
                          >
                            Bid
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Sidebar */}
          <div className="space-y-4">

            {/* Player points */}
            {session && (
              <div className="card">
                <p className="label mb-3">Your Empire</p>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 rounded-full" style={{ background: session.color }} />
                  <span className="font-semibold">{session.empireName}</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text2)' }}>Bid Points</span>
                    <span className="font-bold" style={{ color: 'var(--accent)' }}>{myPoints} / 100</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${myPoints}%` }} />
                  </div>
                </div>
                <div className="mt-3 text-xs" style={{ color: 'var(--text2)' }}>
                  My active bids: {Object.values(bids).filter(b => b?.playerName === session.playerName).length}
                </div>
              </div>
            )}

            {/* All player points */}
            <div className="card">
              <p className="label mb-3">All Players</p>
              <div className="space-y-2">
                {Object.entries(points).map(([name, pts]) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-xs flex-1">{name}</span>
                    <div className="flex-1 progress-bar">
                      <div className="progress-fill" style={{ width: `${pts}%`, background: 'var(--accent)' }} />
                    </div>
                    <span className="text-xs w-8 text-right" style={{ color: 'var(--text2)' }}>{pts}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bid feed */}
            <div className="card">
              <p className="label mb-3">Live Feed</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {feed.length === 0 && <p className="text-xs" style={{ color: 'var(--text2)' }}>No activity yet</p>}
                {feed.map((f, i) => <p key={i} className="text-xs" style={{ color: 'var(--text2)' }}>{f}</p>)}
              </div>
            </div>

            {/* GM panel */}
            {!gmAuthed ? (
              <div className="card space-y-3">
                <p className="label">GM Authentication</p>
                <input type="password" className="input text-sm" placeholder="GM password..." value={gmPassword} onChange={e => setGmPassword(e.target.value)} />
                <button className="btn-primary w-full text-sm" onClick={gmLogin}>Authenticate</button>
              </div>
            ) : (
              <div className="card space-y-4">
                <p className="label">GM Controls</p>

                <div className="space-y-2">
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>Register Player</p>
                  <input className="input text-sm" placeholder="Player name" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} />
                  <input className="input text-sm" placeholder="Empire name" value={newEmpireName} onChange={e => setNewEmpireName(e.target.value)} />
                  <input className="input text-sm" placeholder="Empire password (tell to player)" value={newEmpirePassword} onChange={e => setNewEmpirePassword(e.target.value)} />
                  <button className="btn-primary w-full text-sm" onClick={registerPlayer} disabled={registering}>
                    {registering ? 'Registering...' : 'Register Empire'}
                  </button>
                </div>

                {players.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text2)' }}>Registered ({players.length})</p>
                    {players.map(p => (
                      <div key={p.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                        <span>{p.empire} ({p.name})</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div className="flex items-center gap-2">
                    <select className="input text-sm flex-1" value={gmTimerMin} onChange={e => setGmTimerMin(Number(e.target.value))}>
                      {[5, 10, 15, 20, 30].map(m => <option key={m} value={m}>{m} min</option>)}
                    </select>
                    <button className="btn-primary text-sm" onClick={openBidding} disabled={open}>Open Bidding</button>
                  </div>
                  {open && <button className="btn-danger w-full text-sm" onClick={closeBidding}>Force Close</button>}
                  {!open && Object.keys(bids).length > 0 && (
                    <button className="btn-primary w-full text-sm" onClick={confirmBidding}>
                      Confirm Results & Advance →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
