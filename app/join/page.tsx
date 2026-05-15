'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { COUNTRIES } from '@/lib/constants';

type Step = 'register' | 'bid' | 'claim' | 'done';

interface BidEntry { playerName: string; empireName: string; amount: number; }
interface BidState { bids: Record<string, BidEntry>; points: Record<string, number>; open: boolean; closesAt: number | null; }

export default function JoinPage() {
  const [step, setStep] = useState<Step>('register');

  // Step 1 — registration
  const [name, setName] = useState('');
  const [empire, setEmpire] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Shared post-registration
  const [sessionToken, setSessionToken] = useState('');
  const [empireName, setEmpireName] = useState('');
  const [color, setColor] = useState('');

  // Step 2a — bidding
  const [bidState, setBidState] = useState<BidState | null>(null);
  const [bidCountry, setBidCountry] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [bidMessage, setBidMessage] = useState('');
  const [bidSearch, setBidSearch] = useState('');
  const [bidCountdown, setBidCountdown] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 2b — territory claim (non-bidding games)
  const [unclaimed, setUnclaimed] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [claimSearch, setClaimSearch] = useState('');
  const [claiming, setClaiming] = useState(false);

  // ── Bidding state loader ────────────────────────────────────────────────
  const loadBidState = useCallback(async () => {
    const r = await fetch('/api/bidding/state');
    if (r.ok) { const d = await r.json(); setBidState(d); return d as BidState; }
    return null;
  }, []);

  // Load bidding state on mount so we know immediately whether bidding is live
  useEffect(() => { loadBidState(); }, [loadBidState]);

  // Poll while on bid step
  useEffect(() => {
    if (step !== 'bid') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(loadBidState, 8_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, loadBidState]);

  // Countdown ticker for bidding deadline
  useEffect(() => {
    if (!bidState?.closesAt) { setBidCountdown(''); return; }
    const tick = () => {
      const ms = (bidState.closesAt ?? 0) - Date.now();
      if (ms <= 0) { setBidCountdown('CLOSED'); return; }
      const totalSec = Math.floor(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setBidCountdown(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [bidState?.closesAt]);

  // ── Registration ────────────────────────────────────────────────────────
  async function register() {
    if (!name.trim() || !empire.trim() || !password.trim() || !joinCode.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    const r = await fetch('/api/game/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', name, empire, password, email, joinCode }),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error ?? 'Registration failed'); setLoading(false); return; }

    setSessionToken(d.sessionToken);
    setEmpireName(d.empire);
    setColor(d.color);
    setUnclaimed(d.unclaimed ?? []);
    localStorage.setItem('empires-player', JSON.stringify({
      playerName: d.name,
      empireName: d.empire,
      color: d.color,
      sessionToken: d.sessionToken,
      status: 'active',
    }));

    setLoading(false);
    setStep('claim');
  }

  // ── Place a bid ─────────────────────────────────────────────────────────
  async function placeBid() {
    const amount = parseInt(bidAmount);
    if (!bidCountry || isNaN(amount) || amount < 10) {
      setBidMessage('Select a country and enter an amount (min 10).');
      return;
    }
    setBidding(true);
    setBidMessage('');
    const r = await fetch('/api/bidding/bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ country: bidCountry, amount }),
    });
    const d = await r.json();
    if (!r.ok) {
      setBidMessage(`Error: ${d.error ?? 'Bid failed'}`);
    } else {
      setBidMessage(`✓ Bid placed on ${bidCountry} for ${amount} pts. Remaining: ${d.remainingPoints} pts`);
      setBidCountry('');
      setBidAmount('');
      await loadBidState();
    }
    setBidding(false);
  }

  // ── Claim territories (non-bidding path) ────────────────────────────────
  function toggleCountry(country: string) {
    setSelected(prev =>
      prev.includes(country) ? prev.filter(c => c !== country)
        : prev.length < 5 ? [...prev, country] : prev
    );
  }

  async function claimTerritories() {
    setClaiming(true);
    setError('');
    const r = await fetch('/api/game/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claim', sessionToken, territories: selected }),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error ?? 'Failed to claim territories'); setClaiming(false); return; }
    setStep('done');
    setClaiming(false);
  }

  // ── Done ────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-5xl">🏛️</div>
          <h1 className="display-font text-3xl font-black" style={{ color: 'var(--accent)' }}>
            EMPIRE ESTABLISHED
          </h1>
          <p style={{ color: 'var(--text2)' }}>
            <span style={{ color }}>{empireName}</span> is ready for war.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/submit" className="btn-primary">Declare Actions →</Link>
            <Link href="/results" className="btn-ghost">View World</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Live Bidding Step ────────────────────────────────────────────────────
  if (step === 'bid') {
    const myPoints = bidState?.points[name] ?? 100;
    // allBids: Record<string, Bid[]> — each country maps to tied top-bidders
    const allBids = (bidState?.bids ?? {}) as unknown as Record<string, Array<{ playerName: string; empireName: string; amount: number }>>;
    const myBids = Object.entries(allBids).filter(([, bidders]) =>
      Array.isArray(bidders) && bidders.some(b => b.playerName === name)
    );
    // Search the full country list, not just countries with bids
    const filtered = bidSearch
      ? COUNTRIES.filter(c => c.toLowerCase().includes(bidSearch.toLowerCase()))
      : [];

    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="display-font text-2xl font-black" style={{ color: 'var(--accent)' }}>
                TERRITORY BIDDING
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
                Bid points to claim starting territories. You begin with <strong>100 points</strong>.
                The GM will confirm assignments when bidding closes.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--text2)' }}>Your points</p>
              <p className="text-2xl font-black font-mono" style={{ color: 'var(--accent)' }}>{myPoints}</p>
              {bidCountdown && (
                <p className="text-xs font-mono mt-1" style={{ color: bidCountdown === 'CLOSED' ? 'var(--danger)' : 'var(--text2)' }}>
                  {bidCountdown === 'CLOSED' ? 'Bidding closed' : `Closes in ${bidCountdown}`}
                </p>
              )}
            </div>
          </div>

          {/* Your current bids */}
          {myBids.length > 0 && (
            <div className="card space-y-2">
              <p className="label">Your Active Bids</p>
              {myBids.map(([country, bidders]) => {
                const topAmt = bidders[0]?.amount ?? 0;
                const isTied = bidders.length > 1;
                return (
                  <div key={country} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text)' }}>{country}</span>
                    <span className="font-mono font-semibold" style={{ color: isTied ? '#f59e0b' : 'var(--accent)' }}>
                      {topAmt} pts{isTied ? ` ⚖ ${bidders.length}-way tie` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Place a bid */}
          <div className="card space-y-4">
            <p className="label">Place a Bid</p>
            <div className="space-y-2">
              <input
                className="input text-sm"
                placeholder="Search all countries…"
                value={bidSearch}
                onChange={e => { setBidSearch(e.target.value); setBidCountry(''); }}
              />
              {/* Country list — all bids + search results */}
              <div className="max-h-72 overflow-y-auto space-y-1">
                {/* Show countries with bids first if no search */}
                {!bidSearch && Object.entries(allBids).sort(([a], [b]) => a.localeCompare(b)).map(([country, bidders]) => {
                  const topAmt = bidders[0]?.amount ?? 0;
                  const iAmIn = bidders.some(b => b.playerName === name);
                  const isTied = bidders.length > 1;
                  return (
                    <button
                      key={country}
                      onClick={() => { setBidCountry(country); setBidAmount(String(topAmt + 10)); }}
                      className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
                      style={{
                        background: bidCountry === country ? `${color}22` : iAmIn ? (isTied ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)') : 'var(--surface2)',
                        border: `1px solid ${bidCountry === country ? color : iAmIn ? (isTied ? '#f59e0b' : '#22c55e') : 'var(--border)'}`,
                        color: 'var(--text)',
                      }}
                    >
                      <span className="font-semibold">{country}</span>
                      <span className="ml-2 text-xs" style={{ color: iAmIn ? (isTied ? '#f59e0b' : '#22c55e') : 'var(--text2)' }}>
                        {isTied
                          ? (iAmIn ? `⚖ You + ${bidders.length - 1} tied at ${topAmt} pts` : `⚖ ${bidders.length}-way tie at ${topAmt} pts`)
                          : (iAmIn ? `✓ You lead — ${topAmt} pts` : `${bidders[0]?.empireName} leads — ${topAmt} pts`)}
                      </span>
                    </button>
                  );
                })}
                {/* Search results — all countries from COUNTRIES list */}
                {bidSearch && filtered.map(country => {
                  const bidders = allBids[country];
                  const topAmt = bidders?.[0]?.amount ?? 0;
                  const iAmIn = bidders?.some(b => b.playerName === name) ?? false;
                  const isTied = (bidders?.length ?? 0) > 1;
                  return (
                    <button
                      key={country}
                      onClick={() => { setBidCountry(country); setBidAmount(bidders ? String(topAmt + 10) : '10'); }}
                      className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
                      style={{
                        background: bidCountry === country ? `${color}22` : 'var(--surface2)',
                        border: `1px solid ${bidCountry === country ? color : 'var(--border)'}`,
                        color: 'var(--text)',
                      }}
                    >
                      <span className="font-semibold">{country}</span>
                      {bidders && bidders.length > 0 ? (
                        <span className="ml-2 text-xs" style={{ color: iAmIn ? (isTied ? '#f59e0b' : '#22c55e') : 'var(--text2)' }}>
                          {isTied
                            ? (iAmIn ? `⚖ You + ${bidders.length - 1} tied at ${topAmt} pts` : `⚖ ${bidders.length}-way tie at ${topAmt} pts`)
                            : (iAmIn ? `✓ You lead — ${topAmt} pts` : `${bidders[0]?.empireName} — ${topAmt} pts`)}
                        </span>
                      ) : (
                        <span className="ml-2 text-xs" style={{ color: 'var(--text2)' }}>No bids yet</span>
                      )}
                    </button>
                  );
                })}
                {bidSearch && filtered.length === 0 && (
                  <p className="text-sm px-3 py-2" style={{ color: 'var(--text2)' }}>No countries match "{bidSearch}"</p>
                )}
              </div>
            </div>

            {bidCountry && (
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-32">
                  <label className="label">Bidding on: <span style={{ color: 'var(--accent)' }}>{bidCountry}</span></label>
                  <input
                    type="number"
                    className="input text-sm"
                    placeholder="Bid amount (min 10)"
                    min={10}
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && placeBid()}
                  />
                </div>
                <button className="btn-primary" onClick={placeBid} disabled={bidding}>
                  {bidding ? 'Placing…' : 'Place Bid'}
                </button>
                <button className="btn-ghost text-sm" onClick={() => { setBidCountry(''); setBidAmount(''); }}>
                  Cancel
                </button>
              </div>
            )}

            {bidMessage && (
              <p className="text-sm font-mono" style={{ color: bidMessage.startsWith('Error') ? 'var(--danger)' : '#22c55e' }}>
                {bidMessage}
              </p>
            )}
          </div>

          <div className="card space-y-2" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text2)' }}>All searches work — type any country name</p>
            <p className="text-xs" style={{ color: 'var(--text2)' }}>
              Territory assignment happens when the GM closes and confirms bidding.
              Ties are split between empires. You can keep bidding until the timer runs out.
            </p>
            <button
              className="btn-ghost w-full text-sm mt-2"
              onClick={() => setStep('done')}
            >
              I&apos;m done bidding — go to my empire →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Claim Step (non-bidding) ─────────────────────────────────────────────
  if (step === 'claim') {
    const filtered = unclaimed.filter(c => c.toLowerCase().includes(claimSearch.toLowerCase()));
    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="display-font text-2xl font-black" style={{ color: 'var(--accent)' }}>
              CLAIM YOUR STARTING TERRITORIES
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
              Choose up to <strong>5 unclaimed countries</strong> to start your empire.
              <span style={{ color }} className="ml-2 font-semibold">{empireName}</span>
            </p>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <p className="label">Selected: {selected.length} / 5</p>
              {selected.length > 0 && (
                <button className="text-xs" style={{ color: 'var(--text2)' }} onClick={() => setSelected([])}>Clear all</button>
              )}
            </div>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.map(c => (
                  <span key={c} className="badge badge-success cursor-pointer" onClick={() => toggleCountry(c)} title="Click to remove">
                    {c} ✕
                  </span>
                ))}
              </div>
            )}

            <input
              className="input text-sm"
              placeholder="Search countries..."
              value={claimSearch}
              onChange={e => setClaimSearch(e.target.value)}
            />

            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filtered.map(country => {
                const isSelected = selected.includes(country);
                const isFull = selected.length >= 5 && !isSelected;
                return (
                  <button
                    key={country}
                    onClick={() => !isFull && toggleCountry(country)}
                    disabled={isFull}
                    className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
                    style={{
                      background: isSelected ? `${color}22` : 'var(--surface2)',
                      border: `1px solid ${isSelected ? color : 'var(--border)'}`,
                      color: isFull ? 'var(--text2)' : 'var(--text)',
                      opacity: isFull ? 0.5 : 1,
                      cursor: isFull ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isSelected && <span className="mr-2" style={{ color }}>✓</span>}
                    {country}
                  </button>
                );
              })}
            </div>

            {error && <p className="danger text-sm">{error}</p>}

            <button className="btn-primary w-full" onClick={claimTerritories} disabled={claiming || selected.length === 0}>
              {claiming ? 'Claiming...' : `Claim ${selected.length} Territor${selected.length === 1 ? 'y' : 'ies'}`}
            </button>
            <button className="w-full text-xs" style={{ color: 'var(--text2)' }} onClick={() => setStep('done')}>
              Skip for now →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Register Step ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6">
        <div>
          <h1 className="display-font text-3xl font-black" style={{ color: 'var(--accent)' }}>
            JOIN EMPIRES
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
            Enter the join code you received, choose your empire name, and set a password.
          </p>
        </div>

        {/* Live bidding banner */}
        {bidState?.open && (
          <div className="card flex items-center gap-3" style={{ borderColor: 'var(--accent)', background: 'rgba(0,212,255,0.06)' }}>
            <span className="inline-block w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: 'var(--accent)' }} />
            <div>
              <p className="text-sm font-bold display-font" style={{ color: 'var(--accent)', letterSpacing: '0.06em' }}>
                LIVE BIDDING IN PROGRESS
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                Register below to join the bidding round. You will receive 100 points to bid on territories.
                {bidState.closesAt && (
                  <span className="ml-1">Closes in {bidCountdown}.</span>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="card space-y-4">
          <div className="space-y-3">
            <input className="input" placeholder="Your name *" value={name} onChange={e => setName(e.target.value)} />
            <input className="input" placeholder="Empire name *" value={empire} onChange={e => setEmpire(e.target.value)} />
            <input
              className="input" type="password" placeholder="Set your empire password *"
              value={password} onChange={e => setPassword(e.target.value)}
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
            />
            <input className="input" type="email" placeholder="Your email (optional)" value={email} onChange={e => setEmail(e.target.value)} />
            <input
              className="input" placeholder="Join code *" value={joinCode} onChange={e => setJoinCode(e.target.value)}
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              onKeyDown={e => e.key === 'Enter' && register()}
            />
          </div>

          {error && <p className="danger text-sm">{error}</p>}

          <button className="btn-primary w-full" onClick={register} disabled={loading}>
            {loading ? 'Joining...' : 'Join Game'}
          </button>

          <p className="text-xs text-center" style={{ color: 'var(--text2)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--accent)' }}>Login →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
