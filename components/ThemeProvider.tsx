'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark-military' | 'clean-modern';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({ theme: 'dark-military', setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark-military');

  useEffect(() => {
    const stored = localStorage.getItem('empires-theme') as Theme | null;
    if (stored) apply(stored);
    else {
      // Fetch from server
      fetch('/api/game/state').then(r => r.json()).then(s => {
        if (s.theme) apply(s.theme);
      }).catch(() => {});
    }
  }, []);

  function apply(t: Theme) {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('empires-theme', t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: apply }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
