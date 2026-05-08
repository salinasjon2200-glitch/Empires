'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ChatSidebar from '@/components/ChatSidebar';

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false });

interface Player { name: string; empire: string; color: string; status: string; passwordHash: string; territories: string[]; eliminatedYear?: number; }
interface TurnCode { used: boolean; player: string; usedAt?: number; }

type Tab = 'overview' | 'actions' | 'codes' | 'processing' | 'pk' | 'players' | 'chats' | 'mapupdate';

export default function GMPage() {
  const [gmPassword, setGmPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authInput, setAuthInput] = useState('');

  const [tab, setTab] = useState<Tab>('overview');
  const [year, setYear] = useState(2032);
  const [players, setPlayers] = useState<Player[]>([]);
  const [territories, setTerritories] = useState({});
  const [actions, setActions] = useState<Record<string, string>>({});
  const [codes, setCodes] = useState<Record<string, TurnCode>>({});
  const [prevPK, setPrevPK] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [processError, setProcessError] = useState('');
  const [allChats, setAllChats] = useState<{ public: unknown[]; private: Record<string, unknown[]>; groups: Record<string, unknown> } | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newCodePlayer, setNewCodePlayer] = useState('');
  const [eliminateTarget, setEliminateTarget] = useState('');
  const [resetPasswordTarget, setResetPasswordTarget] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [turnOpen, setTurnOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [assignEmpire, setAssignEmpire] = useState('');
  const [assignStatus, setAssignStatus] = useState<'active' | 'contested' | 'ungoverned' | 'remove'>('active');
  const [mapSaving, setMapSaving] = useState(false);
  const [mapUpdateDesc, setMapUpdateDesc] = useState('');
  const [mapUpdating, setMapUpdating] = useState(false);
  const [mapUpdateLog, setMapUpdateLog] = useState('');

  const headers = useCallback(() => ({ 'Authorization': `Bearer ${gmPassword}`, 'Content-Type': 'application/json' }), [gmPassword]);

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
    const [stateR, playersR, mapR, actionsR, codesR] = await Promise.all([
      fetch('/api/game/state'),
      fetch('/api/game/setup', { headers: headers() }),
      fetch('/api/map/territories'),
      fetch('/api/turns/actions', { headers: headers() }),
      fetch('/api/turns/codes', { headers: headers() }),
    ]);
    if (stateR.ok) { const s = await stateR.json(); setYear(s.currentYear ?? 2032); setTurnOpen(s.turnOpen ?? false); }
    if (playersR.ok) { const d = await playersR.json(); setPlayers(d.players ?? []); }
    if (mapR.ok) { const d = await mapR.json(); setTerritories(d.territories ?? {}); }
    if (actionsR.ok) { const d = await actionsR.json(); setActions(d.actions ?? {}); }
    if (codesR.ok) { const d = await codesR.json(); setCodes(d.codes ?? {}); }

    // Load prev PK
    const pkR = await fetch(`/api/turns/${(await stateR.clone().json().catch(() => ({ currentYear: 2032 }))).currentYear - 1 || year - 1}/perfect-knowledge`, { headers: headers() });
    if (pkR.ok) { const d = await pkR.json(); setPrevPK(d.perfectKnowledge ?? ''); }
  }, [authed, headers, year]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function loadChats() {
    const r = await fetch('/api/chat/all', { headers: headers() });
    if (r.ok) setAllChats(await r.json());
  }

  useEffect(() => { if (tab === 'chats' && authed) loadChats(); }, [tab, authed]);

  async function processTurn() {
    setProcessing(true);
    setProcessLog([]);
    setProcessError('');
    setProcessLog(l => [...l, `Initiating Turn ${year} processing...`]);
    setProcessLog(l => [...l, 'Step 1: Generating world summary...']);
    const r = await fetch('/api/turns/process', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ previousPerfectKnowledge: prevPK }),
    });
    const d = await r.json();
    if (r.ok) {
      setProcessLog(l => [...l, 'Step 2: Generated Perfect Knowledge + territory map.', 'Step 3: Generated all advisor reports.', `✓ Turn ${year} fully processed.`]);
      if (d.advisorErrors?.length) {
        setProcessLog(l => [...l, `⚠️ Advisor failures: ${d.advisorErrors.join(', ')}`]);
      }
      loadAll();
    } else {
      setProcessError(d.error ?? 'Processing failed');
      setProcessLog(l => [...l, `✗ Error at step ${d.step ?? '?'}: ${d.error}`]);
    }
    setProcessing(false);
  }

  async function addCode() {
    if (!newCode || !newCodePlayer) return;
    await fetch('/api/turns/codes', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ action: 'add', player: newCodePlayer, code: newCode }),
    });
    setNewCode(''); setNewCodePlayer('');
    loadAll();
  }

  async function autoGenerateCodes() {
    await fetch('/api/turns/codes', { method: 'POST', headers: headers(), body: JSON.stringify({ action: 'auto-generate' }) });
    loadAll();
  }

  async function resetCodes() {
    await fetch('/api/turns/codes', { method: 'POST', headers: headers(), body: JSON.stringify({ action: 'reset' }) });
    loadAll();
  }

  async function openTurn() {
    await fetch('/api/game/advance-turn', { method: 'POST', headers: headers() });
    loadAll();
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
    await fetch('/api/game/reset-password', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ empireName: resetPasswordTarget, newPassword: resetPasswordValue }),
    });
    alert('Password reset successfully');
    setResetPasswordTarget(''); setResetPasswordValue('');
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
    ['codes', 'Turn Codes'],
    ['processing', 'Initiate Processing'],
    ['pk', 'Perfect Knowledge'],
    ['players', 'Empire Management'],
    ['chats', 'Intercept All Transmissions'],
    ['mapupdate', 'Map Update'],
  ];

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-sm w-full space-y-6">
          <h1 className="display-font text-3xl font-black text-center" style={{ color: 'var(--accent)' }}>GM AUTHENTICATION REQUIRED</h1>
          <div className="card space-y-4">
            <input type="password" className="input" placeholder="GM password..." value={authInput} onChange={e => setAuthInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} />
            <button className="btn-primary w-full" onClick={login}>Authenticate</button>
          </div>
        </div>
      </div>
    );
  }

  const activePlayers = players.filter(p => p.status === 'active');

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto space-y-4">

        <div className="flex items-center justify-between">
          <h1 className="display-font text-xl font-black" style={{ color: 'var(--accent)' }}>GM DASHBOARD — YEAR {year}</h1>
          <div className="flex gap-2 items-center">
            <span className={`badge ${turnOpen ? 'badge-success' : 'badge-neutral'}`}>{turnOpen ? 'TURN OPEN' : 'TURN CLOSED'}</span>
            {!turnOpen && <button className="btn-primary text-sm" onClick={openTurn}>Open Turn {year}</button>}
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

        {/* OVERVIEW */}
        {tab === 'overview' && (
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
            <div className="card">
              <p className="label mb-2">Turn Codes</p>
              <p className="text-2xl font-bold">{Object.keys(codes).length}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>{Object.values(codes).filter(c => c.used).length} used</p>
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

        {/* CODES */}
        {tab === 'codes' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <button className="btn-primary" onClick={autoGenerateCodes}>Auto-Generate Codes</button>
              <button className="btn-ghost" onClick={resetCodes}>Reset All (Mark Unused)</button>
            </div>

            <div className="card space-y-3">
              <p className="label">Add Custom Code</p>
              <div className="flex gap-3">
                <input className="input font-mono text-sm" placeholder="CODE-XXXX" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} />
                <select className="input text-sm w-48" value={newCodePlayer} onChange={e => setNewCodePlayer(e.target.value)}>
                  <option value="">Select player...</option>
                  {activePlayers.map(p => <option key={p.name} value={p.name}>{p.name} ({p.empire})</option>)}
                </select>
                <button className="btn-primary" onClick={addCode}>Add</button>
              </div>
            </div>

            <div className="card">
              <p className="label mb-3">Current Codes ({Object.keys(codes).length})</p>
              <div className="space-y-2">
                {Object.entries(codes).map(([code, data]) => (
                  <div key={code} className="flex items-center gap-3 text-sm">
                    <code className="font-mono px-2 py-1 rounded text-xs" style={{ background: 'var(--surface2)', color: 'var(--accent)' }}>{code}</code>
                    <span>{data.player}</span>
                    <span className={`badge ml-auto ${data.used ? 'badge-neutral' : 'badge-success'}`} style={{ fontSize: '0.6rem' }}>
                      {data.used ? 'USED' : 'ACTIVE'}
                    </span>
                  </div>
                ))}
                {Object.keys(codes).length === 0 && <p style={{ color: 'var(--text2)' }} className="text-sm">No codes. Click Auto-Generate.</p>}
              </div>
            </div>
          </div>
        )}

        {/* PROCESSING */}
        {tab === 'processing' && (
          <div className="space-y-4">
            <div className="card space-y-4">
              <p className="label">Previous Perfect Knowledge Document</p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>Pre-populated from the database (Year {year - 1}). Edit if needed before processing.</p>
              <textarea
                className="input font-mono text-xs"
                style={{ minHeight: 300 }}
                value={prevPK}
                onChange={e => setPrevPK(e.target.value)}
                placeholder="Paste or edit the previous turn's Perfect Knowledge document..."
              />
            </div>

            {processLog.length > 0 && (
              <div className="card font-mono text-xs space-y-1" style={{ background: 'var(--surface2)' }}>
                {processLog.map((l, i) => (
                  <div key={i} style={{ color: l.startsWith('✓') ? 'var(--success)' : l.startsWith('✗') ? 'var(--danger)' : l.startsWith('⚠️') ? 'var(--warning)' : 'var(--text2)' }}>
                    {l}
                  </div>
                ))}
              </div>
            )}

            {processError && <p className="danger text-sm">{processError}</p>}

            <button
              className="btn-primary text-base py-3 px-8"
              onClick={processTurn}
              disabled={processing}
            >
              {processing ? 'Processing... (do not close this page)' : `Initiate Turn ${year} Processing`}
            </button>
          </div>
        )}

        {/* PERFECT KNOWLEDGE */}
        {tab === 'pk' && (
          <div className="card space-y-3">
            <p className="label">Perfect Knowledge — Year {year - 1}</p>
            {prevPK ? (
              <div className="text-sm font-mono leading-relaxed max-h-screen overflow-y-auto whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                {prevPK}
              </div>
            ) : (
              <p style={{ color: 'var(--text2)' }}>No Perfect Knowledge document for Year {year - 1}.</p>
            )}
          </div>
        )}

        {/* PLAYERS */}
        {tab === 'players' && (
          <div className="space-y-4">
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
                <input className="input text-sm" placeholder="New password" value={resetPasswordValue} onChange={e => setResetPasswordValue(e.target.value)} />
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

      </div>

      <ChatSidebar sessionToken={null} playerName="Game Master" empireName="GM" color="#ffffff" gmPassword={gmPassword} />
    </div>
  );
}
