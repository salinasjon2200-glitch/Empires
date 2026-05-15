'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Contribution {
  name: string;
  amount: number;
  method: 'manual' | 'stripe' | 'deduction';
  timestamp: number;
}

interface WarChest {
  balance: number;
  threshold: number;
  contributions: Contribution[];
  lastTurnCost: number;
  lastUpdated: number;
}

const PATREON_URL = 'https://www.patreon.com/c/empires438/posts';

export default function WarChestPage() {
  const [warChest, setWarChest] = useState<WarChest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/war-chest')
      .then(r => r.json())
      .then(d => { setWarChest(d.warChest); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pct = warChest ? Math.min(100, (warChest.balance / Math.max(0.01, warChest.threshold)) * 100) : 0;
  const met = warChest ? warChest.balance >= warChest.threshold : false;

  const sorted = warChest ? [...warChest.contributions].reverse() : [];
  const totalContributions = warChest?.contributions.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0) ?? 0;
  const totalDeductions = warChest?.contributions.filter(c => c.amount < 0).reduce((s, c) => s + Math.abs(c.amount), 0) ?? 0;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="display-font text-3xl font-black" style={{ color: 'var(--accent)' }}>
              💰 COMMUNITY WAR CHEST
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
              Community contributions fund each turn of the game.
            </p>
          </div>
          <Link href="/submit" className="btn-ghost text-sm">← Back</Link>
        </div>

        {/* Patreon CTA */}
        <div className="card space-y-3">
          <a
            href={PATREON_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 transition-colors"
            style={{ textDecoration: 'none' }}
          >
            <div className="text-3xl flex-shrink-0">🎖️</div>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>Support on Patreon</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                Contributions go directly toward running the next turn. Every dollar counts.
              </p>
            </div>
            <span className="text-sm flex-shrink-0 font-semibold" style={{ color: 'var(--accent)' }}>Contribute →</span>
          </a>
          <div className="rounded px-3 py-2 text-xs space-y-1" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <p className="font-semibold" style={{ color: 'var(--accent)' }}>⚠️ Important — after contributing:</p>
            <p style={{ color: 'var(--text2)' }}>
              Your contribution will <strong>not</strong> appear in the War Chest immediately.
              Please <strong>message the GM in chat</strong> with your Patreon account name so we can verify your payment.
              Funds will be added to the War Chest <strong>within 24 hours</strong>.
            </p>
          </div>
        </div>

        {/* Balance card */}
        {loading ? (
          <div className="card text-center py-8" style={{ color: 'var(--text2)' }}>Loading…</div>
        ) : warChest ? (
          <>
            <div className="card space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="label mb-1">Current Balance</p>
                  <span className="display-font text-4xl font-black" style={{ color: met ? 'var(--success)' : 'var(--accent)' }}>
                    ${warChest.balance.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>Turn threshold</p>
                  <span className="text-xl font-bold">${warChest.threshold.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="rounded-full overflow-hidden" style={{ height: 10, background: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: met ? 'var(--success)' : 'var(--accent)' }}
                  />
                </div>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>
                  {met
                    ? '✅ Threshold met — GM can process the next turn'
                    : `$${(warChest.threshold - warChest.balance).toFixed(2)} more needed to unlock next turn`}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="text-center">
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>Total raised</p>
                  <p className="font-bold" style={{ color: 'var(--success)' }}>${totalContributions.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>Total spent</p>
                  <p className="font-bold" style={{ color: 'var(--danger)' }}>${totalDeductions.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>Last turn cost</p>
                  <p className="font-bold">${warChest.lastTurnCost.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Full transaction history */}
            <div className="card space-y-3">
              <p className="label">Transaction History</p>
              {sorted.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text2)' }}>No transactions yet.</p>
              ) : (
                <div className="space-y-2">
                  {sorted.map((c, i) => {
                    const isDeduction = c.amount < 0;
                    const date = new Date(c.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    const time = new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2 rounded"
                        style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                      >
                        <span className="text-base flex-shrink-0">
                          {isDeduction ? '💸' : c.method === 'stripe' ? '💳' : '💵'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text2)' }}>{date} at {time}</p>
                        </div>
                        <span
                          className="text-sm font-bold flex-shrink-0"
                          style={{ color: isDeduction ? 'var(--danger)' : 'var(--success)' }}
                        >
                          {isDeduction ? '-' : '+'}${Math.abs(c.amount).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="card text-center py-8 text-sm" style={{ color: 'var(--text2)' }}>
            Could not load war chest data.
          </div>
        )}

        {/* Bottom Patreon nudge */}
        <div className="text-center space-y-2 pb-8">
          <p className="text-sm" style={{ color: 'var(--text2)' }}>Want to keep the game running?</p>
          <a
            href={PATREON_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-block"
            style={{ textDecoration: 'none' }}
          >
            🎖️ Support on Patreon
          </a>
        </div>

      </div>
    </div>
  );
}
