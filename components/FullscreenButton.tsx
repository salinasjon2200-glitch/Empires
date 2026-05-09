'use client';
import { useState, useEffect } from 'react';

export default function FullscreenButton() {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggle() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  return (
    <button
      onClick={toggle}
      title={isFs ? 'Exit fullscreen' : 'Enter fullscreen'}
      style={{
        position: 'fixed',
        top: '0.75rem',
        right: '0.75rem',
        zIndex: 9999,
        width: '2rem',
        height: '2rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '0.375rem',
        color: 'var(--text2)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.85rem',
        opacity: 0.7,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
    >
      {isFs ? '⛶' : '⛶'}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {isFs ? (
          <>
            <polyline points="8 3 3 3 3 8" /><line x1="3" y1="3" x2="10" y2="10" />
            <polyline points="16 3 21 3 21 8" /><line x1="21" y1="3" x2="14" y2="10" />
            <polyline points="8 21 3 21 3 16" /><line x1="3" y1="21" x2="10" y2="14" />
            <polyline points="16 21 21 21 21 16" /><line x1="21" y1="21" x2="14" y2="14" />
          </>
        ) : (
          <>
            <polyline points="15 3 21 3 21 9" /><line x1="21" y1="3" x2="14" y2="10" />
            <polyline points="9 21 3 21 3 15" /><line x1="3" y1="21" x2="10" y2="14" />
            <polyline points="21 15 21 21 15 21" /><line x1="21" y1="21" x2="14" y2="14" />
            <polyline points="3 9 3 3 9 3" /><line x1="3" y1="3" x2="10" y2="10" />
          </>
        )}
      </svg>
    </button>
  );
}
