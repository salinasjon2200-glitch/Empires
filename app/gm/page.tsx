'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ChatSidebar from '@/components/ChatSidebar';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false });

interface Player { name: string; empire: string; color: string; status: string; passwordHash: string; territories: string[]; eliminatedYear?: number; }

type Tab = 'overview' | 'actions' | 'processing' | 'pk' | 'players' | 'chats' | 'mapupdate' | 'warchest';

export default function GMPage() {
  const [gmPassword, setGmPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authInput, setAuthInput] = useState('');

  const [tab, setTab] = useState<Tab>('overview');
  const [year, setYear] = useState(2032);
  const [players, setPlayers] = useState<Player[]>([]);
  const [territories, setTerritories] = useState({});
  const [actions, setActions] = useState<Record<string, string>>({});
  const [prevPK, setPrevPK] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [processError, setProcessError] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [streamingStep, setStreamingStep] = useState(0);
  const [advisorProgress, setAdvisorProgress] = useState({ index: 0, total: 0 });
  const [allChats, setAllChats] = useState<{ public: unknown[]; private: Record<string, unknown[]>; groups: Record<string, unknown> } | null>(null);
  const [eliminateTarget, setEliminateTarget] = useState('');
  const [resetPasswordTarget, setResetPasswordTarget] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [archive, setArchive] = useState<number[]>([]);
  const [historyYear, setHistoryYear] = useState<number | null>(null);
  const [historyPK, setHistoryPK] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [assignEmpire, setAssignEmpire] = useState('');
  const [assignStatus, setAssignStatus] = useState<'active' | 'contested' | 'ungoverned' | 'remove'>('active');
  const [mapSaving, setMapSaving] = useState(false);
  const [mapUpdateDesc, setMapUpdateDesc] = useState('');
  const [mapUpdating, setMapUpdating] = useState(false);
  const [mapUpdateLog, setMapUpdateLog] = useState('');

  // New states
  const [currentGameId, setCurrentGameId] = useState('s2');
  const [gamesList, setGamesList] = useState<Array<{ id: string; name: string; status: string; contentMode: string; createdAt: number }>>([]);
  const [gamesLoaded, setGamesLoaded] = useState(false);
  const [warChest, setWarChest] = useState<{ balance: number; threshold: number; contributions: Array<{ name: string; amount: number; method: string; timestamp: number }>; lastTurnCost: number } | null>(null);
  const [wcAmount, setWcAmount] = useState('');
  const [wcContributor, setWcContributor] = useState('');
  const [wcSaving, setWcSaving] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [newGameName, setNewGameName] = useState('');
  const [newGameYear, setNewGameYear] = useState(2032);
  const [newGameContent, setNewGameContent] = useState<'unrestricted' | 'school'>('unrestricted');
  const [newGameSetup, setNewGameSetup] = useState<'bidding' | 'random'>('bidding');
  const [creatingGame, setCreatingGame] = useState(false);
  const [randomPool, setRandomPool] = useState<string[]>([]);
  const [randomAssignments, setRandomAssignments] = useState<Array<{ playerName: string; empire: string; color: string; country: string }>>([]);
  const [randomizing, setRandomizing] = useState(false);
  const [worldNews, setWorldNews] = useState('');
  const [worldNewsYear, setWorldNewsYear] = useState<number | null>(null);
  const [worldNewsSaving, setWorldNewsSaving] = useState(false);
  const [worldNewsSaved, setWorldNewsSaved] = useState(false);

  const headers = useCallback(() => ({ 'Authorization': `Bearer ${gmPassword}`, 'Content-Type': 'application/json', 'X-Game-ID': currentGameId }), [gmPassword, currentGameId]);

  async function login() {
    const r = await fetch('/api/auth/gm-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: authInput }),
    });
    if (r.ok) {
      setGmPassword(authInput);
      setAuthed(true);
      localStorage.setItem('empires-gm', authInput);
    } else alert('Invalid GM password');
  }

  useEffect(() => {
    const stored = localStorage.getItem('empires-gm');
    if (stored) { setGmPassword(stored); setAuthed(true); }
  }, []);

  const loadAll = useCallback(async () => {
    if (!authed) return;
    const [stateR, playersR, mapR, actionsR] = await Promise.all([
      fetch('/api/game/state'),
      fetch('/api/game/setup', { headers: headers() }),
      fetch('/api/map/territories'),
      fetch('/api/turns/actions', { headers: headers() }),
    ]);
    if (stateR.ok) {
      const s = await stateR.json();
      setYear(s.currentYear ?? 2032);
      const lastCompleted = s.lastTurnCompletedAt;
      if (lastCompleted) {
        const remaining = (lastCompleted + 24 * 60 * 60 * 1000) - Date.now();
        setCooldownRemaining(Math.max(0, remaining));
      } else {
        setCooldownRemaining(0);
      }
    }
    if (playersR.ok) { const d = await playersR.json(); setPlayers(d.players ?? []); }
    if (mapR.ok) { const d = await mapR.json(); setTerritories(d.territories ?? {}); }
    if (actionsR.ok) { const d = await actionsR.json(); setActions(d.actions ?? {}); }
    const archR = await fetch('/api/game/archive');
    if (archR.ok) { const d = await archR.json(); setArchive(d.archive ?? []); }

    // Load prev PK and world news using the year extracted above (stateR body already consumed — cannot clone)
    if (stateR.ok) {
      const currentYear = (await fetch('/api/game/state').then(r => r.json()).catch(() => ({ currentYear: 2032 }))).currentYear ?? 2032;
      const pkR = await fetch(`/api/turns/${currentYear - 1}/perfect-knowledge`, { headers: headers() });
      if (pkR.ok) { const d = await pkR.json(); setPrevPK(d.perfectKnowledge ?? ''); }
      const newsR = await fetch(`/api/turns/${currentYear - 1}/summary`);
      if (newsR.ok) { const d = await newsR.json(); setWorldNews(d.publicSummary ?? ''); setWorldNewsYear(currentYear - 1); }
    }
  }, [authed, headers]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Load games list
  useEffect(() => {
    if (!authed || gamesLoaded) return;
    fetch('/api/games', { headers: { 'Authorization': `Bearer ${gmPassword}`, 'Content-Type': 'application/json', 'X-Game-ID': currentGameId } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setGamesList(d.games ?? []); setGamesLoaded(true); } })
      .catch(() => {});
  }, [authed, gamesLoaded, gmPassword, currentGameId]);

  const loadWarChest = useCallback(async () => {
    if (!authed) return;
    const r = await fetch('/api/war-chest', { headers: headers() });
    if (r.ok) setWarChest(await r.json().then((d: { warChest: typeof warChest }) => d.warChest));
  }, [authed, headers]);

  useEffect(() => { loadWarChest(); }, [loadWarChest]);

  // Cooldown countdown interval
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  async function addFunds() {
    if (!wcAmount || isNaN(Number(wcAmount)) || Number(wcAmount) <= 0) return;
    setWcSaving(true);
    await fetch('/api/war-chest', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ amount: Number(wcAmount), contributorName: wcContributor, method: 'manual' }),
    });
    setWcAmount('');
    setWcContributor('');
    await loadWarChest();
    setWcSaving(false);
  }

  async function loadChats() {
    const r = await fetch('/api/chat/all', { headers: headers() });
    if (r.ok) setAllChats(await r.json());
  }

  useEffect(() => { if (tab === 'chats' && authed) loadChats(); }, [tab, authed]);

  async function processTurn() {
    if (cooldownRemaining > 0) {
      setProcessError(`Cooldown active: ${Math.ceil(cooldownRemaining / 3600000)} hours remaining.`);
      return;
    }
    setProcessing(true);
    setProcessLog([]);
    setProcessError('');
    setStreamingText('');
    setStreamingStep(0);
    setAdvisorProgress({ index: 0, total: 0 });
    setProcessLog(l => [...l, `Initiating Turn ${year} processing...`]);

    let r: Response;
    try {
      r = await fetch('/api/turns/process', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ previousPerfectKnowledge: prevPK }),
      });
    } catch {
      setProcessError('Network error — could not reach server.');
      setProcessing(false);
      return;
    }

    if (!r.ok || !r.body) {
      setProcessError('Failed to start processing.');
      setProcessing(false);
      return;
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'progress') {
              setProcessLog(l => [...l, event.message]);
              if (event.step !== streamingStep) {
                setStreamingText('');
                setStreamingStep(event.step);
              }
              if (event.total) setAdvisorProgress({ index: event.index ?? 0, total: event.total });
            } else if (event.type === 'token') {
              setStreamingText(t => t + event.text);
            } else if (event.type === 'step_done') {
              setProcessLog(l => [...l, event.message]);
              setStreamingText('');
            } else if (event.type === 'advisor_done') {
              setProcessLog(l => [...l, `  ✓ ${event.empire} (${event.index}/${event.total})`]);
              setAdvisorProgress({ index: event.index, total: event.total });
            } else if (event.type === 'advisor_error') {
              setProcessLog(l => [...l, `  ✗ ${event.empire} — failed`]);
            } else if (event.type === 'done') {
              setProcessLog(l => [...l, `✓ Turn ${event.year} fully processed. Year advances to ${event.nextYear}.`]);
              if (event.advisorErrors?.length) {
                setProcessLog(l => [...l, `⚠️ Advisor failures: ${event.advisorErrors.join(', ')}`]);
              }
              loadAll();
            } else if (event.type === 'error') {
              setProcessError(event.message);
            }
          } catch { /* malformed line — skip */ }
        }
      }
    } catch (e) {
      setProcessError(`Stream read error: ${e}`);
    }

    setProcessing(false);
    setStreamingText('');
  }

  async function eliminateEmpire() {
    if (!eliminateTarget || !confirm(`Eliminate ${eliminateTarget}? This cannot be undone.`)) return;
    await fetch('/api/game/eliminate', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ empireName: eliminateTarget, year }),
    });
    setEliminateTarget('');
    loadAll();
  }

  async function saveTerritory() {
    if (!selectedCountry) return;
    setMapSaving(true);
    const empire = activePlayers.find(p => p.empire === assignEmpire);
    await fetch('/api/map/territories', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        country: selectedCountry,
        empire: assignEmpire,
        leader: empire?.name ?? '',
        color: empire?.color ?? '#6b7280',
        status: assignStatus,
      }),
    });
    await loadAll();
    setMapSaving(false);
    setSelectedCountry('');
    setAssignEmpire('');
    setAssignStatus('active');
  }

  async function resetPassword() {
    if (!resetPasswordTarget || !resetPasswordValue) return;
    const r = await fetch('/api/game/reset-password', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ empireName: resetPasswordTarget, newPassword: resetPasswordValue }),
    });
    const d = await r.json();
    if (r.ok) {
      alert(`Password for ${resetPasswordTarget} reset successfully.`);
      setResetPasswordTarget(''); setResetPasswordValue('');
    } else {
      alert(`Failed to reset password: ${d.error ?? 'Unknown error'}`);
    }
  }

  async function loadHistoryPK(yr: number) {
    setHistoryYear(yr);
    setHistoryLoading(true);
    setHistoryPK('');
    const r = await fetch(`/api/turns/${yr}/perfect-knowledge`, { headers: headers() });
    if (r.ok) { const d = await r.json(); setHistoryPK(d.perfectKnowledge ?? 'No Perfect Knowledge document found.'); }
    else setHistoryPK('No records found for this year.');
    setHistoryLoading(false);
  }

  async function runMapUpdate() {
    if (!mapUpdateDesc.trim()) return;
    setMapUpdating(true);
    setMapUpdateLog('Sending to AI...');
    const r = await fetch('/api/map/update', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ description: mapUpdateDesc }),
    });
    const d = await r.json();
    if (r.ok) {
      setMapUpdateLog('Map updated successfully.');
      setMapUpdateDesc('');
      loadAll();
    } else {
      setMapUpdateLog(`Error: ${d.error ?? 'Unknown error'}`);
    }
    setMapUpdating(false);
  }

  const tabs: [Tab, string][] = [
    ['overview', 'Overview'],
    ['actions', 'Actions'],
    ['processing', 'Initiate Processing'],
    ['pk', 'Perfect Knowledge'],
    ['players', 'Empire Management'],
    ['chats', 'Intercept All Transmissions'],
    ['mapupdate', 'Map Update'],
    ['warchest', 'War Chest'],
  ];

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-sm w-full space-y-6">
          <h1 className="display-font text-3xl font-black text-center" style={{ color: 'var(--accent)' }}>GM AUTHENTICATION REQUIRED</h1>
          <div className="card space-y-4">
            <input type="password" className="input" placeholder="GM password..." value={authInput} onChange={e => setAuthInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <button className="btn-primary w-full" onClick={login}>Authenticate</button>
          </div>
        </div>
      </div>
    );
  }

  const activePlayers = players.filter(p => p.status === 'active');

  // Cooldown/war chest computed values
  const cooldownHours = Math.ceil(cooldownRemaining / 3600000);
  const cooldownMins = Math.ceil((cooldownRemaining % 3600000) / 60000);
  const warChestReady = !warChest || warChest.balance >= warChest.threshold;
  const cooldownReady = cooldownRemaining <= 0;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto space-y-4">

        <div className="flex items-center justify-between">
          <h1 className="display-font text-xl font-black" style={{ color: 'var(--accent)' }}>GM DASHBOARD — YEAR {year}</h1>
          <div className="flex gap-2 items-center">
            <span className="badge badge-success">TURN OPEN</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 flex-wrap" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {tabs.map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
              style={{
                color: tab === t ? 'var(--accent)' : 'var(--text2)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Game selector */}
        {gamesLoaded && gamesList.length > 1 && (
          <div className="flex items-center gap-3 p-3 rounded" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <p className="label">Active Game:</p>
            <select className="input text-sm flex-1" value={currentGameId} onChange={e => { setCurrentGameId(e.target.value); loadAll(); }}>
              <option value="s2">S2 — Current Game</option>
              {gamesList.map(g => <option key={g.id} value={g.id}>{g.name} ({g.id})</option>)}
            </select>
          </div>
        )}

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="card">
                <p className="label mb-2">Turn Status</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Year {year}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>{Object.keys(actions).length}/{activePlayers.length} actions submitted</p>
              </div>
              <div className="card">
                <p className="label mb-2">Active Empires</p>
                <p className="text-2xl font-bold">{activePlayers.length}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>{players.filter(p => p.status === 'eliminated').length} eliminated</p>
              </div>
              <div className="lg:col-span-3 card">
                <p className="label mb-3">World Map — click a country to edit</p>
                <WorldMap
                  territories={territories}
                  mode="territories"
                  height={300}
                  selectedCountry={selectedCountry}
                  onCountryClick={(name) => {
                    setSelectedCountry(name);
                    const existing = (territories as Record<string, { empire: string; status: string }>)[name];
                    setAssignEmpire(existing?.empire ?? '');
                    setAssignStatus((existing?.status as 'active' | 'contested' | 'ungoverned') ?? 'active');
                  }}
                />
                {selectedCountry && (
                  <div className="mt-4 p-3 rounded space-y-3" style={{ background: 'var(--surface2)', border: '1px solid var(--accent)' }}>
                    <p className="label" style={{ color: 'var(--accent)' }}>Editing: {selectedCountry}</p>
                    <div className="flex gap-3 flex-wrap items-end">
                      <div className="flex-1 min-w-40">
                        <label className="label">Status</label>
                        <select className="input text-sm" value={assignStatus} onChange={e => setAssignStatus(e.target.value as typeof assignStatus)}>
                          <option value="active">Active (owned)</option>
                          <option value="contested">Contested</option>
                          <option value="ungoverned">Ungoverned</option>
                          <option value="remove">Remove from map</option>
                        </select>
                      </div>
                      {assignStatus === 'active' && (
                        <div className="flex-1 min-w-40">
                          <label className="label">Assign to Empire</label>
                          <select className="input text-sm" value={assignEmpire} onChange={e => setAssignEmpire(e.target.value)}>
                            <option value="">— Select empire —</option>
                            {activePlayers.map(p => (
                              <option key={p.name} value={p.empire}>{p.empire} ({p.name})</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <button className="btn-primary" onClick={saveTerritory} disabled={mapSaving || (assignStatus === 'active' && !assignEmpire)}>
                        {mapSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button className="btn-ghost" onClick={() => setSelectedCountry('')}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Random Assignment */}
            <div className="card space-y-3">
              <p className="label">Random Territory Assignment</p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                Assign one territory to each active player randomly. Select countries to include in the pool.
              </p>
              <div className="flex gap-3 flex-wrap">
                <button
                  className="btn-ghost text-sm"
                  onClick={() => {
                    const pool = randomPool.length > 0 ? randomPool : Object.keys(territories);
                    const shuffled = [...pool].sort(() => Math.random() - 0.5);
                    const newAssignments = activePlayers.slice(0, shuffled.length).map((p, i) => ({
                      playerName: p.name,
                      empire: p.empire,
                      color: p.color,
                      country: shuffled[i],
                    }));
                    setRandomAssignments(newAssignments);
                  }}
                >
                  Randomize
                </button>
                {randomAssignments.length > 0 && (
                  <button
                    className="btn-primary text-sm"
                    disabled={randomizing}
                    onClick={async () => {
                      setRandomizing(true);
                      await fetch('/api/game/random-assign', {
                        method: 'POST',
                        headers: headers(),
                        body: JSON.stringify({ assignments: randomAssignments, confirm: true }),
                      });
                      setRandomAssignments([]);
                      loadAll();
                      setRandomizing(false);
                    }}
                  >
                    {randomizing ? 'Saving...' : 'Confirm Assignments'}
                  </button>
                )}
              </div>
              {randomAssignments.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {randomAssignments.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full" style={{ background: a.color }} />
                      <span className="flex-1">{a.empire}</span>
                      <select
                        className="input text-xs py-1"
                        style={{ width: 160 }}
                        value={a.country}
                        onChange={e => {
                          const updated = [...randomAssignments];
                          updated[i] = { ...a, country: e.target.value };
                          setRandomAssignments(updated);
                        }}
                      >
                        {Object.keys(territories).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create New Game */}
            <div className="card space-y-3">
              <p className="label">Create New Game Instance</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Game Name</label>
                  <input className="input text-sm" placeholder="e.g. Season 3" value={newGameName} onChange={e => setNewGameName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Start Year</label>
                  <input className="input text-sm" type="number" value={newGameYear} onChange={e => setNewGameYear(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Content Mode</label>
                  <select className="input text-sm" value={newGameContent} onChange={e => setNewGameContent(e.target.value as 'unrestricted' | 'school')}>
                    <option value="unrestricted">Unrestricted</option>
                    <option value="school">School-Appropriate</option>
                  </select>
                </div>
                <div>
                  <label className="label">Setup Mode</label>
                  <select className="input text-sm" value={newGameSetup} onChange={e => setNewGameSetup(e.target.value as 'bidding' | 'random')}>
                    <option value="bidding">Bidding</option>
                    <option value="random">Random Assignment</option>
                  </select>
                </div>
              </div>
              <button
                className="btn-primary text-sm"
                disabled={creatingGame || !newGameName}
                onClick={async () => {
                  setCreatingGame(true);
                  const r = await fetch('/api/games', {
                    method: 'POST',
                    headers: headers(),
                    body: JSON.stringify({ name: newGameName, startYear: newGameYear, contentMode: newGameContent, setupMode: newGameSetup }),
                  });
                  const d = await r.json();
                  if (r.ok) {
                    alert(`Game created! ID: ${d.id}\nShare link: ${window.location.origin}/login?game=${d.id}`);
                    setNewGameName('');
                  } else {
                    alert(`Failed: ${d.error}`);
                  }
                  setCreatingGame(false);
                }}
              >
                {creatingGame ? 'Creating...' : 'Create Game'}
              </button>
            </div>
          </div>
        )}

        {/* ACTIONS */}
        {tab === 'actions' && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text2)' }}>{Object.keys(actions).length}/{activePlayers.length} submissions for Year {year}</p>
            {activePlayers.map(p => (
              <div key={p.name} className="card space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                  <span className="font-semibold">{p.empire}</span>
                  <span style={{ color: 'var(--text2)' }}>({p.name})</span>
                  {actions[p.name] ? <span className="badge badge-success ml-auto" style={{ fontSize: '0.6rem' }}>SUBMITTED</span> : <span className="badge badge-neutral ml-auto" style={{ fontSize: '0.6rem' }}>PENDING</span>}
                </div>
                {actions[p.name] ? (
                  <div className="text-sm p-3 rounded" style={{ background: 'var(--surface2)', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                    {actions[p.name]}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text2)' }}>No action submitted yet.</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* PROCESSING */}
        {tab === 'processing' && (
          <div className="space-y-4">

            {/* World News Card */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <p className="label">World News Report — Year {worldNewsYear ?? year - 1}</p>
                <div className="flex items-center gap-2">
                  {worldNewsSaved && <span className="text-xs" style={{ color: 'var(--accent)' }}>✓ Saved</span>}
                  <button
                    className="btn-primary text-xs"
                    style={{ padding: '0.35rem 0.85rem' }}
                    disabled={worldNewsSaving}
                    onClick={async () => {
                      const yr = worldNewsYear ?? year - 1;
                      setWorldNewsSaving(true);
                      setWorldNewsSaved(false);
                      await fetch(`/api/turns/${yr}/summary`, {
                        method: 'POST',
                        headers: headers(),
                        body: JSON.stringify({ publicSummary: worldNews }),
                      });
                      setWorldNewsSaving(false);
                      setWorldNewsSaved(true);
                      setTimeout(() => setWorldNewsSaved(false), 3000);
                    }}
                  >
                    {worldNewsSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                This is what players see at <strong>/news</strong>. Paste the World News Report here (markdown supported). This is NOT the Perfect Knowledge document.
              </p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>{worldNews.length.toLocaleString()} characters</p>
              <textarea
                className="input font-mono text-xs"
                style={{ minHeight: 300 }}
                value={worldNews}
                onChange={e => setWorldNews(e.target.value)}
                placeholder="Paste the World News Report (public summary) for players to read..."
              />
            </div>

            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <p className="label">Previous Perfect Knowledge Document</p>
                <button
                  className="btn-ghost text-xs"
                  onClick={async () => {
                    const r = await fetch(`/api/turns/${year - 1}/perfect-knowledge`, { headers: headers() });
                    if (r.ok) { const d = await r.json(); setPrevPK(d.perfectKnowledge ?? ''); }
                  }}
                >
                  ↺ Reset to Year {year - 1}
                </button>
              </div>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                Should contain <strong>only last turn&apos;s PK</strong> (Year {year - 1}). Do not paste multiple years — it bloats the context and breaks the AI.
              </p>
              {prevPK.length > 30000 && (
                <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
                  ⚠️ PK is {Math.round(prevPK.length / 1000)}k characters — this is too long. It likely contains multiple years concatenated. Click &quot;Reset to Year {year - 1}&quot; above to fix this.
                </p>
              )}
              <p className="text-xs" style={{ color: prevPK.length > 30000 ? 'var(--danger)' : 'var(--text2)' }}>
                {prevPK.length.toLocaleString()} characters
              </p>
              <textarea
                className="input font-mono text-xs"
                style={{ minHeight: 300 }}
                value={prevPK}
                onChange={e => setPrevPK(e.target.value)}
                placeholder="Paste or edit the previous turn's Perfect Knowledge document..."
              />
            </div>

            {/* Processing time estimate */}
            {!processing && processLog.length === 0 && (
              <div className="card" style={{ borderColor: 'var(--accent)', background: 'rgba(0,212,255,0.05)' }}>
                <p className="label mb-2">Estimated Processing Time</p>
                <p className="text-sm font-mono" style={{ color: 'var(--accent)' }}>
                  ~{Math.ceil((45 + activePlayers.length * 9) / 60)} minutes
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
                  {activePlayers.length} empires × ~9s advisor reports + ~45s world summary + PK document
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
                  Do not close this window during processing.
                </p>
              </div>
            )}

            {/* War chest + cooldown status */}
            {warChest && (
              <div className="flex gap-4 text-sm flex-wrap">
                <span style={{ color: warChestReady ? 'var(--success)' : 'var(--danger)' }}>
                  {warChestReady ? '✓' : '✗'} War Chest: ${warChest.balance.toFixed(2)} / ${warChest.threshold.toFixed(2)}
                </span>
                <span style={{ color: cooldownReady ? 'var(--success)' : 'var(--danger)' }}>
                  {cooldownReady ? '✓ Ready to process' : `⏱ Cooldown: ${cooldownHours}h ${cooldownMins}m`}
                </span>
              </div>
            )}

            {/* Live log */}
            {processLog.length > 0 && (
              <div className="card font-mono text-xs space-y-1" style={{ background: 'var(--surface2)' }}>
                {processLog.map((l, i) => (
                  <div key={i} style={{ color: l.startsWith('✓') ? 'var(--success)' : l.startsWith('✗') ? 'var(--danger)' : l.startsWith('⚠️') ? '#f59e0b' : 'var(--text2)' }}>
                    {l}
                  </div>
                ))}
              </div>
            )}

            {/* Advisor progress bar */}
            {processing && advisorProgress.total > 0 && (
              <div className="card space-y-2">
                <p className="label text-xs">Advisor Reports: {advisorProgress.index}/{advisorProgress.total}</p>
                <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${(advisorProgress.index / advisorProgress.total) * 100}%`, background: 'var(--accent)' }}
                  />
                </div>
              </div>
            )}

            {/* Live streaming text */}
            {streamingText && (
              <div className="card space-y-2">
                <p className="label text-xs" style={{ color: 'var(--accent)' }}>
                  {streamingStep === 1 ? 'World Summary' : streamingStep === 2 ? 'Perfect Knowledge' : 'Streaming...'} — live output
                </p>
                <div className="font-mono text-xs leading-relaxed overflow-y-auto whitespace-pre-wrap" style={{ maxHeight: 240, color: 'var(--text2)' }}>
                  {streamingText}
                  <span style={{ opacity: 0.6 }}>▊</span>
                </div>
              </div>
            )}

            {processError && <p className="danger text-sm">{processError}</p>}

            <button
              className="btn-primary text-base py-3 px-8"
              onClick={processTurn}
              disabled={processing || !cooldownReady || !warChestReady}
            >
              {processing
                ? `Processing Turn ${year}... do not close this page`
                : !warChestReady
                ? `War Chest insufficient ($${warChest?.balance.toFixed(2)} / $${warChest?.threshold.toFixed(2)})`
                : !cooldownReady
                ? `Cooldown: ${cooldownHours}h ${cooldownMins}m remaining`
                : `Initiate Turn ${year} Processing`}
            </button>
          </div>
        )}

        {/* PERFECT KNOWLEDGE HISTORY */}
        {tab === 'pk' && (
          <div className="space-y-4">
            <div className="card space-y-3">
              <p className="label">Historical Archive — Perfect Knowledge</p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>Select any past year to view its Perfect Knowledge document.</p>
              <div className="flex gap-2 flex-wrap">
                {[...archive].sort((a, b) => b - a).map(yr => (
                  <button
                    key={yr}
                    className={historyYear === yr ? 'btn-primary' : 'btn-ghost'}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}
                    onClick={() => loadHistoryPK(yr)}
                  >
                    {yr}
                  </button>
                ))}
                {archive.length === 0 && <p className="text-sm" style={{ color: 'var(--text2)' }}>No archived years yet.</p>}
              </div>
            </div>

            {historyYear && (
              <div className="card space-y-3">
                <p className="label">Perfect Knowledge — Year {historyYear}</p>
                {historyLoading ? (
                  <p className="text-sm" style={{ color: 'var(--text2)' }}>Loading...</p>
                ) : (
                  <div className="text-sm font-mono leading-relaxed overflow-y-auto whitespace-pre-wrap" style={{ color: 'var(--text)', maxHeight: '70vh' }}>
                    {historyPK}
                  </div>
                )}
              </div>
            )}

            {!historyYear && prevPK && (
              <div className="card space-y-3">
                <p className="label">Perfect Knowledge — Year {year - 1} (latest)</p>
                <div className="text-sm font-mono leading-relaxed overflow-y-auto whitespace-pre-wrap" style={{ color: 'var(--text)', maxHeight: '70vh' }}>
                  {prevPK}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PLAYERS */}
        {tab === 'players' && (
          <div className="space-y-4">
            {/* Join password */}
            <JoinPasswordCard gmPassword={gmPassword} currentGameId={currentGameId} />

            {/* Eliminate */}
            <div className="card space-y-3">
              <p className="label danger">Empire Status Management</p>
              <div className="flex gap-3">
                <select className="input text-sm" value={eliminateTarget} onChange={e => setEliminateTarget(e.target.value)}>
                  <option value="">Select empire to eliminate...</option>
                  {activePlayers.map(p => <option key={p.name} value={p.empire}>{p.empire} ({p.name})</option>)}
                </select>
                <button className="btn-danger" onClick={eliminateEmpire} disabled={!eliminateTarget}>
                  Eliminate Empire
                </button>
              </div>
            </div>

            {/* Reset password */}
            <div className="card space-y-3">
              <p className="label">Reset Empire Password</p>
              <div className="flex gap-3">
                <select className="input text-sm" value={resetPasswordTarget} onChange={e => setResetPasswordTarget(e.target.value)}>
                  <option value="">Select empire...</option>
                  {players.map(p => <option key={p.name} value={p.empire}>{p.empire} ({p.name})</option>)}
                </select>
                <input className="input text-sm" placeholder="New password" value={resetPasswordValue} onChange={e => setResetPasswordValue(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                <button className="btn-primary" onClick={resetPassword}>Reset</button>
              </div>
            </div>

            {/* Player list */}
            <div className="card">
              <p className="label mb-3">All Empires</p>
              <div className="space-y-3">
                {players.map(p => (
                  <div key={p.name} className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0" style={{ background: p.status === 'eliminated' ? '#6b7280' : p.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{p.empire}</div>
                      <div className="text-xs" style={{ color: 'var(--text2)' }}>Leader: {p.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text2)' }}>Territories: {p.territories?.join(', ') || 'None'}</div>
                    </div>
                    <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.6rem' }}>
                      {p.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Eliminated */}
            {players.filter(p => p.status === 'eliminated').length > 0 && (
              <div className="card">
                <p className="label mb-3">Eliminated Empires</p>
                <div className="space-y-2">
                  {players.filter(p => p.status === 'eliminated').map(p => (
                    <div key={p.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ background: '#6b7280' }} />
                      <span style={{ textDecoration: 'line-through', color: 'var(--text2)' }}>{p.empire}</span>
                      <span style={{ color: 'var(--text2)' }}>({p.name})</span>
                      {p.eliminatedYear && <span className="ml-auto text-xs" style={{ color: 'var(--text2)' }}>Year {p.eliminatedYear}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CHATS — INTELLIGENCE VIEW */}
        {tab === 'chats' && (
          <div className="space-y-4">
            <div className="card">
              <p className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--danger)' }}>
                ⚡ Intelligence View — All Transmissions
              </p>
              <p className="text-xs mb-4" style={{ color: 'var(--text2)' }}>
                All player communications — public, private, and group — are visible here.
              </p>

              {!allChats ? (
                <button className="btn-primary" onClick={loadChats}>Load All Transmissions</button>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="label mb-2">Global Channel ({allChats.public.length} messages)</p>
                    <div className="max-h-64 overflow-y-auto space-y-1 p-3 rounded" style={{ background: 'var(--surface2)' }}>
                      {(allChats.public as { senderName: string; empireName: string; text: string; timestamp: number; color: string }[]).slice(-50).map((m, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-bold" style={{ color: m.color }}>{m.empireName}</span>
                          <span style={{ color: 'var(--text2)' }}> {new Date(m.timestamp).toLocaleTimeString()} </span>
                          <span style={{ color: 'var(--text)' }}>{m.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {Object.entries(allChats.private).map(([key, msgs]) => (
                    <div key={key}>
                      <p className="label mb-2">Private: {key.replace('chat:private:', '').replace(':', ' ↔ ')}</p>
                      <div className="max-h-48 overflow-y-auto space-y-1 p-3 rounded" style={{ background: 'var(--surface2)' }}>
                        {(msgs as { senderName: string; empireName: string; text: string; timestamp: number; color: string }[]).map((m, i) => (
                          <div key={i} className="text-xs">
                            <span className="font-bold" style={{ color: m.color }}>{m.senderName}</span>
                            <span style={{ color: 'var(--text2)' }}> {new Date(m.timestamp).toLocaleTimeString()} </span>
                            <span style={{ color: 'var(--text)' }}>{m.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {Object.entries(allChats.groups).map(([id, data]) => {
                    const d = data as { group: { name: string }; messages: { senderName: string; empireName: string; text: string; timestamp: number; color: string }[] };
                    return (
                      <div key={id}>
                        <p className="label mb-2">Group: {d.group.name}</p>
                        <div className="max-h-48 overflow-y-auto space-y-1 p-3 rounded" style={{ background: 'var(--surface2)' }}>
                          {d.messages.map((m, i) => (
                            <div key={i} className="text-xs">
                              <span className="font-bold" style={{ color: m.color }}>{m.senderName}</span>
                              <span style={{ color: 'var(--text2)' }}> {new Date(m.timestamp).toLocaleTimeString()} </span>
                              <span style={{ color: 'var(--text)' }}>{m.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MAP UPDATE */}
        {tab === 'mapupdate' && (
          <div className="space-y-4">
            <div className="card space-y-4">
              <p className="label">AI Map Update</p>
              <p className="text-sm" style={{ color: 'var(--text2)' }}>
                Describe territorial changes in plain English. The AI will update the map without processing a full turn.
              </p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                Examples: "Germany is now contested. Logan absorbs eastern Russia. IKEA gains Norway."
              </p>
              <textarea
                className="input font-mono text-sm"
                style={{ minHeight: 180 }}
                placeholder="Describe the territorial changes..."
                value={mapUpdateDesc}
                onChange={e => setMapUpdateDesc(e.target.value)}
              />
              {mapUpdateLog && (
                <p className="text-sm" style={{ color: mapUpdateLog.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
                  {mapUpdateLog}
                </p>
              )}
              <button className="btn-primary" onClick={runMapUpdate} disabled={mapUpdating || !mapUpdateDesc.trim()}>
                {mapUpdating ? 'Updating map...' : 'Update Map with AI'}
              </button>
            </div>
            <div className="card">
              <p className="label mb-3">Current Map</p>
              <WorldMap territories={territories} mode="territories" height={300} />
            </div>
          </div>
        )}

        {/* WAR CHEST */}
        {tab === 'warchest' && (
          <div className="space-y-4">
            {warChest && (
              <>
                <div className="card space-y-3">
                  <p className="label">Community War Chest</p>
                  <div className="flex items-end gap-4 flex-wrap">
                    <div>
                      <p className="text-3xl font-bold display-font" style={{ color: 'var(--accent)' }}>
                        ${warChest.balance.toFixed(2)}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text2)' }}>of ${warChest.threshold.toFixed(2)} threshold</p>
                    </div>
                    <div className="flex-1 min-w-40">
                      <div className="rounded-full overflow-hidden" style={{ height: 8, background: 'var(--border)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (warChest.balance / Math.max(0.01, warChest.threshold)) * 100)}%`,
                            background: warChest.balance >= warChest.threshold ? 'var(--success)' : 'var(--accent)',
                          }}
                        />
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
                        {warChest.balance >= warChest.threshold
                          ? '✓ Threshold met — turn can run'
                          : `$${(warChest.threshold - warChest.balance).toFixed(2)} more needed`}
                      </p>
                    </div>
                  </div>
                  {warChest.lastTurnCost > 0 && (
                    <p className="text-xs" style={{ color: 'var(--text2)' }}>Last turn cost: ${warChest.lastTurnCost.toFixed(4)}</p>
                  )}
                </div>

                <div className="card space-y-3">
                  <p className="label">Add to War Chest (Manual Deposit)</p>
                  <div className="flex gap-3 flex-wrap">
                    <input className="input text-sm flex-1" type="number" min="0.01" step="0.01" placeholder="Amount ($)" value={wcAmount} onChange={e => setWcAmount(e.target.value)} />
                    <input className="input text-sm flex-1" placeholder="Contributor name (optional)" value={wcContributor} onChange={e => setWcContributor(e.target.value)} />
                    <button className="btn-primary" onClick={addFunds} disabled={wcSaving || !wcAmount}>
                      {wcSaving ? 'Adding...' : 'Add Funds'}
                    </button>
                  </div>
                </div>

                <div className="card space-y-2">
                  <p className="label mb-3">Contribution History</p>
                  {warChest.contributions.length === 0 && (
                    <p className="text-sm" style={{ color: 'var(--text2)' }}>No contributions yet.</p>
                  )}
                  {[...warChest.contributions].reverse().slice(0, 20).map((c, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm py-1" style={{ borderBottom: '1px solid var(--border)' }}>
                      <span className="flex-1">{c.name}</span>
                      <span style={{ color: 'var(--success)' }}>+${Number(c.amount).toFixed(2)}</span>
                      <span className="text-xs" style={{ color: 'var(--text2)' }}>{new Date(c.timestamp).toLocaleDateString()}</span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.55rem' }}>{c.method}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!warChest && (
              <div className="card">
                <p className="text-sm" style={{ color: 'var(--text2)' }}>Loading war chest data...</p>
              </div>
            )}
          </div>
        )}

      </div>

      <ChatSidebar sessionToken={null} playerName="Game Master" empireName="GM" color="#ffffff" gmPassword={gmPassword} />
    </div>
  );
}

function JoinPasswordCard({ gmPassword, currentGameId }: { gmPassword: string; currentGameId: string }) {
  const [joinPassword, setJoinPassword] = useState('');
  const [current, setCurrent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/game/state', { headers: { 'X-Game-ID': currentGameId } })
      .then(r => r.json())
      .then(s => setCurrent(s.joinPassword ?? null))
      .catch(() => {});
  }, [currentGameId]);

  async function save() {
    setSaving(true);
    await fetch('/api/game/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gmPassword}`, 'X-Game-ID': currentGameId },
      body: JSON.stringify({ joinPassword }),
    });
    setCurrent(joinPassword);
    setJoinPassword('');
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function disable() {
    setSaving(true);
    await fetch('/api/game/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gmPassword}`, 'X-Game-ID': currentGameId },
      body: JSON.stringify({ joinPassword: null }),
    });
    setCurrent(null);
    setSaving(false);
  }

  return (
    <div className="card space-y-3">
      <p className="label">Player Self-Join</p>
      <p className="text-xs" style={{ color: 'var(--text2)' }}>
        Share this link + join code with players to let them register themselves.
        They will pick 5 unclaimed starting territories.
      </p>
      <div className="flex gap-2 items-center text-xs p-2 rounded" style={{ background: 'var(--surface2)', color: 'var(--accent)' }}>
        <span className="font-mono flex-1">{typeof window !== 'undefined' ? window.location.origin : ''}/join</span>
      </div>
      {current ? (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: 'var(--success)' }}>
            Join is <strong>open</strong>. Current code: <span className="font-mono">{current}</span>
          </p>
          <div className="flex gap-2">
            <input className="input text-sm flex-1" placeholder="Set new code..." value={joinPassword} onChange={e => setJoinPassword(e.target.value)} />
            <button className="btn-primary text-sm" onClick={save} disabled={saving || !joinPassword.trim()}>{saved ? '✓ Saved' : 'Update'}</button>
            <button className="btn-danger text-sm" onClick={disable} disabled={saving}>Disable</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: 'var(--text2)' }}>Join is currently <strong>disabled</strong>. Set a code to enable it.</p>
          <div className="flex gap-2">
            <input className="input text-sm flex-1" placeholder="Join code to share..." value={joinPassword} onChange={e => setJoinPassword(e.target.value)} />
            <button className="btn-primary text-sm" onClick={save} disabled={saving || !joinPassword.trim()}>{saved ? '✓ Saved' : 'Enable Join'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
