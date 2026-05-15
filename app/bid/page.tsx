'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { COUNTRIES } from '@/lib/constants';

interface Session { playerName: string; empireName: string; color: string; sessionToken: string; status: string; }
interface BidEntry { playerName: string; empireName: string; amount: number; }
interface BidState { bids: Record<string, BidEntry>; points: Record<string, number>; open: boolean; closesAt: number | null; }

export default function BidPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [bidState, setBidState] = useState<BidState | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidCountry, setBidCountry] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [bidMessage, setBidMessage] = useState('');
  const [bidSearch, setBidSearch] = useState('');
  const [countdown, setCountdown] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const loadBidState = useCallback(async () => {
    const r = await fetch('/api/bidding/state');
    if (r.ok) { const d = await r.json(); setBidState(d); }
  }, []);

  // Load session + initial bidding state
  useEffect(() => {
    const stored = localStorage.getItem('empires-player');
    if (stored) {
      try { const s = JSON.parse(stored); setSession(s); sessionRef.current = s; } catch {}
    }
    loadBidState().finally(() => setLoading(false));
  }, [loadBidState]);

  // Poll bidding state every 8s
  useEffect(() => {
    pollRef.current = setInterval(loadBidState, 8_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadBidState]);

  // Countdown ticker
  useEffect(() => {
    if (!bidState?.closesAt) { setCountdown(''); return; }
    const tick = () => {
      const ms = (bidState.closesAt ?? 0) - Date.now();
      if (ms <= 0) { setCountdown('CLOSED'); return; }
      const s = Math.floor(ms / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      setCountdown(h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [bidState?.closesAt]);

  async function placeBid() {
    const sess = sessionRef.current;
    if (!sess) return;
    const amount = parseInt(bidAmount);
    if (!bidCountry || isNaN(amount) || amount < 10) {
      setBidMessage('Select a country and enter an amount (min 10).');
      return;
    }
    setBidding(true);
    setBidMessage('');
    const r = await fetch('/api/bidding/bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.sessionToken}` },
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

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // ── Not logged in ────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-sm w-full text-center space-y-4">
          <p className="display-font text-xl font-black" style={{ color: 'var(--accent)' }}>LOGIN REQUIRED</p>
          <p style={{ color: 'var(--text2)' }}>You must be logged in to place bids.</p>
          <Link href="/login" className="btn-primary inline-block">Empire Login →</Link>
        </div>
      </div>
    );
  }

  // ── Bidding not open ─────────────────────────────────────────────────────
  if (!bidState?.open) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-sm w-full text-center space-y-4">
          <p className="display-font text-xl font-black" style={{ color: 'var(--text2)' }}>BIDDING IS CLOSED</p>
          <p style={{ color: 'var(--text2)' }}>Territory bidding is not currently active.</p>
          <Link href="/results" className="btn-ghost inline-block">← Back to Results</Link>
        </div>
      </div>
    );
  }

  // ── Bidding UI ───────────────────────────────────────────────────────────
  // allBids: Record<string, Bid[]> — each country has an array of tied top-bidders
  const allBids = bidState.bids as unknown as Record<string, Array<{ playerName: string; empireName: string; amount: number }>>;
  const myPoints = bidState.points[session.playerName] ?? 100;

  // Countries where I'm in the top-bid array
  const myBids = Object.entries(allBids).filter(([, bidders]) =>
    Array.isArray(bidders) && bidders.some(b => b.playerName === session.playerName)
  );

  const filteredCountries = bidSearch
    ? COUNTRIES.filter(c => c.toLowerCase().includes(bidSearch.toLowerCase()))
    : [];

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="display-font text-2xl font-black" style={{ color: 'var(--accent)' }}>
              TERRITORY BIDDING
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
              <span style={{ color: session.color }}>{session.empireName}</span>
              {' '}— bid points to claim starting territories.
              The GM assigns territories when bidding closes.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs" style={{ color: 'var(--text2)' }}>Your points</p>
            <p className="text-3xl font-black font-mono" style={{ color: myPoints > 0 ? 'var(--accent)' : 'var(--danger)' }}>{myPoints}</p>
            {countdown && (
              <p className="text-xs font-mono mt-1" style={{ color: countdown === 'CLOSED' ? 'var(--danger)' : 'var(--text2)' }}>
                {countdown === 'CLOSED' ? '⏱ Bidding closed' : `⏱ ${countdown} remaining`}
              </p>
            )}
          </div>
        </div>

        {/* Your active bids */}
        {myBids.length > 0 && (
          <div className="card space-y-2">
            <p className="label">Your Active Bids</p>
            <div className="space-y-1">
              {myBids.sort(([a], [b]) => a.localeCompare(b)).map(([country, bidders]) => {
                const topAmount = bidders[0]?.amount ?? 0;
                const isTied = bidders.length > 1;
                return (
                  <div key={country} className="flex items-center justify-between text-sm py-1" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text)' }}>{country}</span>
                    <span className="font-mono font-semibold" style={{ color: isTied ? '#f59e0b' : '#22c55e' }}>
                      {topAmount} pts — {isTied ? `⚖ tied (${bidders.length}-way split)` : 'leading'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All current bids */}
        {Object.keys(allBids).length > 0 && (
          <div className="card space-y-2">
            <p className="label">All Current Bids — {Object.keys(allBids).length} countries</p>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ background: 'var(--surface)' }}>
                  <tr style={{ color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left py-1.5 pr-3 font-semibold">Country</th>
                    <th className="text-left py-1.5 pr-3 font-semibold">Leader</th>
                    <th className="text-right py-1.5 font-semibold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(allBids).sort(([a], [b]) => a.localeCompare(b)).map(([country, bidders]) => {
                    const topAmount = bidders[0]?.amount ?? 0;
                    const iAmIn = bidders.some(b => b.playerName === session.playerName);
                    const isTied = bidders.length > 1;
                    return (
                      <tr
                        key={country}
                        className="cursor-pointer"
                        style={{ borderBottom: '1px solid var(--border)', background: iAmIn ? (isTied ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)') : 'transparent' }}
                        onClick={() => { setBidCountry(country); setBidAmount(String(topAmount + 10)); setBidSearch(''); }}
                      >
                        <td className="py-1.5 pr-3" style={{ color: 'var(--text)' }}>{country}</td>
                        <td className="py-1.5 pr-3" style={{ color: iAmIn ? (isTied ? '#f59e0b' : '#22c55e') : 'var(--text2)' }}>
                          {isTied
                            ? (iAmIn ? `⚖ You + ${bidders.length - 1} tied` : `⚖ ${bidders.length}-way tie`)
                            : (iAmIn ? '✓ You' : bidders[0]?.empireName ?? '')}
                        </td>
                        <td className="py-1.5 text-right font-mono" style={{ color: 'var(--text)' }}>{topAmount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs" style={{ color: 'var(--text2)' }}>Click any row to bid on that country.</p>
          </div>
        )}

        {/* Place a bid */}
        <div className="card space-y-4">
          <p className="label">Place a Bid</p>

          <input
            className="input text-sm"
            placeholder="Search any country…"
            value={bidSearch}
            onChange={e => { setBidSearch(e.target.value); setBidCountry(''); }}
          />

          {filteredCountries.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredCountries.slice(0, 20).map(country => {
                const bidders = allBids[country];
                const topAmount = bidders?.[0]?.amount ?? 0;
                const iAmIn = bidders?.some(b => b.playerName === session.playerName) ?? false;
                const isTied = (bidders?.length ?? 0) > 1;
                return (
                  <button
                    key={country}
                    onClick={() => { setBidCountry(country); setBidAmount(bidders ? String(topAmount + 10) : '10'); setBidSearch(''); }}
                    className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
                    style={{
                      background: bidCountry === country ? `${session.color}22` : 'var(--surface2)',
                      border: `1px solid ${bidCountry === country ? session.color : 'var(--border)'}`,
                      color: 'var(--text)',
                    }}
                  >
                    <span className="font-semibold">{country}</span>
                    {bidders && bidders.length > 0 ? (
                      <span className="ml-2 text-xs" style={{ color: iAmIn ? (isTied ? '#f59e0b' : '#22c55e') : 'var(--text2)' }}>
                        {isTied
                          ? (iAmIn ? `⚖ You + ${bidders.length - 1} tied at ${topAmount} pts` : `⚖ ${bidders.length}-way tie at ${topAmount} pts`)
                          : (iAmIn ? `✓ You lead — ${topAmount} pts` : `${bidders[0]?.empireName} leads — ${topAmount} pts`)}
                      </span>
                    ) : (
                      <span className="ml-2 text-xs" style={{ color: 'var(--text2)' }}>No bids yet</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {bidCountry && (
            <div className="space-y-3 pt-1">
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-32">
                  <label className="label">
                    Bidding on: <span style={{ color: 'var(--accent)' }}>{bidCountry}</span>
                    {(() => {
                      const leaders = allBids[bidCountry] ?? [];
                      const topAmt = leaders[0]?.amount ?? 0;
                      const iAmIn = leaders.some(b => b.playerName === session.playerName);
                      const isTied = leaders.length > 1;
                      if (leaders.length === 0) return null;
                      if (iAmIn && isTied) return <span className="ml-2 text-xs font-normal" style={{ color: '#f59e0b' }}>⚖ you&apos;re in a {leaders.length}-way tie at {topAmt} pts — bid higher to lead alone</span>;
                      if (iAmIn) return <span className="ml-2 text-xs font-normal" style={{ color: '#22c55e' }}>✓ you lead</span>;
                      return <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text2)' }}>(match {topAmt} to tie, beat it to lead)</span>;
                    })()}
                  </label>
                  <input
                    type="number"
                    className="input text-sm"
                    placeholder="Amount (min 10)"
                    min={10}
                    max={myPoints + ((allBids[bidCountry] ?? []).some(b => b.playerName === session.playerName) ? (allBids[bidCountry]?.[0]?.amount ?? 0) : 0)}
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && placeBid()}
                    autoFocus
                  />
                </div>
                <button className="btn-primary" onClick={placeBid} disabled={bidding || myPoints <= 0}>
                  {bidding ? 'Placing…' : 'Place Bid'}
                </button>
                <button className="btn-ghost text-sm" onClick={() => { setBidCountry(''); setBidAmount(''); }}>Cancel</button>
              </div>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                You have <strong style={{ color: 'var(--accent)' }}>{myPoints} pts</strong> remaining.
              </p>
            </div>
          )}

          {bidMessage && (
            <p className="text-sm font-mono" style={{ color: bidMessage.startsWith('Error') ? 'var(--danger)' : '#22c55e' }}>
              {bidMessage}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Link href="/results" className="btn-ghost text-sm">← Results</Link>
          <Link href="/submit" className="btn-ghost text-sm">Submit Actions →</Link>
        </div>

      </div>
    </div>
  );
}
