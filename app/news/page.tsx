'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="display-font text-sm tracking-wide uppercase mt-6 mb-2" style={{ color: 'var(--accent)' }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="display-font text-base tracking-wide uppercase mt-8 mb-3" style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="display-font text-xl font-black mt-6 mb-4" style={{ color: 'var(--text)' }}>{line.slice(2)}</h1>);
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(<p key={i} className="font-bold mt-4 mb-1" style={{ color: 'var(--text)' }}>{line.slice(2, -2)}</p>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.slice(2);
      elements.push(
        <li key={i} className="text-sm ml-4 mb-1" style={{ color: 'var(--text)', listStyleType: 'disc' }}>
          {renderInline(content)}
        </li>
      );
    } else if (line.startsWith('|') && line.includes('|')) {
      // Table row
      const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (cells.every(c => /^[-:]+$/.test(c.trim()))) {
        // separator row — skip
      } else {
        const isHeader = lines[i + 1]?.startsWith('|') && lines[i + 1]?.includes('---');
        const Tag = isHeader ? 'th' : 'td';
        elements.push(
          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
            {cells.map((cell, ci) => (
              <Tag key={ci} className="px-3 py-1.5 text-sm text-left" style={{ color: isHeader ? 'var(--accent)' : 'var(--text)' }}>
                {renderInline(cell.trim())}
              </Tag>
            ))}
          </tr>
        );
      }
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} style={{ borderColor: 'var(--border)', margin: '1.5rem 0' }} />);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-sm mb-2 leading-relaxed" style={{ color: 'var(--text)' }}>{renderInline(line)}</p>);
    }

    i++;
  }

  // Wrap consecutive <tr> in a <table>
  const grouped: React.ReactNode[] = [];
  let tableRows: React.ReactNode[] = [];
  elements.forEach((el, idx) => {
    const type = (el as React.ReactElement)?.type;
    if (type === 'tr') {
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

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function NewsPage() {
  const [year, setYear] = useState<number | null>(null);
  const [news, setNews] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const stateR = await fetch('/api/game/state');
        if (!stateR.ok) { setError('Could not load game state.'); return; }
        const state = await stateR.json();
        const currentYear: number = state.currentYear ?? 2032;
        const reportYear = currentYear - 1;
        setYear(reportYear);

        const r = await fetch(`/api/turns/${reportYear}/summary`);
        if (!r.ok) { setError(`No world report found for ${reportYear}.`); return; }
        const d = await r.json();
        setNews(d.publicSummary ?? '');
      } catch {
        setError('Failed to load world report.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="display-font text-xs tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
              World News Report
            </span>
            {year && (
              <h1 className="display-font text-2xl font-black mt-0.5" style={{ color: 'var(--text)' }}>
                Year {year}
              </h1>
            )}
          </div>
          <Link href="/submit" className="btn-ghost text-sm">← Back to Game</Link>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading && (
          <p style={{ color: 'var(--text2)' }}>Loading world report...</p>
        )}
        {error && (
          <div className="card" style={{ borderColor: 'var(--danger)' }}>
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}
        {!loading && !error && news !== null && news.length > 0 && (
          <MarkdownBlock text={news} />
        )}
        {!loading && !error && (news === null || news.length === 0) && (
          <p style={{ color: 'var(--text2)' }}>No world report available yet for this year.</p>
        )}
      </div>
    </div>
  );
}
