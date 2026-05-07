'use client';
import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import Link from 'next/link';

type Theme = 'dark-military' | 'clean-modern';

export default function VotePage() {
  const { setTheme } = useTheme();
  const [playerName, setPlayerName] = useState('');
  const [tally, setTally] = useState({ 'dark-military': 0, 'clean-modern': 0 });
  const [votes, setVotes] = useState<Record<string, Theme>>({});
  const [voted, setVoted] = useState<Theme | null>(null);
  const [gmPassword, setGmPassword] = useState('');
  const [locking, setLocking] = useState(false);
  const [locked, setLocked] = useState(false);
  const [preview, setPreview] = useState<Theme | null>(null);

  useEffect(() => {
    const poll = () => {
      fetch('/api/vote').then(r => r.json()).then(d => {
        setTally(d.tally);
        setVotes(d.votes ?? {});
      }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  async function vote(theme: Theme) {
    if (!playerName.trim()) { alert('Enter your name first'); return; }
    await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: playerName.trim(), theme }),
    });
    setVoted(theme);
  }

  async function lockTheme() {
    setLocking(true);
    const r = await fetch('/api/vote', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmPassword }),
    });
    const d = await r.json();
    if (r.ok) {
      setTheme(d.theme);
      setLocked(true);
    } else {
      alert(d.error ?? 'Failed');
    }
    setLocking(false);
  }

  const total = tally['dark-military'] + tally['clean-modern'];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center">
          <h1 className="display-font text-3xl font-black mb-2" style={{ color: 'var(--accent)' }}>THEME VOTE</h1>
          <p style={{ color: 'var(--text2)' }}>Choose the visual aesthetic for this game session</p>
        </div>

        <div>
          <label className="label">Your Name</label>
          <input className="input max-w-xs" placeholder="Enter your player name..." value={playerName} onChange={e => setPlayerName(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Dark Military */}
          <div
            className="rounded-lg overflow-hidden cursor-pointer transition-all border-2"
            style={{
              borderColor: voted === 'dark-military' ? '#00d4ff' : preview === 'dark-military' ? '#00d4ff44' : '#1e3a5f',
              background: '#060a0f',
            }}
            onClick={() => vote('dark-military')}
            onMouseEnter={() => setPreview('dark-military')}
            onMouseLeave={() => setPreview(null)}
          >
            <div className="p-6" style={{ background: '#060a0f', color: '#c8dff5', fontFamily: "'Exo 2', sans-serif" }}>
              <div style={{ fontFamily: "'Orbitron', monospace", color: '#00d4ff', fontSize: 14, marginBottom: 8, letterSpacing: '0.1em' }}>DARK MILITARY</div>
              <div style={{ background: '#0d1520', border: '1px solid #1e3a5f', borderRadius: 6, padding: '12px', marginBottom: 8, fontSize: 12 }}>
                <div style={{ color: '#00d4ff', fontSize: 11, marginBottom: 4, fontFamily: "'Orbitron', monospace", letterSpacing: '0.08em' }}>WORLD SUMMARY — TURN 7</div>
                <div style={{ color: '#6a9abf', fontSize: 11, lineHeight: 1.5 }}>The empire deployed its forces to the eastern front, establishing a defensive perimeter…</div>
              </div>
              <div style={{ height: 4, background: '#1e3a5f', borderRadius: 2 }}>
                <div style={{ height: 4, background: '#00d4ff', borderRadius: 2, width: `${(tally['dark-military'] / Math.max(total, 1)) * 100}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: '#6a9abf' }}>{tally['dark-military']} votes</div>
            </div>
          </div>

          {/* Clean Modern */}
          <div
            className="rounded-lg overflow-hidden cursor-pointer transition-all border-2"
            style={{
              borderColor: voted === 'clean-modern' ? '#3b82f6' : preview === 'clean-modern' ? '#3b82f644' : '#e2e8f0',
              background: '#f8fafc',
            }}
            onClick={() => vote('clean-modern')}
            onMouseEnter={() => setPreview('clean-modern')}
            onMouseLeave={() => setPreview(null)}
          >
            <div className="p-6" style={{ background: '#f8fafc', color: '#1e293b', fontFamily: "'Inter', sans-serif" }}>
              <div style={{ fontFamily: "'Inter', sans-serif", color: '#3b82f6', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>CLEAN MODERN</div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px', marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontSize: 12 }}>
                <div style={{ color: '#3b82f6', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>WORLD SUMMARY — TURN 7</div>
                <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.5 }}>The empire deployed its forces to the eastern front, establishing a defensive perimeter…</div>
              </div>
              <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2 }}>
                <div style={{ height: 4, background: '#3b82f6', borderRadius: 2, width: `${(tally['clean-modern'] / Math.max(total, 1)) * 100}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: '#64748b' }}>{tally['clean-modern']} votes</div>
            </div>
          </div>
        </div>

        {voted && <p className="text-center success text-sm">✓ Vote recorded for {voted}</p>}

        {/* Vote list */}
        {Object.keys(votes).length > 0 && (
          <div className="card">
            <p className="label mb-3">Current Votes ({total} total)</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(votes).map(([name, theme]) => (
                <span key={name} className="badge" style={{
                  background: theme === 'dark-military' ? 'rgba(0,212,255,0.1)' : 'rgba(59,130,246,0.1)',
                  color: theme === 'dark-military' ? '#00d4ff' : '#3b82f6',
                }}>
                  {name}: {theme === 'dark-military' ? '🌑' : '☀️'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* GM Lock */}
        <div className="card space-y-4">
          <p className="display-font text-xs tracking-widest uppercase" style={{ color: 'var(--text2)' }}>GM Authentication Required</p>
          {locked ? (
            <p className="success text-sm">✓ Theme locked. <Link href="/setup" style={{ color: 'var(--accent)' }}>Proceed to bidding →</Link></p>
          ) : (
            <div className="flex gap-3">
              <input type="password" className="input" placeholder="GM password..." value={gmPassword} onChange={e => setGmPassword(e.target.value)} />
              <button className="btn-primary" onClick={lockTheme} disabled={locking || !gmPassword}>
                {locking ? '...' : 'Lock Theme & Launch'}
              </button>
            </div>
          )}
        </div>

        <div className="text-center">
          <Link href="/" className="text-xs" style={{ color: 'var(--text2)' }}>← Back</Link>
        </div>
      </div>
    </div>
  );
}
