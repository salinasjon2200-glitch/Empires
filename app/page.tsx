'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const [phase, setPhase] = useState<number>(0);

  useEffect(() => {
    fetch('/api/game/state').then(r => r.json()).then(s => setPhase(s.phase ?? 0)).catch(() => {});
  }, []);

  const phaseLabels = ['Theme Vote', 'Territory Bidding', 'Action Submission', 'Processing', 'Results'];
  const phasePaths = ['/vote', '/setup', '/submit', '/submit', '/results'];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl w-full text-center space-y-8">

        <div>
          <h1 className="display-font text-5xl font-black mb-3 glow" style={{ color: 'var(--accent)', letterSpacing: '0.15em' }}>
            EMPIRES
          </h1>
          <p className="text-lg" style={{ color: 'var(--text2)' }}>
            A satirical grand strategy game. You control a nation. The AI judges your decisions.
            The world burns accordingly.
          </p>
        </div>

        <div className="card space-y-4">
          <h2 className="display-font text-xs tracking-widest uppercase" style={{ color: 'var(--text2)' }}>
            Current Phase
          </h2>
          <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Phase {phase} — {phaseLabels[phase] ?? 'Unknown'}
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <Link href="/login" className="btn-primary">Empire Login</Link>
            <Link href={phasePaths[phase] ?? '/'} className="btn-ghost">Enter Game →</Link>
          </div>
          <div className="pt-2">
            <Link href="/vote" className="text-xs" style={{ color: 'var(--text2)' }}>Theme Vote</Link>
            {' · '}
            <Link href="/gm" className="text-xs" style={{ color: 'var(--text2)' }}>GM Dashboard</Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-left">
          <div className="card">
            <div className="text-2xl mb-2">⚔️</div>
            <h3 className="display-font text-xs tracking-wide uppercase mb-1" style={{ color: 'var(--accent)' }}>Declare Actions</h3>
            <p className="text-xs" style={{ color: 'var(--text2)' }}>Each turn you submit freeform orders for your empire. Diplomacy, war, science — anything goes.</p>
          </div>
          <div className="card">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="display-font text-xs tracking-wide uppercase mb-1" style={{ color: 'var(--accent)' }}>AI Judges All</h3>
            <p className="text-xs" style={{ color: 'var(--text2)' }}>The AI Game Master evaluates every action for realism. Fantasy gets rejected. Hubris gets punished.</p>
          </div>
          <div className="card">
            <div className="text-2xl mb-2">🌍</div>
            <h3 className="display-font text-xs tracking-wide uppercase mb-1" style={{ color: 'var(--accent)' }}>Live World Map</h3>
            <p className="text-xs" style={{ color: 'var(--text2)' }}>Territory ownership updates every turn. Watch your empire grow, shrink, or disappear entirely.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
