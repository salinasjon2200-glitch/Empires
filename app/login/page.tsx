'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [empires, setEmpires] = useState<{ empire: string; color: string; status: string }[]>([]);
  const [selected, setSelected] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/game/players').then(r => r.json()).then(d => {
      setEmpires((d.players ?? []).filter((p: { status: string }) => p.status !== 'eliminated'));
    }).catch(() => {});
  }, []);

  const isGM = selected === 'Gamemaster';

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !password) return;
    setLoading(true);
    setError('');
    try {
      if (isGM) {
        const r = await fetch('/api/auth/gm-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const data = await r.json();
        if (!r.ok) { setError('Invalid GM password'); return; }
        localStorage.setItem('empires-gm', data.gmToken);
        router.push('/gm');
      } else {
        const r = await fetch('/api/auth/empire-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empireName: selected, password }),
        });
        const data = await r.json();
        if (!r.ok) { setError(data.error ?? 'Login failed'); return; }
        localStorage.setItem('empires-session', data.sessionToken);
        localStorage.setItem('empires-player', JSON.stringify(data));
        router.push('/submit');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  const selectedColor = empires.find(e => e.empire === selected)?.color;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="display-font text-3xl font-black mb-2" style={{ color: 'var(--accent)' }}>EMPIRE LOGIN</h1>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>Authenticate with your empire password to enter the game</p>
        </div>

        <form onSubmit={login} className="card space-y-5">
          <div>
            <label className="label">Select Empire</label>
            <select
              className="input"
              value={selected}
              onChange={e => setSelected(e.target.value)}
              required
            >
              <option value="">— Choose your empire —</option>
              <option value="Gamemaster">🎲 Gamemaster</option>
              {empires.map(e => (
                <option key={e.empire} value={e.empire}>{e.empire}</option>
              ))}
            </select>
            {selected && (
              <div className="mt-2 flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: isGM ? '#ffffff' : selectedColor }}
                />
                <span className="text-xs" style={{ color: 'var(--text2)' }}>
                  {isGM ? 'GM access — redirects to dashboard' : 'Empire selected'}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="label">{isGM ? 'GM Password' : 'Empire Password'}</label>
            <input
              type="password"
              className="input"
              placeholder={isGM ? 'Enter GM password...' : 'Enter your empire password...'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {error && <p className="text-sm danger">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Authenticating...' : isGM ? 'Enter GM Dashboard' : 'Enter Empire'}
          </button>
        </form>

        <div className="text-center">
          <Link href="/" className="text-xs" style={{ color: 'var(--text2)' }}>← Back to landing</Link>
        </div>
      </div>
    </div>
  );
}
