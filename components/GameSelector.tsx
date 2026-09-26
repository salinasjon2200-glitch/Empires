'use client';

import { useEffect, useState } from 'react';

interface Game {
  id: string;
  name: string;
  startYear: number;
  contentMode: string;
  setupMode: string;
}

interface GameSelectorProps {
  destination?: '/login' | '/join';
  label?: string;
}

export default function GameSelector({
  destination = '/login',
  label = 'Select Game',
}: GameSelectorProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const existingGame = params.get('game');

    if (existingGame) {
      setSelected(existingGame);
    }

    fetch('/api/games/public')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.games) {
          setGames(data.games);

          if (existingGame && data.games.some((g: Game) => g.id === existingGame)) {
            setSelected(existingGame);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function selectGame(gameId: string) {
    setSelected(gameId);

    if (!gameId) return;

    window.location.href = `${destination}?game=${encodeURIComponent(gameId)}`;
  }

  return (
    <div className="card space-y-2">
      <label className="label">{label}</label>

      <select
        className="input"
        value={selected}
        onChange={e => selectGame(e.target.value)}
        disabled={loading}
      >
        <option value="">
          {loading ? 'Loading games...' : '— Choose a game —'}
        </option>

        {games.map(game => (
          <option key={game.id} value={game.id}>
            {game.name} ({game.id})
          </option>
        ))}
      </select>

      {!loading && games.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--text2)' }}>
          No active games are currently available.
        </p>
      )}

      {selected && (
        <p className="text-xs" style={{ color: 'var(--accent)' }}>
          Selected game: {games.find(g => g.id === selected)?.name ?? selected}
        </p>
      )}
    </div>
  );
}
