'use client';
import { useState } from 'react';
import Link from 'next/link';

type Step = 'register' | 'claim' | 'done';

export default function JoinPage() {
  const [step, setStep] = useState<Step>('register');

  // Step 1 fields
  const [name, setName] = useState('');
  const [empire, setEmpire] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 2 fields
  const [sessionToken, setSessionToken] = useState('');
  const [empireName, setEmpireName] = useState('');
  const [color, setColor] = useState('');
  const [unclaimed, setUnclaimed] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [claiming, setClaiming] = useState(false);

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
    setStep('claim');
    setLoading(false);
  }

  function toggleCountry(country: string) {
    setSelected(prev =>
      prev.includes(country)
        ? prev.filter(c => c !== country)
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

  const filtered = unclaimed.filter(c => c.toLowerCase().includes(search.toLowerCase()));

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
            Your starting territories have been claimed.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/submit" className="btn-primary">Declare Actions →</Link>
            <Link href="/results" className="btn-ghost">View World</Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'claim') {
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
                <button className="text-xs" style={{ color: 'var(--text2)' }} onClick={() => setSelected([])}>
                  Clear all
                </button>
              )}
            </div>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.map(c => (
                  <span
                    key={c}
                    className="badge badge-success cursor-pointer"
                    onClick={() => toggleCountry(c)}
                    title="Click to remove"
                  >
                    {c} ✕
                  </span>
                ))}
              </div>
            )}

            <input
              className="input text-sm"
              placeholder="Search countries..."
              value={search}
              onChange={e => setSearch(e.target.value)}
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

            <button
              className="btn-primary w-full"
              onClick={claimTerritories}
              disabled={claiming || selected.length === 0}
            >
              {claiming ? 'Claiming...' : `Claim ${selected.length} Territor${selected.length === 1 ? 'y' : 'ies'}`}
            </button>
            <p className="text-xs text-center" style={{ color: 'var(--text2)' }}>
              You can skip this and claim territories later by contacting your GM.
            </p>
            <button className="w-full text-xs" style={{ color: 'var(--text2)' }} onClick={() => setStep('done')}>
              Skip for now →
            </button>
          </div>
        </div>
      </div>
    );
  }

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

        <div className="card space-y-4">
          <div className="space-y-3">
            <input
              className="input"
              placeholder="Your name *"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Empire name *"
              value={empire}
              onChange={e => setEmpire(e.target.value)}
            />
            <input
              className="input"
              type="password"
              placeholder="Set your empire password *"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <input
              className="input"
              type="email"
              placeholder="Your email (optional)"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              className="input"
              placeholder="Join code *"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {error && <p className="danger text-sm">{error}</p>}

          <button
            className="btn-primary w-full"
            onClick={register}
            disabled={loading}
          >
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
