'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const POLL_INTERVAL = 30_000; // 30 seconds

// ── Inline markdown renderer (no external deps) ──────────────────────────────
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="display-font text-sm tracking-wide uppercase mt-6 mb-2" style={{ color: 'var(--accent)' }}>
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="display-font text-base tracking-wide uppercase mt-8 mb-3" style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="display-font text-xl font-black mt-6 mb-4" style={{ color: 'var(--text)' }}>
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      elements.push(
        <p key={i} className="font-bold mt-4 mb-1" style={{ color: 'var(--text)' }}>
          {line.slice(2, -2)}
        </p>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={i} className="text-sm ml-4 mb-1" style={{ color: 'var(--text)', listStyleType: 'disc' }}>
          {renderInline(line.slice(2))}
        </li>
      );
    } else if (line.startsWith('|') && line.includes('|')) {
      const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (!cells.every(c => /^[-:\s]+$/.test(c))) {
        elements.push(
          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
            {cells.map((cell, ci) => (
              <td key={ci} className="px-3 py-1.5 text-sm text-left" style={{ color: 'var(--text)' }}>
                {renderInline(cell.trim())}
              </td>
            ))}
          </tr>
        );
      }
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} style={{ borderColor: 'var(--border)', margin: '1.5rem 0' }} />);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm mb-2 leading-relaxed" style={{ color: 'var(--text)' }}>
          {renderInline(line)}
        </p>
      );
    }
  });

  // Wrap consecutive <tr> elements in a scrollable <table>
  const grouped: React.ReactNode[] = [];
  let tableRows: React.ReactNode[] = [];
  elements.forEach((el, idx) => {
    if ((el as React.ReactElement)?.type === 'tr') {
      tableRows.push(el);
    } else {
      if (tableRows.length > 0) {
        grouped.push(
          <div key={`tbl-${idx}`} style={{ overflowX: 'auto', margin: '1rem 0' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid var(--border)' }}>
              <tbody>{tableRows}</tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
      grouped.push(el);
    }
  });
  if (tableRows.length > 0) {
    grouped.push(
      <div key="tbl-end" style={{ overflowX: 'auto', margin: '1rem 0' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid var(--border)' }}>
          <tbody>{tableRows}</tbody>
        </table>
      </div>
    );
  }

  return <>{grouped}</>;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function NewsPage() {
  const [displayYear, setDisplayYear] = useState<number | null>(null);
  const [currentYear, setCurrentYear] = useState<number | null>(null); // open/processing turn
  const [news, setNews] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [awaitingResults, setAwaitingResults] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newResultBanner, setNewResultBanner] = useState(false);

  const latestKnownYear = useRef<number | null>(null);

  // ── Fetch summary for a specific year ──────────────────────────────────
  async function fetchSummary(yr: number): Promise<string | null> {
    try {
      const r = await fetch(`/api/turns/${yr}/summary`);
      if (!r.ok) return null;
      const d = await r.json();
      return d.publicSummary ?? null;
    } catch {
      return null;
    }
  }

  // ── Full refresh: get archive + state, update everything ───────────────
  async function refresh(isInitial = false) {
    try {
      const [archR, stateR] = await Promise.all([
        fetch('/api/game/archive').then(r => r.json()),
        fetch('/api/game/state').then(r => r.json()),
      ]);

      const archYears: number[] = (archR.archive ?? []).sort((a: number, b: number) => b - a);
      const yr: number = stateR.currentYear ?? 2032;
      const latest = archYears[0] ?? null;

      setCurrentYear(yr);

      const isAwaiting = latest === null || latest < yr - 1;
      setAwaitingResults(isAwaiting);

      if (latest !== null) {
        const isNew = latest !== latestKnownYear.current;

        if (isNew || isInitial) {
          latestKnownYear.current = latest;
          const text = await fetchSummary(latest);
          setDisplayYear(latest);
          setNews(text);
          setLastUpdated(new Date());
          if (isNew && !isInitial) setNewResultBanner(true);
        }
      }
    } catch {}
    if (isInitial) setLoading(false);
  }

  // Initial load
  useEffect(() => {
    refresh(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling
  useEffect(() => {
    const timer = setInterval(() => refresh(false), POLL_INTERVAL);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="display-font text-xs tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
              World News Report
            </span>
            {displayYear && (
              <h1 className="display-font text-2xl font-black mt-0.5" style={{ color: 'var(--text)' }}>
                Year {displayYear}
              </h1>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Link href="/submit" className="btn-ghost text-sm">← Back to Game</Link>
            {lastUpdated && (
              <span className="text-xs" style={{ color: 'var(--text2)' }}>
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">

        {/* New results banner */}
        {newResultBanner && (
          <div className="card flex items-center justify-between gap-3" style={{ borderColor: '#22c55e', background: 'rgba(34,197,94,0.06)' }}>
            <div className="flex items-center gap-2">
              <span>🎯</span>
              <p className="font-semibold text-sm display-font" style={{ color: '#22c55e', letterSpacing: '0.05em' }}>
                NEW WORLD REPORT — YEAR {displayYear} IS LIVE
              </p>
            </div>
            <button onClick={() => setNewResultBanner(false)} style={{ color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          </div>
        )}

        {/* Awaiting banner */}
        {awaitingResults && (
          <div className="card flex items-center gap-3" style={{ borderColor: 'var(--accent)', background: 'rgba(0,212,255,0.04)' }}>
            <span style={{ fontSize: '1.2rem' }}>⏳</span>
            <div>
              <p className="font-semibold text-sm display-font" style={{ color: 'var(--accent)', letterSpacing: '0.05em' }}>
                AWAITING YEAR {currentYear} WORLD REPORT
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                Results will appear here automatically once the GM publishes them.
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        {loading && (
          <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text2)' }}>
            <div className="inline-block w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            <span className="text-sm">Loading world report…</span>
          </div>
        )}

        {!loading && displayYear !== null && news && (
          <MarkdownBlock text={news} />
        )}

        {!loading && displayYear !== null && !news && !awaitingResults && (
          <p style={{ color: 'var(--text2)' }}>No world report has been published for Year {displayYear} yet.</p>
        )}

        {!loading && displayYear === null && !awaitingResults && (
          <p style={{ color: 'var(--text2)' }}>No turn results have been published yet. Check back after the first turn is processed.</p>
        )}

        {/* Live indicator */}
        <div className="flex items-center gap-2 text-xs pt-2" style={{ color: 'var(--text2)' }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: awaitingResults ? '#f59e0b' : '#22c55e' }} />
          {awaitingResults ? `Awaiting Year ${currentYear} results…` : 'Live — updates every 30 seconds'}
        </div>
      </div>
    </div>
  );
}
