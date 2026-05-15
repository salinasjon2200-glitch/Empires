'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import ChatSidebar from '@/components/ChatSidebar';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false });

interface Player { name: string; empire: string; color: string; status: string; passwordHash: string; territories: string[]; eliminatedYear?: number; }

type Tab = 'overview' | 'actions' | 'processing' | 'pk' | 'advisors' | 'players' | 'chats' | 'mapupdate' | 'warchest' | 'stats' | 'reset';

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
  const [processPhase, setProcessPhase] = useState<'pk' | 'news' | 'advisors' | 'pk-regen' | 'map-gen' | 'stats' | null>(null);
  const [phase1Done, setPhase1Done] = useState(false);
  const [phase2Done, setPhase2Done] = useState(false);
  const [phase3Done, setPhase3Done] = useState(false);
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
  const [colorEmpire, setColorEmpire] = useState('');
  const [colorValue, setColorValue] = useState('#6366f1');
  const [colorSaving, setColorSaving] = useState(false);
  const [colorLog, setColorLog] = useState('');

  // Merge empires
  const [mergeSelected, setMergeSelected] = useState<string[]>([]);
  const [mergeEmpireName, setMergeEmpireName] = useState('');
  const [mergeColor, setMergeColor] = useState('#8b5cf6');
  const [mergeLeaders, setMergeLeaders] = useState<{ name: string; originalEmpire: string; weight: number; password: string }[]>([]);
  const [mergeSaving, setMergeSaving] = useState(false);
  const [mergeLog, setMergeLog] = useState('');

  // New states
  const [currentGameId, setCurrentGameId] = useState('s2');
  const [gamesList, setGamesList] = useState<Array<{ id: string; name: string; status: string; contentMode: string; createdAt: number }>>([]);
  const [gamesLoaded, setGamesLoaded] = useState(false);
  const [warChest, setWarChest] = useState<{ balance: number; threshold: number; contributions: Array<{ name: string; amount: number; method: string; timestamp: number }>; lastTurnCost: number } | null>(null);
  const [wcAmount, setWcAmount] = useState('');
  const [wcContributor, setWcContributor] = useState('');
  const [wcSaving, setWcSaving] = useState(false);
  const [wcDeductAmount, setWcDeductAmount] = useState('');
  const [wcDeductReason, setWcDeductReason] = useState('');
  const [wcDeducting, setWcDeducting] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [newGameName, setNewGameName] = useState('');
  const [newGameYear, setNewGameYear] = useState(2032);
  const [newGameContent, setNewGameContent] = useState<'unrestricted' | 'school'>('unrestricted');
  const [newGameSetup, setNewGameSetup] = useState<'bidding' | 'random'>('bidding');
  const [creatingGame, setCreatingGame] = useState(false);
  const [randomPool, setRandomPool] = useState<string[]>([]);
  const [randomAssignments, setRandomAssignments] = useState<Array<{ playerName: string; empire: string; color: string; country: string }>>([]);
  const [randomizing, setRandomizing] = useState(false);
  const [turnOpen, setTurnOpen] = useState(true);
  const [worldNews, setWorldNews] = useState('');
  const [worldNewsYear, setWorldNewsYear] = useState<number | null>(null);
  const [worldNewsSaving, setWorldNewsSaving] = useState(false);
  const [worldNewsSaved, setWorldNewsSaved] = useState(false);

  // Actions tab live refresh
  const [actionsLastUpdated, setActionsLastUpdated] = useState<number | null>(null);
  const [actionsRefreshing, setActionsRefreshing] = useState(false);

  // GM Alerts
  const [alertsYear, setAlertsYear] = useState<number | null>(null);
  const [alertsText, setAlertsText] = useState('');
  const [alertsRunning, setAlertsRunning] = useState(false);
  const [alertsExtracting, setAlertsExtracting] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  const [alertsActions, setAlertsActions] = useState<Array<{
    type: 'eliminate' | 'rename' | 'merge' | 'reset_password' | 'other';
    empire?: string;
    empires?: string[];
    newEmpireName?: string;
    newLeaderName?: string;
    details: string;
  }>>([]);
  const [alertsActionStatus, setAlertsActionStatus] = useState<Record<number, 'pending' | 'running' | 'done' | 'error'>>({});

  // Empire Rename
  const [renameOldEmpire, setRenameOldEmpire] = useState('');
  const [renameNewName, setRenameNewName] = useState('');
  const [renameNewLeader, setRenameNewLeader] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameLog, setRenameLog] = useState('');

  // Change Leader
  const [leaderEmpire, setLeaderEmpire] = useState('');
  const [leaderNewName, setLeaderNewName] = useState('');
  const [leaderNewPassword, setLeaderNewPassword] = useState('');
  const [leaderSaving, setLeaderSaving] = useState(false);
  const [leaderLog, setLeaderLog] = useState('');

  // Advisor errors from last run
  const [advisorErrors, setAdvisorErrors] = useState<string[]>([]);

  // Advisor report viewer
  const [advisorViewYear, setAdvisorViewYear] = useState<number | null>(null);
  const [advisorViewPlayer, setAdvisorViewPlayer] = useState('');
  const [advisorViewReport, setAdvisorViewReport] = useState('');
  const [advisorViewLoading, setAdvisorViewLoading] = useState(false);
  const [advisorViewError, setAdvisorViewError] = useState('');

  // Per-player advisor regeneration
  const [advisorRegenYear, setAdvisorRegenYear] = useState<number | null>(null);
  const [advisorRegenActions, setAdvisorRegenActions] = useState<Record<string, string>>({});
  const [advisorRegenLoading, setAdvisorRegenLoading] = useState<Record<string, boolean>>({});
  const [advisorRegenStatus, setAdvisorRegenStatus] = useState<Record<string, 'ok' | 'error'>>({});
  const [advisorRegenBatchRunning, setAdvisorRegenBatchRunning] = useState<number | null>(null);
  const [advisorRegenConsoles, setAdvisorRegenConsoles] = useState<string[]>(['', '', '']);
  const [advisorRegenConsoleLabels, setAdvisorRegenConsoleLabels] = useState<string[]>(['', '', '']);

  // Bidding control
  const [biddingOpen, setBiddingOpen] = useState(false);
  const [biddingClosesAt, setBiddingClosesAt] = useState<number | null>(null);
  const [biddingBids, setBiddingBids] = useState<Record<string, { playerName: string; empireName: string; amount: number }>>({});
  const [biddingPoints, setBiddingPoints] = useState<Record<string, number>>({});
  const [biddingMinutes, setBiddingMinutes] = useState('');
  const [biddingAction, setBiddingAction] = useState<string | null>(null);
  const [biddingLog, setBiddingLog] = useState('');
  const [biddingCountdown, setBiddingCountdown] = useState('');

  // Reset game
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetStartYear, setResetStartYear] = useState(2032);
  const [resetOpenBidding, setResetOpenBidding] = useState(false);
  const [resetBiddingDeadline, setResetBiddingDeadline] = useState('');  // datetime-local string
  const [resetKeepSettings, setResetKeepSettings] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetLog, setResetLog] = useState('');

  // Stats generation
  const [statsLog, setStatsLog] = useState<string[]>([]);
  const [statsForceInitial, setStatsForceInitial] = useState(false);
  const [statsEmpireStatus, setStatsEmpireStatus] = useState<Record<string, 'streaming'|'done'|'error'>>({});
  const [statsEmpireChars, setStatsEmpireChars] = useState<Record<string, number>>({});
  const [statsEmpireText, setStatsEmpireText] = useState<Record<string, string>>({});
  const [statsLiveEmpire, setStatsLiveEmpire] = useState<string>('');

  // GM stats viewer
  const [gmStatsYear, setGmStatsYear] = useState<string>('');
  const [gmStatsEmpire, setGmStatsEmpire] = useState('');
  const [gmStatsData, setGmStatsData] = useState<Record<string, unknown> | null>(null);
  const [gmStatsLoading, setGmStatsLoading] = useState(false);
  const [gmStatsError, setGmStatsError] = useState('');

  // Manually add player
  const [addPlayerName, setAddPlayerName] = useState('');
  const [addPlayerEmpire, setAddPlayerEmpire] = useState('');
  const [addPlayerPassword, setAddPlayerPassword] = useState('');
  const [addPlayerColor, setAddPlayerColor] = useState('#6366f1');
  const [addPlayerSaving, setAddPlayerSaving] = useState(false);
  const [addPlayerLog, setAddPlayerLog] = useState('');

  // Manual year override
  const [yearEditValue, setYearEditValue] = useState<string>('');
  const [yearEditing, setYearEditing] = useState(false);
  const [yearSaving, setYearSaving] = useState(false);

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
    if (!stored) return;
    // Verify the stored password against the server before accepting it
    fetch('/api/auth/gm-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: stored }),
    }).then(r => {
      if (r.ok) {
        setGmPassword(stored);
        setAuthed(true);
      } else {
        // Stored password is wrong/changed — clear it so it can't be reused
        localStorage.removeItem('empires-gm');
      }
    }).catch(() => {
      // Network error — don't auto-login; require manual entry
      localStorage.removeItem('empires-gm');
    });
  }, []);

  function logout() {
    localStorage.removeItem('empires-gm');
    setGmPassword('');
    setAuthed(false);
    setAuthInput('');
  }

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
      setTurnOpen(s.turnOpen !== false);
      const lastCompleted = s.lastTurnCompletedAt;
      if (lastCompleted) {
        const next3PM = new Date(lastCompleted); next3PM.setDate(next3PM.getDate() + 1); next3PM.setHours(15, 0, 0, 0);
        const remaining = next3PM.getTime() - Date.now();
        setCooldownRemaining(Math.max(0, remaining));
      } else {
        setCooldownRemaining(0);
      }
    }
    if (playersR.ok) { const d = await playersR.json(); setPlayers(d.players ?? []); }
    if (mapR.ok) { const d = await mapR.json(); setTerritories(d.territories ?? {}); }
    if (actionsR.ok) { const d = await actionsR.json(); setActions(d.actions ?? {}); }
    const [archR, wcR] = await Promise.all([
      fetch('/api/game/archive'),
      fetch('/api/war-chest', { headers: headers() }),
    ]);
    if (archR.ok) { const d = await archR.json(); setArchive(d.archive ?? []); }
    if (wcR.ok) { const d = await wcR.json(); setWarChest(d.warChest); }
    // Bidding state
    const bidR = await fetch('/api/bidding/state');
    if (bidR.ok) {
      const d = await bidR.json();
      setBiddingOpen(d.open ?? false);
      setBiddingClosesAt(d.closesAt ?? null);
      setBiddingBids(d.bids ?? {});
      setBiddingPoints(d.points ?? {});
    }

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

  // Bidding countdown ticker
  useEffect(() => {
    if (!biddingOpen || !biddingClosesAt) { setBiddingCountdown(''); return; }
    const tick = () => {
      const ms = biddingClosesAt - Date.now();
      if (ms <= 0) { setBiddingCountdown('CLOSED'); return; }
      const totalSec = Math.floor(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setBiddingCountdown(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [biddingOpen, biddingClosesAt]);

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

  async function deductFunds() {
    if (!wcDeductAmount || isNaN(Number(wcDeductAmount)) || Number(wcDeductAmount) <= 0) return;
    setWcDeducting(true);
    await fetch('/api/war-chest', {
      method: 'DELETE',
      headers: headers(),
      body: JSON.stringify({ amount: Number(wcDeductAmount), reason: wcDeductReason }),
    });
    setWcDeductAmount('');
    setWcDeductReason('');
    await loadWarChest();
    setWcDeducting(false);
  }

  async function loadChats() {
    const r = await fetch('/api/chat/all', { headers: headers() });
    if (r.ok) setAllChats(await r.json());
  }

  async function deleteMsg(target: string, messageId: string) {
    await fetch('/api/chat/all', { method: 'DELETE', headers: headers(), body: JSON.stringify({ target, messageId }) });
    await loadChats();
  }

  useEffect(() => { if (tab === 'chats' && authed) loadChats(); }, [tab, authed]);

  // Refresh actions + player list when switching to actions tab, then poll every 15s
  const refreshActions = useCallback(async () => {
    if (!authed) return;
    setActionsRefreshing(true);
    const [actionsR, playersR] = await Promise.all([
      fetch('/api/turns/actions', { headers: headers() }),
      fetch('/api/game/setup', { headers: headers() }),
    ]);
    if (actionsR.ok) { const d = await actionsR.json(); setActions(d.actions ?? {}); }
    if (playersR.ok) { const d = await playersR.json(); setPlayers(d.players ?? []); }
    setActionsLastUpdated(Date.now());
    setActionsRefreshing(false);
  }, [authed, headers]);

  useEffect(() => {
    if (tab !== 'actions' || !authed) return;
    refreshActions();
    const id = setInterval(refreshActions, 15000);
    return () => clearInterval(id);
  }, [tab, authed, refreshActions]);

  // Load submitted actions for the selected advisor regen year (to filter out no-action players)
  useEffect(() => {
    if (!advisorRegenYear || !authed) { setAdvisorRegenActions({}); return; }
    fetch(`/api/turns/${advisorRegenYear}/actions`, { headers: headers() })
      .then(r => r.ok ? r.json() : { actions: {} })
      .then(d => setAdvisorRegenActions(d.actions ?? {}))
      .catch(() => setAdvisorRegenActions({}));
  }, [advisorRegenYear, authed, headers]);

  const phaseAbortRef = useRef<AbortController | null>(null);

  function forceEndPhase() {
    if (phaseAbortRef.current) {
      phaseAbortRef.current.abort();
      phaseAbortRef.current = null;
    }
    setProcessing(false);
    setProcessPhase(null);
    setStreamingText('');
    setProcessLog(l => [...l, '⚡ Force-ended by GM. Checking database state…']);
    // Check if server actually finished Phase 1 (it keeps running server-side)
    fetch('/api/game/state')
      .then(r => r.json())
      .then(async s => {
        const serverYear = s.currentYear ?? 2032;
        if (serverYear > year) {
          // Year advanced — Phase 1 completed on the server
          setYear(serverYear);
          setPhase1Done(true);
          setProcessLog(l => [...l, `✓ Phase 1 confirmed complete in DB. Year advanced to ${serverYear}. Ready for Phase 2.`]);
          loadAll();
        } else {
          // Check if a PK document exists for the current year
          const pkR = await fetch(`/api/turns/${year}/perfect-knowledge`, { headers: headers() });
          if (pkR.ok) {
            setPhase1Done(true);
            setProcessLog(l => [...l, `✓ PK found in DB for Year ${year}. Phase 1 likely complete. Ready for Phase 2.`]);
          } else {
            setProcessLog(l => [...l, `⚠️ No PK found in DB yet. Server may still be generating — wait a moment then use "Force unlock" on Phase 2 to check again.`]);
          }
        }
      })
      .catch(() => setProcessLog(l => [...l, '⚠️ Could not reach server to verify state.']));
  }

  async function runPhase(phase: 'pk' | 'news' | 'advisors' | 'pk-regen' | 'map-gen', retryOnly = false) {
    if (phase === 'pk' && cooldownRemaining > 0) {
      setProcessError(`Cooldown active: ${Math.ceil(cooldownRemaining / 3600000)} hours remaining.`);
      return;
    }
    if (phase === 'pk') { setPhase1Done(false); setPhase2Done(false); setPhase3Done(false); }
    setProcessing(true);
    setProcessPhase(phase);
    setProcessLog(l => [...l,
      phase === 'pk' ? `━━ PHASE 1: Perfect Knowledge ━━`
      : phase === 'news' ? `━━ PHASE 2: World News Report ━━`
      : phase === 'pk-regen' ? `━━ REGEN: Perfect Knowledge ━━`
      : phase === 'map-gen' ? `━━ MAP GENERATOR ━━`
      : retryOnly ? `━━ PHASE 3 RETRY: Failed Advisors ━━`
      : `━━ PHASE 3: Advisor Reports ━━`]);
    setProcessError('');
    setStreamingText('');
    setStreamingStep(0);
    setAdvisorProgress({ index: 0, total: 0 });

    const abortController = new AbortController();
    phaseAbortRef.current = abortController;

    let r: Response;
    try {
      r = await fetch('/api/turns/process', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ previousPerfectKnowledge: prevPK, phase, retryOnly }),
        signal: abortController.signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // force-ended — forceEndPhase already cleaned up state
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
              setProcessLog(l => [...l, `  ✗ ${event.empire} — failed${event.error ? `: ${event.error}` : ''}`]);
            } else if (event.type === 'done') {
              if (event.phase === 'pk-regen') {
                setProcessLog(l => [...l, `✓ Perfect Knowledge regenerated for Year ${event.year}.`]);
                loadAll();
              } else if (event.phase === 'map-gen') {
                setProcessLog(l => [...l, `✓ Map updated from PK for Year ${event.year}.`]);
                loadAll();
              } else if (event.phase === 'pk') {
                setProcessLog(l => [...l, `✓ Phase 1 complete. Year ${event.year} → ${event.nextYear}.`]);
                setProcessLog(l => [...l, `Ready for Phase 2: World News Report.`]);
                setPhase1Done(true);
              } else if (event.phase === 'news') {
                setProcessLog(l => [...l, `✓ Phase 2 complete. World News Report published.`]);
                setProcessLog(l => [...l, `Ready for Phase 3: Advisor Reports.`]);
                setPhase2Done(true);
              } else if (event.phase === 'advisors') {
                const errs: string[] = event.advisorErrors ?? [];
                setAdvisorErrors(errs);
                if (errs.length) {
                  setProcessLog(l => [...l, `⚠️ Advisor failures: ${errs.join(', ')}`]);
                  setProcessLog(l => [...l, `Use "Retry Failures" to re-run only the failed ones.`]);
                } else {
                  setProcessLog(l => [...l, `✓ Phase 3 complete. All advisor reports generated.`]);
                  setProcessLog(l => [...l, `Ready for Phase 4: Empire Statistics.`]);
                  setPhase3Done(true);
                }
                setPhase1Done(false);
                setPhase2Done(false);
              }
              loadAll();
            } else if (event.type === 'error') {
              setProcessError(event.message);
            }
          } catch { /* malformed line — skip */ }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // force-ended — forceEndPhase already handled state cleanup
      setProcessError(`Stream read error: ${e}`);
    }

    phaseAbortRef.current = null;
    setProcessing(false);
    setStreamingText('');
    setProcessPhase(null);
  }

  async function saveYear() {
    const newYear = parseInt(yearEditValue);
    if (isNaN(newYear) || newYear < 2000 || newYear > 2200) {
      alert('Enter a valid year between 2000 and 2200.');
      return;
    }
    setYearSaving(true);
    const r = await fetch('/api/game/patch-state', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ currentYear: newYear }),
    });
    if (r.ok) {
      setYear(newYear);
      setYearEditing(false);
    } else {
      const d = await r.json().catch(() => ({}));
      alert(`Failed to set year: ${d.error ?? r.statusText}`);
    }
    setYearSaving(false);
  }

  async function runStats(skipExisting = false, targetYear?: number) {
    setProcessing(true);
    setProcessPhase('stats');
    const statsYear = targetYear ?? year - 1;
    setStatsLog([`━━ Empire Statistics — Year ${statsYear} ━━`]);
    setStatsEmpireStatus({});
    setStatsEmpireChars({});
    setStatsEmpireText({});
    setStatsLiveEmpire('');
    setProcessError('');

    const abortController = new AbortController();
    phaseAbortRef.current = abortController;

    let r: Response;
    try {
      r = await fetch(`/api/turns/${statsYear}/stats`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ skipExisting, forceInitial: statsForceInitial }),
        signal: abortController.signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setProcessError('Network error — could not reach stats server.');
      setProcessing(false);
      setProcessPhase(null);
      return;
    }

    if (!r.ok || !r.body) {
      const errData = await r.json().catch(() => ({}));
      setProcessError(errData.error ?? 'Failed to start stats generation.');
      setProcessing(false);
      setProcessPhase(null);
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
            if (event.type === 'start') {
              setStatsLog(l => [...l, `Generating stats for ${event.total} empires…`]);
            } else if (event.type === 'empire_start') {
              setStatsLog(l => [...l, `  ⟳ ${event.empire}${event.isInitial ? ' (baseline)' : ''}`]);
              setStatsEmpireStatus(m => ({ ...m, [event.empire]: 'streaming' }));
              setStatsLiveEmpire(e => e || event.empire);
            } else if (event.type === 'token') {
              setStatsEmpireChars(m => ({ ...m, [event.empire]: (m[event.empire] ?? 0) + (event.text?.length ?? 0) }));
              setStatsEmpireText(m => ({ ...m, [event.empire]: (m[event.empire] ?? '') + (event.text ?? '') }));
            } else if (event.type === 'empire_done') {
              setStatsLog(l => [...l, `  ✓ ${event.empire}`]);
              setStatsEmpireStatus(m => ({ ...m, [event.empire]: 'done' }));
            } else if (event.type === 'skipped') {
              setStatsLog(l => [...l, `  ↷ ${event.empire} (already has stats — skipped)`]);
              setStatsEmpireStatus(m => ({ ...m, [event.empire]: 'done' }));
            } else if (event.type === 'empire_error') {
              setStatsLog(l => [...l, `  ✗ ${event.empire} — ${event.error}`]);
              setStatsEmpireStatus(m => ({ ...m, [event.empire]: 'error' }));
            } else if (event.type === 'done') {
              setStatsLog(l => [...l, `✓ Phase 4 complete. ${event.succeeded} succeeded, ${event.failed} failed.`]);
            } else if (event.type === 'error') {
              setProcessError(event.error);
            }
          } catch { /* malformed line */ }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setProcessError(`Stats stream error: ${e}`);
    }

    phaseAbortRef.current = null;
    setProcessing(false);
    setProcessPhase(null);
  }

  async function doBiddingAction(action: 'open' | 'close' | 'confirm') {
    if (action === 'confirm' && !confirm('Finalize all bids and assign territories? This cannot be undone.')) return;
    setBiddingAction(action);
    setBiddingLog('');
    const openMinutes = parseInt(biddingMinutes) || 0;
    const r = await fetch('/api/bidding/close', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ action, openMinutes }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setBiddingLog(`Error: ${d.error ?? 'Unknown'}`);
    } else if (action === 'open') {
      setBiddingLog(d.closesAt ? `Bidding open — closes at ${new Date(d.closesAt).toLocaleTimeString()}` : 'Bidding open (no timer)');
    } else if (action === 'close') {
      setBiddingLog('Bidding closed.');
    } else if (action === 'confirm') {
      const count = Object.keys(d.territories ?? {}).length;
      setBiddingLog(`✓ Territories assigned: ${count} countries allocated.`);
    }
    setBiddingAction(null);
    await loadAll();
  }

  async function loadGmStats() {
    const targetYear = parseInt(gmStatsYear) || year;
    setGmStatsLoading(true);
    setGmStatsError('');
    setGmStatsData(null);
    // Try requested year first; if not found and user didn't specify, also try year-1
    let r = await fetch(`/api/turns/${targetYear}/stats`, { headers: headers() });
    let usedYear = targetYear;
    if (!r.ok && !gmStatsYear && targetYear === year) {
      // Automatically fall back to previous year
      const fallback = year - 1;
      const r2 = await fetch(`/api/turns/${fallback}/stats`, { headers: headers() });
      if (r2.ok) { r = r2; usedYear = fallback; }
    }
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setGmStatsError(d.error ?? `No stats found for Year ${targetYear}.`);
    } else {
      const d = await r.json();
      const statsObj = d.stats ?? {};
      const empires = Object.keys(statsObj);
      if (empires.length === 0) {
        setGmStatsError(`No empire stats have been generated for Year ${usedYear} yet.`);
      } else {
        if (usedYear !== targetYear) setGmStatsYear(String(usedYear));
        setGmStatsData(statsObj);
        if (!gmStatsEmpire || !statsObj[gmStatsEmpire]) {
          setGmStatsEmpire(empires[0]);
        }
      }
    }
    setGmStatsLoading(false);
  }

  async function addPlayerManually() {
    if (!addPlayerName.trim() || !addPlayerEmpire.trim() || !addPlayerPassword.trim()) {
      setAddPlayerLog('Error: name, empire, and password are all required.');
      return;
    }
    setAddPlayerSaving(true);
    setAddPlayerLog('');
    const r = await fetch('/api/game/add-player', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        name: addPlayerName.trim(),
        empire: addPlayerEmpire.trim(),
        password: addPlayerPassword,
        color: addPlayerColor,
      }),
    });
    const d = await r.json();
    if (r.ok) {
      setAddPlayerLog(`✓ ${addPlayerEmpire} (${addPlayerName}) added to the game.`);
      setAddPlayerName(''); setAddPlayerEmpire(''); setAddPlayerPassword(''); setAddPlayerColor('#6366f1');
      loadAll();
    } else {
      setAddPlayerLog(`Error: ${d.error ?? 'Failed to add player'}`);
    }
    setAddPlayerSaving(false);
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

  async function runAlerts(targetYear: number) {
    setAlertsRunning(true);
    setAlertsExtracting(false);
    setAlertsText('');
    setAlertsError('');
    setAlertsActions([]);
    setAlertsActionStatus({});
    try {
      const r = await fetch('/api/gm/alerts', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ year: targetYear }),
      });
      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}));
        setAlertsError(d.error ?? 'Failed to generate alerts');
        setAlertsRunning(false);
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        let chunkText = '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === 'token') chunkText += ev.text;
            if (ev.type === 'extracting') { setAlertsRunning(false); setAlertsExtracting(true); }
            if (ev.type === 'done') { setAlertsActions(ev.actions ?? []); setAlertsExtracting(false); }
            if (ev.type === 'error') setAlertsError(ev.error ?? 'Unknown error');
          } catch { /* skip */ }
        }
        if (chunkText) setAlertsText(prev => prev + chunkText);
      }
    } catch (e) {
      setAlertsError(`Network error: ${e}`);
    }
    setAlertsRunning(false);
    setAlertsExtracting(false);
  }

  async function executeAlertAction(idx: number, action: typeof alertsActions[0]) {
    setAlertsActionStatus(prev => ({ ...prev, [idx]: 'running' }));
    try {
      if (action.type === 'eliminate' && action.empire) {
        const r = await fetch('/api/game/eliminate', {
          method: 'POST', headers: headers(),
          body: JSON.stringify({ empireName: action.empire, year }),
        });
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
        setAlertsActionStatus(prev => ({ ...prev, [idx]: 'done' }));
        loadAll();
      } else if (action.type === 'rename' && action.empire) {
        // Pre-fill the rename form and switch to players tab
        setRenameOldEmpire(action.empire);
        setRenameNewName(action.newEmpireName ?? '');
        setRenameNewLeader(action.newLeaderName ?? '');
        setTab('players');
        setAlertsActionStatus(prev => ({ ...prev, [idx]: 'done' }));
      } else if (action.type === 'merge' && action.empires?.length) {
        // Pre-fill the merge form and switch to players tab
        setMergeSelected(action.empires);
        setMergeEmpireName(action.newEmpireName ?? '');
        const nextLeaders = action.empires.map(empName => {
          const pl = players.find(pl2 => pl2.empire === empName);
          return { name: pl?.name ?? empName, originalEmpire: empName, weight: 0, password: '' };
        });
        setMergeLeaders(nextLeaders);
        setTab('players');
        setAlertsActionStatus(prev => ({ ...prev, [idx]: 'done' }));
      } else if (action.type === 'reset_password' && action.empire) {
        setResetPasswordTarget(action.empire);
        setTab('players');
        setAlertsActionStatus(prev => ({ ...prev, [idx]: 'done' }));
      } else {
        setAlertsActionStatus(prev => ({ ...prev, [idx]: 'done' }));
      }
    } catch {
      setAlertsActionStatus(prev => ({ ...prev, [idx]: 'error' }));
    }
  }

  async function renameEmpire() {
    if (!renameOldEmpire || !renameNewName.trim()) return;
    setRenameSaving(true);
    setRenameLog('');
    const r = await fetch('/api/game/rename', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        oldEmpireName: renameOldEmpire,
        newEmpireName: renameNewName.trim(),
        newLeaderName: renameNewLeader.trim() || undefined,
      }),
    });
    const d = await r.json();
    if (r.ok) {
      setRenameLog(`✓ Renamed "${d.oldEmpireName}" → "${d.newEmpireName}"${d.oldLeaderName !== d.newLeaderName ? ` | Leader: "${d.oldLeaderName}" → "${d.newLeaderName}"` : ''} (${d.territoriesUpdated} territories updated)`);
      setRenameOldEmpire('');
      setRenameNewName('');
      setRenameNewLeader('');
      loadAll();
    } else {
      setRenameLog(`Error: ${d.error ?? 'Unknown error'}`);
    }
    setRenameSaving(false);
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
      const rawHint = d.raw ? `\n\nAI said: "${d.raw}"` : '';
      setMapUpdateLog(`Error: ${d.error ?? 'Unknown error'}${rawHint}`);
    }
    setMapUpdating(false);
  }

  const tabs: [Tab, string][] = [
    ['overview', 'Overview'],
    ['actions', 'Actions'],
    ['processing', 'Initiate Processing'],
    ['pk', 'Perfect Knowledge'],
    ['advisors', 'Advisor Reports'],
    ['players', 'Empire Management'],
    ['chats', 'Intercept All Transmissions'],
    ['mapupdate', 'Map Update'],
    ['warchest', 'War Chest'],
    ['stats', 'Empire Stats'],
    ['reset', '⚠ Reset Game'],
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
            <span className={`badge ${turnOpen ? 'badge-success' : 'badge-danger'}`}>
              {turnOpen ? 'TURN OPEN' : 'TURN CLOSED'}
            </span>
            <button
              className="btn-ghost text-xs"
              onClick={async () => {
                const r = await fetch('/api/game/patch-state', {
                  method: 'POST',
                  headers: headers(),
                  body: JSON.stringify({ turnOpen: !turnOpen }),
                });
                if (r.ok) setTurnOpen(t => !t);
              }}
            >
              {turnOpen ? 'Close Turn' : 'Open Turn'}
            </button>
            <button
              className="btn-ghost text-xs"
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={() => { if (confirm('Log out of GM Dashboard?')) logout(); }}
            >
              🔒 Log Out
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 flex-wrap" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {tabs.map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
              style={{
                color: t === 'reset'
                  ? (tab === t ? 'var(--danger)' : 'rgba(239,68,68,0.6)')
                  : (tab === t ? 'var(--accent)' : 'var(--text2)'),
                borderBottom: tab === t
                  ? `2px solid ${t === 'reset' ? 'var(--danger)' : 'var(--accent)'}`
                  : '2px solid transparent',
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
                {yearEditing ? (
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="number"
                      className="input text-sm w-28"
                      value={yearEditValue}
                      onChange={e => setYearEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveYear();
                        if (e.key === 'Escape') setYearEditing(false);
                      }}
                      autoFocus
                    />
                    <button
                      className="btn-primary text-xs px-3 py-1"
                      onClick={saveYear}
                      disabled={yearSaving}
                    >{yearSaving ? '…' : 'Set'}</button>
                    <button className="btn-ghost text-xs px-2 py-1" onClick={() => setYearEditing(false)}>✕</button>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Year {year}</p>
                    <button
                      className="text-xs underline"
                      style={{ color: 'var(--text2)' }}
                      onClick={() => { setYearEditValue(String(year)); setYearEditing(true); }}
                    >edit</button>
                  </div>
                )}
                <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>{Object.keys(actions).length}/{activePlayers.length} actions submitted</p>
              </div>
              <div className="card">
                <p className="label mb-2">Active Empires</p>
                <p className="text-2xl font-bold">{activePlayers.length}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>{players.filter(p => p.status === 'eliminated').length} eliminated</p>
              </div>

              {/* Bidding Control */}
              <div className="md:col-span-2 lg:col-span-3 card space-y-3" style={{ borderColor: biddingOpen ? 'var(--accent)' : Object.keys(biddingBids).length > 0 ? 'var(--warning)' : 'var(--border)' }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="label" style={{ color: biddingOpen ? 'var(--accent)' : 'var(--text2)' }}>
                      🏛 Territory Bidding
                      {biddingOpen
                        ? <span className="ml-2 badge badge-success" style={{ fontSize: '0.6rem' }}>LIVE</span>
                        : Object.keys(biddingBids).length > 0
                          ? <span className="ml-2 badge" style={{ fontSize: '0.6rem', background: 'var(--warning)', color: '#000' }}>CLOSED — PENDING CONFIRMATION</span>
                          : null}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                      {biddingOpen
                        ? `${Object.keys(biddingBids).length} active bid${Object.keys(biddingBids).length !== 1 ? 's' : ''} across ${Object.keys(biddingPoints).length} player${Object.keys(biddingPoints).length !== 1 ? 's' : ''} — bidding is live, players can still place bids`
                        : Object.keys(biddingBids).length > 0
                          ? `Bidding closed. ${Object.keys(biddingBids).length} bids pending. Review below then confirm to assign territories.`
                          : 'Open bidding to let players claim starting territories.'}
                    </p>
                  </div>
                  {biddingOpen && biddingCountdown && (
                    <div className="text-center">
                      <p className="text-xs" style={{ color: 'var(--text2)' }}>Time remaining</p>
                      <p className="font-mono font-bold text-lg" style={{ color: biddingCountdown === 'CLOSED' ? 'var(--danger)' : 'var(--accent)' }}>{biddingCountdown}</p>
                    </div>
                  )}
                </div>

                {/* ── PHASE A: Bidding is LIVE — show live bids + Close button only ── */}
                {biddingOpen && (
                  <div className="space-y-3">
                    {Object.keys(biddingBids).length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                              <th className="text-left py-1 pr-3 font-semibold">Country</th>
                              <th className="text-left py-1 pr-3 font-semibold">Leading Bidder</th>
                              <th className="text-right py-1 font-semibold">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(biddingBids).sort(([a], [b]) => a.localeCompare(b)).map(([country, bid]) => (
                              <tr key={country} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                                <td className="py-1 pr-3">{country}</td>
                                <td className="py-1 pr-3">{bid.empireName} ({bid.playerName})</td>
                                <td className="py-1 text-right font-mono">{bid.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--text2)' }}>No bids placed yet.</p>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        className="btn-primary text-sm"
                        style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                        onClick={() => doBiddingAction('close')}
                        disabled={!!biddingAction}
                      >
                        {biddingAction === 'close' ? 'Closing…' : '🔒 Close Bidding'}
                      </button>
                      <p className="text-xs" style={{ color: 'var(--text2)' }}>
                        Territories are <strong>not</strong> assigned until you close bidding and then confirm.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── PHASE B: Bidding is CLOSED with pending bids — review + Confirm ── */}
                {!biddingOpen && Object.keys(biddingBids).length > 0 && (
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                            <th className="text-left py-1 pr-3 font-semibold">Country</th>
                            <th className="text-left py-1 pr-3 font-semibold">Winner</th>
                            <th className="text-right py-1 font-semibold">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(biddingBids).sort(([a], [b]) => a.localeCompare(b)).map(([country, bid]) => (
                            <tr key={country} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                              <td className="py-1 pr-3">{country}</td>
                              <td className="py-1 pr-3">{bid.empireName} ({bid.playerName})</td>
                              <td className="py-1 text-right font-mono">{bid.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        className="btn-primary text-sm"
                        style={{ background: '#22c55e', borderColor: '#22c55e' }}
                        onClick={() => doBiddingAction('confirm')}
                        disabled={!!biddingAction}
                      >
                        {biddingAction === 'confirm' ? 'Assigning territories…' : `✓ Confirm & Assign ${Object.keys(biddingBids).length} Territories`}
                      </button>
                      <button
                        className="btn-ghost text-sm"
                        onClick={() => doBiddingAction('open')}
                        disabled={!!biddingAction}
                      >
                        {biddingAction === 'open' ? 'Reopening…' : 'Re-open Bidding'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── PHASE C: Bidding closed, no pending bids — open a new round or generate stats ── */}
                {!biddingOpen && Object.keys(biddingBids).length === 0 && (
                  <div className="space-y-3">
                    <div className="flex items-end gap-3 flex-wrap">
                      <div>
                        <label className="label">Timer (minutes, optional)</label>
                        <input
                          type="number"
                          className="input text-sm"
                          style={{ width: '8rem' }}
                          placeholder="No limit"
                          min={1}
                          value={biddingMinutes}
                          onChange={e => setBiddingMinutes(e.target.value)}
                        />
                      </div>
                      <button
                        className="btn-primary text-sm"
                        onClick={() => doBiddingAction('open')}
                        disabled={!!biddingAction}
                      >
                        {biddingAction === 'open' ? 'Opening…' : '🏛 Open Bidding'}
                      </button>
                    </div>
                    <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                      <button
                        className="btn-ghost text-sm w-full py-2"
                        onClick={() => runStats(false, year)}
                        disabled={processing}
                      >
                        {processing && processPhase === 'stats'
                          ? '📊 Generating starting stats… do not close'
                          : `📊 Generate Starting Stats for Year ${year}`}
                      </button>
                      {statsLog.length > 0 && processPhase === 'stats' && (
                        <div className="text-xs font-mono space-y-0.5 max-h-32 overflow-y-auto p-2 rounded mt-2" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                          {statsLog.map((l, i) => <div key={i}>{l}</div>)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {biddingLog && (
                  <p className="text-xs font-mono" style={{ color: biddingLog.startsWith('Error') ? 'var(--danger)' : '#22c55e' }}>{biddingLog}</p>
                )}
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

            {/* GM Alerts */}
            <div className="card space-y-3 lg:col-span-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="label" style={{ color: 'var(--accent)' }}>🚨 GM Alerts — AI Action Review</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                    Reads the Perfect Knowledge document and identifies GM panel actions: eliminations, merges, renames, password resets.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="input text-sm"
                    value={alertsYear ?? ''}
                    onChange={e => setAlertsYear(Number(e.target.value))}
                  >
                    <option value="">— Select year —</option>
                    {[...archive].sort((a, b) => b - a).map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                    <option value={year - 1}>Year {year - 1} (latest)</option>
                  </select>
                  <button
                    className="btn-primary text-sm"
                    disabled={alertsRunning || alertsExtracting || !alertsYear}
                    onClick={() => alertsYear && runAlerts(alertsYear)}
                  >
                    {alertsRunning ? 'Analyzing…' : alertsExtracting ? 'Extracting…' : '⚡ Run Analysis'}
                  </button>
                  {alertsText && (
                    <button className="btn-ghost text-xs" onClick={() => { setAlertsText(''); setAlertsActions([]); setAlertsActionStatus({}); }}>Clear</button>
                  )}
                </div>
              </div>
              {alertsError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{alertsError}</p>}

              {/* Streaming analysis text */}
              {(alertsRunning || alertsExtracting || alertsText) && (
                <div
                  className="text-sm leading-relaxed p-3 rounded whitespace-pre-wrap"
                  style={{ background: 'var(--surface2)', color: 'var(--text)', maxHeight: '40vh', overflowY: 'auto', fontFamily: 'inherit' }}
                >
                  {alertsText || <span style={{ color: 'var(--text2)' }}>Analyzing Perfect Knowledge…</span>}
                  {alertsRunning && <span style={{ opacity: 0.5 }}>▊</span>}
                  {alertsExtracting && <span style={{ color: 'var(--text2)', fontStyle: 'italic' }}>\n\n⚙️ Extracting actions…</span>}
                </div>
              )}

              {/* Detected action buttons */}
              {alertsActions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
                    Detected Actions ({alertsActions.filter((_, i) => alertsActionStatus[i] !== 'done').length} pending)
                  </p>
                  <div className="space-y-2">
                    {alertsActions.map((action, idx) => {
                      const status = alertsActionStatus[idx];
                      const isDone = status === 'done';
                      const isRunning = status === 'running';
                      const isError = status === 'error';

                      const actionLabel = action.type === 'eliminate'
                        ? { icon: '🔴', color: 'var(--danger)', label: 'ELIMINATE', btnText: 'Eliminate Now', empire: action.empire }
                        : action.type === 'rename'
                        ? { icon: '✏️', color: 'var(--accent)', label: 'RENAME', btnText: 'Pre-fill Rename Form', empire: action.empire }
                        : action.type === 'merge'
                        ? { icon: '⚔️', color: '#f59e0b', label: 'MERGE', btnText: 'Pre-fill Merge Form', empire: action.empires?.join(' + ') }
                        : action.type === 'reset_password'
                        ? { icon: '🔑', color: '#a78bfa', label: 'RESET PASSWORD', btnText: 'Go to Password Reset', empire: action.empire }
                        : { icon: '⚠️', color: 'var(--text2)', label: 'NOTE', btnText: 'Acknowledge', empire: action.empire ?? '' };

                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-3 px-3 py-2 rounded"
                          style={{
                            background: 'var(--surface2)',
                            border: `1px solid ${isDone ? 'var(--success)' : isError ? 'var(--danger)' : 'var(--border)'}`,
                            opacity: isDone ? 0.6 : 1,
                          }}
                        >
                          <span className="text-base flex-shrink-0 mt-0.5">{actionLabel.icon}</span>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: actionLabel.color }}>
                                {actionLabel.label}
                              </span>
                              {actionLabel.empire && (
                                <span className="text-sm font-semibold">{actionLabel.empire}</span>
                              )}
                              {action.newEmpireName && (
                                <span className="text-sm" style={{ color: 'var(--text2)' }}>→ {action.newEmpireName}</span>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: 'var(--text2)' }}>{action.details}</p>
                          </div>
                          <div className="flex-shrink-0">
                            {isDone ? (
                              <span className="text-xs" style={{ color: 'var(--success)' }}>✓ Done</span>
                            ) : isError ? (
                              <span className="text-xs" style={{ color: 'var(--danger)' }}>✗ Failed</span>
                            ) : (
                              <button
                                className="btn-primary text-xs"
                                style={{
                                  padding: '0.3rem 0.75rem',
                                  fontSize: '0.7rem',
                                  background: action.type === 'eliminate' ? 'var(--danger)' : undefined,
                                  borderColor: action.type === 'eliminate' ? 'var(--danger)' : undefined,
                                }}
                                disabled={isRunning}
                                onClick={() => executeAlertAction(idx, action)}
                              >
                                {isRunning ? '…' : actionLabel.btnText}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!alertsRunning && !alertsExtracting && alertsActions.length === 0 && alertsText && (
                <p className="text-xs" style={{ color: 'var(--success)' }}>✓ No actionable items detected this turn.</p>
              )}
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm" style={{ color: 'var(--text2)' }}>{Object.keys(actions).length}/{activePlayers.length} submissions for Year {year}</p>
              <div className="flex items-center gap-3">
                {actionsLastUpdated && (
                  <span className="text-xs" style={{ color: 'var(--text2)' }}>
                    Updated {new Date(actionsLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
                <button
                  className="btn-ghost text-xs"
                  onClick={refreshActions}
                  disabled={actionsRefreshing}
                  style={{ padding: '0.3rem 0.75rem' }}
                >
                  {actionsRefreshing ? '⟳ Refreshing…' : '↺ Refresh'}
                </button>
              </div>
            </div>
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
                <strong>Optional override</strong> for Year {year - 1}&apos;s PK only. The server automatically loads the full game history from the archive — you only need this if you want to correct an error in last turn&apos;s document before processing.
                Leave blank to use the archived version.
              </p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
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
                  {streamingStep === 1 ? 'Perfect Knowledge' : streamingStep === 2 ? 'World News Report' : streamingStep === 3 ? 'Advisor Reports' : 'Streaming...'} — live output
                </p>
                <div className="font-mono text-xs leading-relaxed overflow-y-auto whitespace-pre-wrap" style={{ maxHeight: 240, color: 'var(--text2)' }}>
                  {streamingText}
                  <span style={{ opacity: 0.6 }}>▊</span>
                </div>
              </div>
            )}

            {processError && <p className="danger text-sm">{processError}</p>}

            <div className="space-y-3">
              {/* Phase 1 — Perfect Knowledge */}
              <div className="card space-y-2" style={{ borderColor: phase1Done ? 'var(--success)' : 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm display-font" style={{ color: 'var(--accent)', letterSpacing: '0.05em' }}>
                      PHASE 1 — Perfect Knowledge
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                      Generates the PK document, updates the map, advances the year. ~3–5 min.
                    </p>
                  </div>
                  {phase1Done && <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>DONE</span>}
                </div>
                <button
                  className="btn-primary w-full py-2"
                  onClick={() => runPhase('pk')}
                  disabled={processing || !cooldownReady || !warChestReady || phase1Done}
                >
                  {processing && processPhase === 'pk'
                    ? 'Phase 1 running… do not close this page'
                    : phase1Done ? '✓ Phase 1 complete'
                    : !warChestReady ? `War Chest insufficient ($${warChest?.balance.toFixed(2)} / $${warChest?.threshold.toFixed(2)})`
                    : !cooldownReady ? `Cooldown: ${cooldownHours}h ${cooldownMins}m remaining`
                    : `Run Phase 1 — Turn ${year}`}
                </button>
                {processing && processPhase === 'pk' && (
                  <button
                    className="btn-ghost w-full py-1 text-xs"
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={forceEndPhase}
                  >
                    ⚡ Force End Phase 1
                  </button>
                )}
              </div>

              {/* Phase 2 — World News Report */}
              <div className="card space-y-2" style={{ borderColor: phase2Done ? 'var(--success)' : phase1Done ? 'var(--accent)' : 'var(--border)', opacity: phase1Done || (processing && processPhase === 'news') ? 1 : 0.5 }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm display-font" style={{ color: 'var(--accent)', letterSpacing: '0.05em' }}>
                      PHASE 2 — World News Report
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                      Writes the public newspaper from the PK. Players can read this. ~1–2 min.
                    </p>
                  </div>
                  {phase2Done && <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>DONE</span>}
                  {!phase1Done && !processing && (
                    <button className="btn-ghost text-xs flex-shrink-0" style={{ fontSize: '0.65rem', padding: '0.25rem 0.6rem' }}
                      title="Use if Phase 1 completed but connection dropped"
                      onClick={async () => {
                        const r = await fetch(`/api/turns/${year - 1}/perfect-knowledge`, { headers: headers() });
                        if (r.ok) { setPhase1Done(true); setProcessLog(l => [...l, '⚡ Phase 2 unlocked — PK confirmed in database.']); }
                        else setProcessLog(l => [...l, `✗ No PK found for Year ${year - 1}. Run Phase 1 first.`]);
                      }}>Force unlock</button>
                  )}
                </div>
                <button
                  className="btn-primary w-full py-2"
                  onClick={() => runPhase('news')}
                  disabled={processing || !phase1Done || phase2Done}
                >
                  {processing && processPhase === 'news'
                    ? 'Phase 2 running… do not close this page'
                    : phase2Done ? '✓ Phase 2 complete'
                    : phase1Done ? 'Run Phase 2 — World News Report'
                    : 'Complete Phase 1 first'}
                </button>
              </div>

              {/* Phase 3 — Advisor Reports */}
              <div className="card space-y-2" style={{ borderColor: phase2Done ? 'var(--accent)' : 'var(--border)', opacity: phase2Done || (processing && processPhase === 'advisors') ? 1 : 0.5 }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm display-font" style={{ color: 'var(--accent)', letterSpacing: '0.05em' }}>
                      PHASE 3 — Advisor Reports
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                      Generates all {activePlayers.length} advisor reports in parallel. ~2–3 min.
                    </p>
                  </div>
                  {!phase2Done && !processing && phase1Done && (
                    <button className="btn-ghost text-xs flex-shrink-0" style={{ fontSize: '0.65rem', padding: '0.25rem 0.6rem' }}
                      title="Use if Phase 2 completed but connection dropped"
                      onClick={async () => {
                        const r = await fetch(`/api/turns/${year - 1}/summary`);
                        if (r.ok) { const d = await r.json(); if (d.publicSummary) { setPhase2Done(true); setProcessLog(l => [...l, '⚡ Phase 3 unlocked — World News confirmed in database.']); return; } }
                        setProcessLog(l => [...l, `✗ No World News found for Year ${year - 1}. Run Phase 2 first.`]);
                      }}>Force unlock</button>
                  )}
                </div>
                <button
                  className="btn-primary w-full py-2"
                  onClick={() => runPhase('advisors')}
                  disabled={processing || !phase2Done}
                >
                  {processing && processPhase === 'advisors'
                    ? 'Phase 3 running… do not close this page'
                    : phase2Done ? `Run Phase 3 — ${activePlayers.length} Advisor Reports`
                    : 'Complete Phase 2 first'}
                </button>
              </div>

              {/* Phase 4 — Empire Statistics */}
              <div className="card space-y-2" style={{ borderColor: phase3Done ? 'var(--accent)' : 'var(--border)', opacity: phase3Done || (processing && processPhase === 'stats') ? 1 : 0.6 }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm display-font" style={{ color: 'var(--accent)', letterSpacing: '0.05em' }}>
                      PHASE 4 — Empire Statistics
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                      Generates full stat sheets for all active empires using the PK document. First-time generation uses web search for real-world baseline data. ~3–5 min.
                    </p>
                  </div>
                  {!phase3Done && !processing && (
                    <button className="btn-ghost text-xs flex-shrink-0" style={{ fontSize: '0.65rem', padding: '0.25rem 0.6rem' }}
                      title="Unlock Phase 4 without running Phase 3 first"
                      onClick={() => { setPhase3Done(true); setStatsLog([]); }}>
                      Force unlock
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text2)' }}>
                  <input type="checkbox" checked={statsForceInitial} onChange={e => setStatsForceInitial(e.target.checked)} />
                  Force web-search baseline (use for post-bidding first turn, even if previous stats exist)
                </label>
                <button
                  className="btn-primary w-full py-2"
                  onClick={() => runStats(false)}
                  disabled={processing || !phase3Done}
                >
                  {processing && processPhase === 'stats'
                    ? 'Phase 4 running… do not close this page'
                    : phase3Done ? `Run Phase 4 — ${activePlayers.length} Empire Stat Sheets`
                    : 'Complete Phase 3 first (or Force unlock →)'}
                </button>
                {statsLog.length > 0 && (
                  <div className="text-xs font-mono space-y-0.5 max-h-40 overflow-y-auto" style={{ color: 'var(--text2)' }}>
                    {statsLog.map((l, i) => <div key={i}>{l}</div>)}
                  </div>
                )}
                {Object.keys(statsEmpireStatus).length > 0 && (
                  <div className="space-y-2 mt-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(statsEmpireStatus).map(([emp, status]) => (
                        <button key={emp} onClick={() => setStatsLiveEmpire(emp)}
                          className="text-xs px-2 py-0.5 rounded font-mono"
                          style={{
                            background: statsLiveEmpire === emp ? 'var(--accent)' : 'var(--surface2)',
                            color: statsLiveEmpire === emp ? '#000' : status === 'done' ? 'var(--success)' : status === 'error' ? 'var(--danger)' : 'var(--accent)',
                            opacity: status === 'done' ? 0.6 : 1,
                          }}>
                          {status === 'done' ? '✓' : status === 'error' ? '✗' : '⟳'} {emp} {statsEmpireChars[emp] ? `(${statsEmpireChars[emp]}ch)` : ''}
                        </button>
                      ))}
                    </div>
                    {statsLiveEmpire && statsEmpireText[statsLiveEmpire] && (
                      <pre className="text-xs font-mono p-2 rounded overflow-auto max-h-48 whitespace-pre-wrap break-all"
                        style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                        {statsEmpireText[statsLiveEmpire]}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* ── Regeneration Tools ── */}
              <div className="card space-y-3" style={{ borderColor: 'var(--border)' }}>
                <p className="font-semibold text-sm display-font" style={{ color: 'var(--text2)', letterSpacing: '0.05em' }}>
                  REGENERATION TOOLS
                </p>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>
                  No cooldown. Operates on the most recently processed year ({year - 1}). Does not advance year or deduct war chest.
                </p>
                <div className="space-y-2">
                  {/* Regen PK */}
                  <button
                    className="btn-ghost w-full py-2 text-sm"
                    onClick={() => runPhase('pk-regen')}
                    disabled={processing}
                  >
                    {processing && processPhase === 'pk-regen'
                      ? 'Regenerating PK… do not close'
                      : `🔁 Regenerate Perfect Knowledge (Year ${year - 1})`}
                  </button>
                  {/* Regen News */}
                  <button
                    className="btn-ghost w-full py-2 text-sm"
                    onClick={() => runPhase('news')}
                    disabled={processing}
                  >
                    {processing && processPhase === 'news'
                      ? 'Regenerating News… do not close'
                      : `📰 Regenerate World News Report (Year ${year - 1})`}
                  </button>
                  {/* Map Generator */}
                  <button
                    className="btn-ghost w-full py-2 text-sm"
                    onClick={() => runPhase('map-gen')}
                    disabled={processing}
                  >
                    {processing && processPhase === 'map-gen'
                      ? 'Generating map… do not close'
                      : `🗺️ Map Generator — extract territories from PK (Year ${year - 1})`}
                  </button>
                  {/* Regen All Advisors */}
                  <button
                    className="btn-ghost w-full py-2 text-sm"
                    onClick={() => runPhase('advisors', false)}
                    disabled={processing}
                  >
                    {processing && processPhase === 'advisors'
                      ? 'Generating advisors… do not close'
                      : `📋 Regenerate All Advisor Reports (Year ${year - 1})`}
                  </button>
                  {/* Regen Stats — current year (post-bidding / starting stats) */}
                  <button
                    className="btn-ghost w-full py-2 text-sm"
                    onClick={() => runStats(false, year)}
                    disabled={processing}
                  >
                    {processing && processPhase === 'stats'
                      ? 'Generating stats… do not close'
                      : `📊 Generate Starting Stats (Year ${year})`}
                  </button>
                  {/* Regen Stats — previous year (post-turn) */}
                  <button
                    className="btn-ghost w-full py-2 text-sm"
                    onClick={() => runStats(false)}
                    disabled={processing}
                  >
                    {processing && processPhase === 'stats'
                      ? 'Generating stats… do not close'
                      : `📊 Regenerate All Empire Stats (Year ${year - 1})`}
                  </button>
                  {statsLog.length > 0 && processPhase === 'stats' && (
                    <div className="text-xs font-mono space-y-0.5 max-h-40 overflow-y-auto p-2 rounded" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                      {statsLog.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  )}
                </div>
              </div>

              {/* Retry Failures — always visible */}
              <div className="card space-y-2" style={{ borderColor: 'var(--warning)' }}>
                <div>
                  <p className="font-semibold text-sm display-font" style={{ color: 'var(--warning)', letterSpacing: '0.05em' }}>
                    PHASE 3B — Retry Failed Advisors
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
                    Skips players that already have a report. Safe to run anytime after Phase 1.
                    {advisorErrors.length > 0 && <span className="ml-1" style={{ color: 'var(--danger)' }}>Last failures: {advisorErrors.join(', ')}</span>}
                  </p>
                </div>
                <button
                  className="btn-primary w-full py-2"
                  style={{ background: 'var(--warning)', borderColor: 'var(--warning)' }}
                  onClick={() => runPhase('advisors', true)}
                  disabled={processing}
                >
                  {processing && processPhase === 'advisors'
                    ? 'Advisors running… do not close this page'
                    : 'Retry Failed Advisors'}
                </button>
              </div>
            </div>
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

        {/* ADVISOR REPORTS */}
        {tab === 'advisors' && (
          <div className="space-y-4">
            <div className="card space-y-3">
              <p className="label">View Advisor Reports — Any Player, Any Year</p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                Select a year and player to read their full private advisor briefing.
              </p>
              <div className="flex gap-3 flex-wrap items-end">
                <div>
                  <label className="label">Year</label>
                  <select
                    className="input text-sm"
                    value={advisorViewYear ?? ''}
                    onChange={e => setAdvisorViewYear(Number(e.target.value))}
                  >
                    <option value="">— Select year —</option>
                    {[...archive].sort((a, b) => b - a).map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Player</label>
                  <select
                    className="input text-sm"
                    value={advisorViewPlayer}
                    onChange={e => setAdvisorViewPlayer(e.target.value)}
                  >
                    <option value="">— Select player —</option>
                    {players.map(p => (
                      <option key={p.name} value={p.name}>{p.empire} ({p.name})</option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn-primary text-sm"
                  disabled={!advisorViewYear || !advisorViewPlayer || advisorViewLoading}
                  onClick={async () => {
                    if (!advisorViewYear || !advisorViewPlayer) return;
                    setAdvisorViewLoading(true);
                    setAdvisorViewError('');
                    setAdvisorViewReport('');
                    const r = await fetch(
                      `/api/turns/${advisorViewYear}/advisors/${encodeURIComponent(advisorViewPlayer)}`,
                      { headers: headers() }
                    );
                    if (r.ok) {
                      const d = await r.json();
                      setAdvisorViewReport(d.report ?? '');
                    } else {
                      setAdvisorViewError(`No advisor report found for ${advisorViewPlayer} — Year ${advisorViewYear}.`);
                    }
                    setAdvisorViewLoading(false);
                  }}
                >
                  {advisorViewLoading ? 'Loading...' : 'Load Report'}
                </button>
              </div>
              {advisorViewError && <p className="danger text-sm">{advisorViewError}</p>}
            </div>

            {advisorViewReport && (
              <div className="card space-y-3">
                <p className="label">
                  Advisor Report — {players.find(p => p.name === advisorViewPlayer)?.empire ?? advisorViewPlayer} — Year {advisorViewYear}
                </p>
                <div
                  className="text-sm leading-relaxed overflow-y-auto whitespace-pre-wrap"
                  style={{ color: 'var(--text)', maxHeight: '70vh', fontFamily: 'inherit' }}
                >
                  {advisorViewReport.split('\n').map((line, i) => {
                    if (line.startsWith('### ')) return <h3 key={i} className="display-font text-sm font-bold mt-6 mb-2" style={{ color: 'var(--accent)' }}>{line.slice(4)}</h3>;
                    if (line.startsWith('## ')) return <h3 key={i} className="display-font text-sm font-bold mt-4 mb-1" style={{ color: 'var(--accent)' }}>{line.slice(3)}</h3>;
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="text-sm my-1">{line}</p>;
                  })}
                </div>
              </div>
            )}

            {!advisorViewReport && !advisorViewLoading && !advisorViewError && archive.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text2)' }}>No archived turns yet — process a turn first.</p>
            )}

            {/* Streaming consoles — 2×2 grid */}
            {advisorRegenConsoles.some(c => c !== '') && (
              <div className="card space-y-2">
                <div className="flex items-center gap-2">
                  <p className="label" style={{ color: 'var(--accent)' }}>
                    {advisorRegenBatchRunning !== null ? '⚡ Generating…' : '✓ Generation complete'}
                  </p>
                  <button
                    className="btn-ghost text-xs ml-auto"
                    style={{ fontSize: '0.65rem' }}
                    onClick={() => setAdvisorRegenConsoles(['', '', ''])}
                  >Clear</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {advisorRegenConsoles.map((text, i) => text !== '' && (
                    <div key={i} className="space-y-1">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--accent)' }}>
                        {advisorRegenConsoleLabels[i] || `Slot ${i + 1}`}
                      </p>
                      <pre
                        className="text-xs leading-relaxed overflow-y-auto whitespace-pre-wrap"
                        style={{ maxHeight: '25vh', color: 'var(--text)', fontFamily: 'inherit', background: 'var(--surface2)', padding: '0.5rem', borderRadius: '0.375rem' }}
                      >
                        {text}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-player regeneration */}
            <div className="card space-y-3">
              <p className="label">Regenerate Individual Advisor Report</p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                No cooldown. Re-generates a single player&apos;s advisor briefing and overwrites the saved report.
              </p>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="label">Year</label>
                  <select
                    className="input text-sm"
                    value={advisorRegenYear ?? ''}
                    onChange={e => { setAdvisorRegenYear(Number(e.target.value)); setAdvisorRegenStatus({}); }}
                  >
                    <option value="">— Select year —</option>
                    {[...archive].sort((a, b) => b - a).map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
                {advisorRegenYear && (() => {
                  const allActivePlayers = players.filter(p => p.status === 'active');
                  // Only batch-generate for players who actually submitted actions this turn
                  const activePlayers = allActivePlayers.filter(p => !!advisorRegenActions[p.name]);
                  const skippedCount = allActivePlayers.length - activePlayers.length;
                  const batches = [0, 1, 2, 3].map(i => activePlayers.slice(i * 3, i * 3 + 3)).filter(b => b.length > 0);

                  const runPlayerInSlot = async (p: typeof activePlayers[0], slot: number, year: number) => {
                    setAdvisorRegenLoading(prev => ({ ...prev, [p.name]: true }));
                    setAdvisorRegenConsoleLabels(prev => { const n = [...prev]; n[slot] = `${p.empire} (${p.name})`; return n; });
                    setAdvisorRegenConsoles(prev => { const n = [...prev]; n[slot] = ''; return n; });
                    try {
                      const r = await fetch(
                        `/api/turns/${year}/advisors/${encodeURIComponent(p.name)}`,
                        { method: 'POST', headers: headers() }
                      );
                      if (!r.ok || !r.body) throw new Error('Request failed');
                      const reader = r.body.getReader();
                      const dec = new TextDecoder();
                      let buf = '';
                      let finalReport = '';
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buf += dec.decode(value, { stream: true });
                        const lines = buf.split('\n');
                        buf = lines.pop() ?? '';
                        let chunkText = '';
                        for (const line of lines) {
                          if (!line.trim()) continue;
                          try {
                            const ev = JSON.parse(line);
                            if (ev.type === 'token') chunkText += ev.text;
                            if (ev.type === 'done') finalReport = ev.report ?? '';
                          } catch { /* skip */ }
                        }
                        if (chunkText) setAdvisorRegenConsoles(prev => { const n = [...prev]; n[slot] = (n[slot] ?? '') + chunkText; return n; });
                      }
                      setAdvisorRegenStatus(prev => ({ ...prev, [p.name]: 'ok' }));
                      if (advisorViewPlayer === p.name && advisorViewYear === year && finalReport)
                        setAdvisorViewReport(finalReport);
                    } catch {
                      setAdvisorRegenStatus(prev => ({ ...prev, [p.name]: 'error' }));
                    }
                    setAdvisorRegenLoading(prev => ({ ...prev, [p.name]: false }));
                  };

                  const MIN_BATCH_MS = 60_000; // rate-limit buffer: each batch takes at least 1 minute

                  const runBatch = async (batchIndex: number) => {
                    const batch = batches[batchIndex];
                    if (!batch?.length || !advisorRegenYear) return;
                    setAdvisorRegenBatchRunning(batchIndex + 1);
                    setAdvisorRegenConsoles(['', '', '']);
                    setAdvisorRegenConsoleLabels(batch.map(p => `${p.empire} (${p.name})`).concat(['', '', '']).slice(0, 3));
                    const start = Date.now();
                    await Promise.all(batch.map((p, slot) => runPlayerInSlot(p, slot, advisorRegenYear)));
                    const elapsed = Date.now() - start;
                    if (elapsed < MIN_BATCH_MS) await new Promise(res => setTimeout(res, MIN_BATCH_MS - elapsed));
                    setAdvisorRegenBatchRunning(null);
                  };

                  const runAll = async () => {
                    if (!advisorRegenYear) return;
                    setAdvisorRegenBatchRunning(-1);
                    setAdvisorRegenStatus({});
                    for (let i = 0; i < batches.length; i++) {
                      const batch = batches[i];
                      setAdvisorRegenConsoles(['', '', '']);
                      setAdvisorRegenConsoleLabels(batch.map(p => `${p.empire} (${p.name})`).concat(['', '', '']).slice(0, 3));
                      const start = Date.now();
                      await Promise.all(batch.map((p, slot) => runPlayerInSlot(p, slot, advisorRegenYear)));
                      const elapsed = Date.now() - start;
                      if (i < batches.length - 1 && elapsed < MIN_BATCH_MS) {
                        await new Promise(res => setTimeout(res, MIN_BATCH_MS - elapsed));
                      }
                    }
                    setAdvisorRegenBatchRunning(null);
                  };

                  return (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        className="btn-primary text-sm"
                        disabled={advisorRegenBatchRunning !== null}
                        onClick={runAll}
                      >
                        {advisorRegenBatchRunning === -1
                          ? 'Running All…'
                          : `⚡ Regenerate All (${activePlayers.length} with actions${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}, 3 at a time)`}
                      </button>
                      {batches.map((batch, i) => (
                        <button
                          key={i}
                          className="btn-ghost text-sm"
                          disabled={advisorRegenBatchRunning !== null}
                          onClick={() => runBatch(i)}
                        >
                          {advisorRegenBatchRunning === i + 1
                            ? `Running Batch ${i + 1}…`
                            : `Batch ${i + 1} (${batch.map(p => p.name).join(', ')})`}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
              {advisorRegenYear && (
                <div className="space-y-2">
                  {players.filter(p => p.status === 'active').map(p => {
                    const isLoading = advisorRegenLoading[p.name];
                    const status = advisorRegenStatus[p.name];
                    return (
                      <div key={p.name} className="flex items-center gap-3 px-3 py-2 rounded" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold">{p.empire}</span>
                          <span className="text-xs ml-2" style={{ color: 'var(--text2)' }}>{p.name}</span>
                        </div>
                        {status === 'ok' && <span className="text-xs" style={{ color: 'var(--success)' }}>✓ Done</span>}
                        {status === 'error' && <span className="text-xs" style={{ color: 'var(--danger)' }}>✗ Failed</span>}
                        {isLoading && (
                          <button
                            className="btn-ghost text-xs flex-shrink-0"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', color: 'var(--danger)' }}
                            onClick={() => {
                              setAdvisorRegenLoading(prev => ({ ...prev, [p.name]: false }));
                              setAdvisorRegenBatchRunning(null);
                              setAdvisorRegenStatus(prev => ({ ...prev, [p.name]: 'error' }));
                            }}
                            title="Connection may have dropped — click to unlock"
                          >
                            ✕ Cancel
                          </button>
                        )}
                        <button
                          className="btn-ghost text-xs flex-shrink-0"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem' }}
                          disabled={isLoading || advisorRegenBatchRunning !== null}
                          onClick={async () => {
                            setAdvisorRegenLoading(prev => ({ ...prev, [p.name]: true }));
                            setAdvisorRegenStatus(prev => { const n = { ...prev }; delete n[p.name]; return n; });
                            setAdvisorRegenConsoles(['', '', '']);
                            setAdvisorRegenConsoleLabels([`${p.empire} (${p.name})`, '', '']);
                            try {
                              const r = await fetch(
                                `/api/turns/${advisorRegenYear}/advisors/${encodeURIComponent(p.name)}`,
                                { method: 'POST', headers: headers() }
                              );
                              if (!r.ok || !r.body) throw new Error('Request failed');
                              const reader = r.body.getReader();
                              const dec = new TextDecoder();
                              let buf = '';
                              let finalReport = '';
                              while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                buf += dec.decode(value, { stream: true });
                                const lines = buf.split('\n');
                                buf = lines.pop() ?? '';
                                let chunkText = '';
                                for (const line of lines) {
                                  if (!line.trim()) continue;
                                  try {
                                    const ev = JSON.parse(line);
                                    if (ev.type === 'token') chunkText += ev.text;
                                    if (ev.type === 'done') finalReport = ev.report ?? '';
                                  } catch { /* skip */ }
                                }
                                if (chunkText) setAdvisorRegenConsoles(prev => { const n = [...prev]; n[0] = (n[0] ?? '') + chunkText; return n; });
                              }
                              setAdvisorRegenStatus(prev => ({ ...prev, [p.name]: 'ok' }));
                              if (advisorViewPlayer === p.name && advisorViewYear === advisorRegenYear && finalReport)
                                setAdvisorViewReport(finalReport);
                            } catch {
                              setAdvisorRegenStatus(prev => ({ ...prev, [p.name]: 'error' }));
                            }
                            setAdvisorRegenLoading(prev => ({ ...prev, [p.name]: false }));
                          }}
                        >
                          {isLoading ? 'Generating…' : '🔁 Regenerate'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PLAYERS */}
        {tab === 'players' && (
          <div className="space-y-4">
            {/* Join password */}
            <JoinPasswordCard gmPassword={gmPassword} currentGameId={currentGameId} />

            {/* Manually Add Player */}
            <div className="card space-y-3">
              <p className="label">Manually Add Player</p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                Use this to add a player who bid but isn&apos;t showing in the game roster.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input className="input text-sm" placeholder="Player name" value={addPlayerName} onChange={e => setAddPlayerName(e.target.value)} />
                <input className="input text-sm" placeholder="Empire name" value={addPlayerEmpire} onChange={e => setAddPlayerEmpire(e.target.value)} />
                <input className="input text-sm font-mono" placeholder="Temporary password" value={addPlayerPassword} onChange={e => setAddPlayerPassword(e.target.value)} />
                <div className="flex gap-2 items-center">
                  <input type="color" value={addPlayerColor} onChange={e => setAddPlayerColor(e.target.value)}
                    style={{ width: 36, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                  <input className="input text-sm font-mono flex-1" value={addPlayerColor} onChange={e => setAddPlayerColor(e.target.value)} />
                </div>
              </div>
              <button className="btn-primary text-sm" onClick={addPlayerManually} disabled={addPlayerSaving}>
                {addPlayerSaving ? 'Adding…' : '+ Add to Game'}
              </button>
              {addPlayerLog && (
                <p className="text-xs font-mono" style={{ color: addPlayerLog.startsWith('Error') ? 'var(--danger)' : '#22c55e' }}>
                  {addPlayerLog}
                </p>
              )}
            </div>

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

            {/* Merge Empires */}
            <div className="card space-y-4">
              <p className="label" style={{ color: 'var(--accent)' }}>⚔️ Merge Empires</p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                Combine two or more empires into one. Each leader gets their own password and action weight.
                Weights must sum to 100. Higher-weighted leader wins contradictions.
              </p>

              {/* Step 1: Select empires */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>1. Select empires to merge</p>
                <div className="flex flex-wrap gap-2">
                  {activePlayers.map(p => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        const already = mergeSelected.includes(p.empire);
                        const next = already ? mergeSelected.filter(e => e !== p.empire) : [...mergeSelected, p.empire];
                        setMergeSelected(next);
                        // Sync leaders list to selected empires
                        const nextLeaders = next.map(empName => {
                          const existing = mergeLeaders.find(l => l.originalEmpire === empName);
                          if (existing) return existing;
                          const pl = activePlayers.find(pl2 => pl2.empire === empName);
                          return { name: pl?.name ?? empName, originalEmpire: empName, weight: 0, password: '' };
                        });
                        setMergeLeaders(nextLeaders);
                      }}
                      className="text-xs px-3 py-1 rounded-full border transition-colors"
                      style={{
                        background: mergeSelected.includes(p.empire) ? 'var(--accent)' : 'var(--surface2)',
                        borderColor: mergeSelected.includes(p.empire) ? 'var(--accent)' : 'var(--border)',
                        color: mergeSelected.includes(p.empire) ? 'var(--bg)' : 'var(--text)',
                      }}
                    >
                      <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: p.color }} />
                      {p.empire}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Merged empire name + color */}
              {mergeSelected.length >= 2 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>2. Merged empire details</p>
                  <div className="flex gap-3">
                    <input
                      className="input text-sm flex-1"
                      placeholder="New empire name..."
                      value={mergeEmpireName}
                      onChange={e => setMergeEmpireName(e.target.value)}
                    />
                    <input type="color" value={mergeColor} onChange={e => setMergeColor(e.target.value)}
                      style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                    <input className="input text-sm font-mono" style={{ width: 90 }} value={mergeColor}
                      onChange={e => setMergeColor(e.target.value)} />
                  </div>

                  {/* Step 3: Leader weights + passwords */}
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
                    3. Leader weights &amp; passwords
                    <span className="ml-2 font-normal" style={{ color: mergeLeaders.reduce((s, l) => s + l.weight, 0) === 100 ? 'var(--success)' : 'var(--danger)' }}>
                      ({mergeLeaders.reduce((s, l) => s + l.weight, 0)}/100)
                    </span>
                  </p>
                  <div className="space-y-3">
                    {mergeLeaders.map((leader, i) => (
                      <div key={leader.originalEmpire} className="p-3 rounded space-y-2" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: activePlayers.find(p => p.empire === leader.originalEmpire)?.color }} />
                          <span className="text-sm font-semibold">{leader.originalEmpire}</span>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <label className="text-xs" style={{ color: 'var(--text2)' }}>Leader name</label>
                            <input className="input text-sm w-full" value={leader.name}
                              onChange={e => setMergeLeaders(prev => prev.map((l, j) => j === i ? { ...l, name: e.target.value } : l))} />
                          </div>
                          <div className="space-y-1" style={{ width: 80 }}>
                            <label className="text-xs" style={{ color: 'var(--text2)' }}>Weight</label>
                            <input type="number" className="input text-sm w-full" min={0} max={100} value={leader.weight}
                              onChange={e => setMergeLeaders(prev => prev.map((l, j) => j === i ? { ...l, weight: parseInt(e.target.value) || 0 } : l))} />
                          </div>
                          <div className="flex-1 space-y-1">
                            <label className="text-xs" style={{ color: 'var(--text2)' }}>Password</label>
                            <input className="input text-sm w-full" type="text" placeholder="leader password..."
                              value={leader.password}
                              onChange={e => setMergeLeaders(prev => prev.map((l, j) => j === i ? { ...l, password: e.target.value } : l))} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    className="btn-primary w-full"
                    disabled={
                      mergeSaving ||
                      !mergeEmpireName.trim() ||
                      mergeLeaders.some(l => !l.password.trim() || !l.name.trim()) ||
                      mergeLeaders.reduce((s, l) => s + l.weight, 0) !== 100
                    }
                    onClick={async () => {
                      setMergeSaving(true);
                      setMergeLog('');
                      const r = await fetch('/api/game/merge', {
                        method: 'POST',
                        headers: headers(),
                        body: JSON.stringify({
                          empireNames: mergeSelected,
                          newEmpireName: mergeEmpireName.trim(),
                          newColor: mergeColor,
                          leaders: mergeLeaders,
                        }),
                      });
                      const d = await r.json();
                      if (r.ok) {
                        setMergeLog(`✓ Created merged empire: ${mergeEmpireName}`);
                        setMergeSelected([]);
                        setMergeLeaders([]);
                        setMergeEmpireName('');
                        loadAll();
                      } else {
                        setMergeLog(`Error: ${d.error ?? 'Unknown error'}`);
                      }
                      setMergeSaving(false);
                    }}
                  >
                    {mergeSaving ? 'Merging…' : `⚔️ Merge into "${mergeEmpireName || '…'}"`}
                  </button>
                  {mergeLog && (
                    <p className="text-sm" style={{ color: mergeLog.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
                      {mergeLog}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Rename Empire */}
            <div className="card space-y-4">
              <p className="label" style={{ color: 'var(--accent)' }}>✏️ Rename Empire</p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                Updates the empire name and optionally the leader name across all territories, player records, and current turn actions.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="label">Empire to rename</label>
                  <select
                    className="input text-sm"
                    value={renameOldEmpire}
                    onChange={e => {
                      setRenameOldEmpire(e.target.value);
                      setRenameLog('');
                      const p = players.find(pl => pl.empire === e.target.value);
                      setRenameNewLeader(p?.name ?? '');
                    }}
                  >
                    <option value="">— Select empire —</option>
                    {activePlayers.map(p => (
                      <option key={p.name} value={p.empire}>{p.empire} ({p.name})</option>
                    ))}
                  </select>
                </div>
                {renameOldEmpire && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">New empire name</label>
                        <input
                          className="input text-sm"
                          placeholder="New empire name..."
                          value={renameNewName}
                          onChange={e => setRenameNewName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">New leader name <span style={{ color: 'var(--text2)', fontWeight: 'normal' }}>(optional)</span></label>
                        <input
                          className="input text-sm"
                          placeholder="Leave blank to keep current..."
                          value={renameNewLeader}
                          onChange={e => setRenameNewLeader(e.target.value)}
                        />
                      </div>
                    </div>
                    <button
                      className="btn-primary"
                      disabled={renameSaving || !renameNewName.trim()}
                      onClick={renameEmpire}
                    >
                      {renameSaving ? 'Renaming…' : `✏️ Rename to "${renameNewName || '…'}"`}
                    </button>
                  </>
                )}
              </div>
              {renameLog && (
                <p className="text-sm" style={{ color: renameLog.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
                  {renameLog}
                </p>
              )}
            </div>

            {/* Change Leader */}
            <div className="card space-y-4">
              <p className="label" style={{ color: 'var(--accent)' }}>👤 Change Leader</p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                Transfers control of an empire to a new person. Updates the leader name across all territories and current-turn actions.
                Optionally set a new password so only the new leader can log in.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="label">Empire</label>
                  <select
                    className="input text-sm"
                    value={leaderEmpire}
                    onChange={e => {
                      setLeaderEmpire(e.target.value);
                      setLeaderLog('');
                      const p = players.find(pl => pl.empire === e.target.value);
                      setLeaderNewName(p?.name ?? '');
                      setLeaderNewPassword('');
                    }}
                  >
                    <option value="">— Select empire —</option>
                    {activePlayers.map(p => (
                      <option key={p.name} value={p.empire}>{p.empire} (currently: {p.name})</option>
                    ))}
                  </select>
                </div>
                {leaderEmpire && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">New leader name</label>
                        <input
                          className="input text-sm"
                          placeholder="New leader name..."
                          value={leaderNewName}
                          onChange={e => setLeaderNewName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">
                          New password <span style={{ color: 'var(--text2)', fontWeight: 'normal' }}>(optional — leave blank to keep current)</span>
                        </label>
                        <input
                          className="input text-sm"
                          type="text"
                          placeholder="Set new login password..."
                          value={leaderNewPassword}
                          onChange={e => setLeaderNewPassword(e.target.value)}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                    <button
                      className="btn-primary"
                      disabled={leaderSaving || !leaderNewName.trim()}
                      onClick={async () => {
                        setLeaderSaving(true);
                        setLeaderLog('');
                        const r = await fetch('/api/game/rename', {
                          method: 'POST',
                          headers: headers(),
                          body: JSON.stringify({
                            oldEmpireName: leaderEmpire,
                            newLeaderName: leaderNewName.trim(),
                            newPassword: leaderNewPassword.trim() || undefined,
                          }),
                        });
                        const d = await r.json();
                        if (r.ok) {
                          const pwNote = d.passwordChanged ? ' · Password updated.' : ' · Password unchanged.';
                          setLeaderLog(`✓ ${leaderEmpire} leader changed: "${d.oldLeaderName}" → "${d.newLeaderName}"${pwNote}`);
                          setLeaderEmpire('');
                          setLeaderNewName('');
                          setLeaderNewPassword('');
                          loadAll();
                        } else {
                          setLeaderLog(`Error: ${d.error ?? 'Unknown error'}`);
                        }
                        setLeaderSaving(false);
                      }}
                    >
                      {leaderSaving ? 'Saving…' : `👤 Assign "${leaderNewName || '…'}" as leader`}
                    </button>
                  </>
                )}
              </div>
              {leaderLog && (
                <p className="text-sm" style={{ color: leaderLog.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
                  {leaderLog}
                </p>
              )}
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

                  {/* Public */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="label">Global Channel ({(allChats.public as unknown[]).length} messages)</p>
                      <button className="btn-ghost text-xs" style={{ color: 'var(--danger)', fontSize: '0.65rem' }}
                        onClick={async () => {
                          if (!confirm('Clear the public channel?')) return;
                          await fetch('/api/chat/all', { method: 'DELETE', headers: headers(), body: JSON.stringify({ target: 'public' }) });
                          await loadChats();
                        }}>🗑 Clear</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1 p-3 rounded" style={{ background: 'var(--surface2)' }}>
                      {(allChats.public as { id: string; senderName: string; empireName: string; text: string; timestamp: number; color: string }[]).slice(-50).map((m) => (
                        <div key={m.id} className="text-xs flex items-start gap-1 group">
                          <div className="flex-1 min-w-0">
                            <span className="font-bold" style={{ color: m.color }}>{m.empireName}</span>
                            <span style={{ color: 'var(--text2)' }}> {new Date(m.timestamp).toLocaleTimeString()} </span>
                            <span style={{ color: 'var(--text)' }}>{m.text}</span>
                          </div>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            style={{ color: 'var(--danger)', fontSize: '0.6rem', lineHeight: 1, padding: '2px 4px' }}
                            onClick={() => deleteMsg('public', m.id)}
                            title="Delete message"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Private threads */}
                  {Object.entries(allChats.private).map(([key, msgs]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="label">Private: {key.replace(/^.*chat:private:/, '').replace(':', ' ↔ ')}</p>
                        <button className="btn-ghost text-xs" style={{ color: 'var(--danger)', fontSize: '0.65rem' }}
                          onClick={async () => {
                            if (!confirm('Clear this private thread?')) return;
                            await fetch('/api/chat/all', { method: 'DELETE', headers: headers(), body: JSON.stringify({ target: `private:${key}` }) });
                            await loadChats();
                          }}>🗑 Clear</button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 p-3 rounded" style={{ background: 'var(--surface2)' }}>
                        {(msgs as { id: string; senderName: string; empireName: string; text: string; timestamp: number; color: string }[]).map((m) => (
                          <div key={m.id} className="text-xs flex items-start gap-1 group">
                            <div className="flex-1 min-w-0">
                              <span className="font-bold" style={{ color: m.color }}>{m.senderName}</span>
                              <span style={{ color: 'var(--text2)' }}> {new Date(m.timestamp).toLocaleTimeString()} </span>
                              <span style={{ color: 'var(--text)' }}>{m.text}</span>
                            </div>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              style={{ color: 'var(--danger)', fontSize: '0.6rem', lineHeight: 1, padding: '2px 4px' }}
                              onClick={() => deleteMsg(`private:${key}`, m.id)}
                              title="Delete message"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Group chats */}
                  {Object.entries(allChats.groups).map(([id, data]) => {
                    const d = data as { group: { name: string }; messages: { id: string; senderName: string; empireName: string; text: string; timestamp: number; color: string }[] };
                    return (
                      <div key={id}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="label">Group: {d.group.name}</p>
                          <button className="btn-ghost text-xs" style={{ color: 'var(--danger)', fontSize: '0.65rem' }}
                            onClick={async () => {
                              if (!confirm(`Clear group "${d.group.name}"?`)) return;
                              await fetch('/api/chat/all', { method: 'DELETE', headers: headers(), body: JSON.stringify({ target: `group:${id}` }) });
                              await loadChats();
                            }}>🗑 Clear</button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1 p-3 rounded" style={{ background: 'var(--surface2)' }}>
                          {d.messages.map((m) => (
                            <div key={m.id ?? m.timestamp} className="text-xs flex items-start gap-1 group">
                              <div className="flex-1 min-w-0">
                                <span className="font-bold" style={{ color: m.color }}>{m.senderName}</span>
                                <span style={{ color: 'var(--text2)' }}> {new Date(m.timestamp).toLocaleTimeString()} </span>
                                <span style={{ color: 'var(--text)' }}>{m.text}</span>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                style={{ color: 'var(--danger)', fontSize: '0.6rem', lineHeight: 1, padding: '2px 4px' }}
                                onClick={() => deleteMsg(`group:${id}`, m.id)}
                                title="Delete message"
                              >✕</button>
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

            {/* Empire Color Picker */}
            <div className="card space-y-4">
              <p className="label">Empire Color</p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                Instantly updates all territories and the player record. No AI involved.
              </p>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="label">Empire</label>
                  <select
                    className="input text-sm"
                    value={colorEmpire}
                    onChange={e => {
                      setColorEmpire(e.target.value);
                      const p = players.find(p => p.empire === e.target.value);
                      if (p?.color) setColorValue(p.color);
                    }}
                  >
                    <option value="">— Select empire —</option>
                    {players.filter(p => p.status === 'active').map(p => (
                      <option key={p.name} value={p.empire}>{p.empire} ({p.name})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorValue}
                      onChange={e => setColorValue(e.target.value)}
                      style={{ width: 44, height: 36, padding: 2, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      className="input text-sm font-mono"
                      style={{ width: 100 }}
                      value={colorValue}
                      onChange={e => setColorValue(e.target.value)}
                      placeholder="#rrggbb"
                    />
                  </div>
                </div>
                <button
                  className="btn-primary"
                  disabled={colorSaving || !colorEmpire}
                  onClick={async () => {
                    if (!colorEmpire) return;
                    setColorSaving(true);
                    setColorLog('');
                    const r = await fetch('/api/map/color', {
                      method: 'POST',
                      headers: headers(),
                      body: JSON.stringify({ empire: colorEmpire, color: colorValue }),
                    });
                    const d = await r.json();
                    if (r.ok) {
                      setColorLog(`✓ Color updated for ${colorEmpire}`);
                      loadAll();
                    } else {
                      setColorLog(`Error: ${d.error ?? 'Unknown error'}`);
                    }
                    setColorSaving(false);
                  }}
                >
                  {colorSaving ? 'Applying…' : 'Apply Color'}
                </button>
              </div>
              {colorLog && (
                <p className="text-sm" style={{ color: colorLog.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
                  {colorLog}
                </p>
              )}
            </div>

            <div className="card space-y-4">
              <p className="label">AI Map Update</p>
              <p className="text-sm" style={{ color: 'var(--text2)' }}>
                Describe any map change in plain English — territories, colors, statuses, leaders. The AI applies it directly without processing a full turn.
              </p>
              <p className="text-xs" style={{ color: 'var(--text2)' }}>
                Examples: "Germany is now contested. Logan absorbs eastern Russia." · "Change Not See to color #a855f7." · "Mark Iceland as ungoverned."
              </p>
              <textarea
                className="input font-mono text-sm"
                style={{ minHeight: 180 }}
                placeholder="Describe the map change..."
                value={mapUpdateDesc}
                onChange={e => setMapUpdateDesc(e.target.value)}
              />
              {mapUpdateLog && (
                <pre className="text-sm whitespace-pre-wrap" style={{ color: mapUpdateLog.startsWith('Error') ? 'var(--danger)' : 'var(--success)', fontFamily: 'inherit' }}>
                  {mapUpdateLog}
                </pre>
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

                <div className="card space-y-3" style={{ borderColor: 'var(--danger)' }}>
                  <p className="label" style={{ color: 'var(--danger)' }}>Deduct from War Chest (GM Adjustment)</p>
                  <p className="text-xs" style={{ color: 'var(--text2)' }}>Use to correct misclicks, account for testing costs, or any manual balance fix.</p>
                  <div className="flex gap-3 flex-wrap">
                    <input className="input text-sm flex-1" type="number" min="0.01" step="0.01" placeholder="Amount to deduct ($)" value={wcDeductAmount} onChange={e => setWcDeductAmount(e.target.value)} />
                    <input className="input text-sm flex-1" placeholder="Reason (e.g. API testing)" value={wcDeductReason} onChange={e => setWcDeductReason(e.target.value)} />
                    <button
                      className="btn-primary"
                      style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                      onClick={deductFunds}
                      disabled={wcDeducting || !wcDeductAmount}
                    >
                      {wcDeducting ? 'Deducting...' : 'Deduct Funds'}
                    </button>
                  </div>
                </div>

                <div className="card space-y-2">
                  <p className="label mb-3">Contribution History</p>
                  {warChest.contributions.length === 0 && (
                    <p className="text-sm" style={{ color: 'var(--text2)' }}>No contributions yet.</p>
                  )}
                  {[...warChest.contributions].reverse().slice(0, 20).map((c, i) => {
                    const amt = Number(c.amount);
                    const isDeduction = amt < 0;
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm py-1" style={{ borderBottom: '1px solid var(--border)' }}>
                        <span className="flex-1" style={{ color: isDeduction ? 'var(--danger)' : 'inherit' }}>{c.name}</span>
                        <span style={{ color: isDeduction ? 'var(--danger)' : 'var(--success)' }}>
                          {isDeduction ? `-$${Math.abs(amt).toFixed(2)}` : `+$${amt.toFixed(2)}`}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text2)' }}>{new Date(c.timestamp).toLocaleDateString()}</span>
                        <span className="badge badge-neutral" style={{ fontSize: '0.55rem' }}>{c.method}</span>
                      </div>
                    );
                  })}
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

        {/* EMPIRE STATS */}
        {tab === 'stats' && (
          <div className="space-y-4">
            {/* Controls */}
            <div className="card space-y-3">
              <p className="label">View Empire Statistics</p>
              <div className="flex gap-3 flex-wrap items-end">
                <div>
                  <label className="label">Year</label>
                  <input
                    type="number"
                    className="input text-sm"
                    style={{ width: '8rem' }}
                    placeholder={String(year)}
                    value={gmStatsYear}
                    onChange={e => setGmStatsYear(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadGmStats()}
                  />
                </div>
                <button className="btn-primary text-sm" onClick={loadGmStats} disabled={gmStatsLoading}>
                  {gmStatsLoading ? 'Loading…' : 'Load Stats'}
                </button>
              </div>
              {gmStatsError && <p className="text-xs font-mono" style={{ color: 'var(--danger)' }}>{gmStatsError}</p>}
            </div>

            {/* Empire picker + stats display */}
            {gmStatsData && Object.keys(gmStatsData).length > 0 && (() => {
              const empires = Object.keys(gmStatsData).sort();
              const selectedEmpire = gmStatsEmpire || empires[0];
              const s = gmStatsData[selectedEmpire] as Record<string, unknown> | undefined;
              const mil = (s?.military ?? {}) as Record<string, number>;
              const milTech = (s?.militaryTech ?? {}) as Record<string, number>;

              const techLabel = (n: number) => n === 0 ? '2025-avg' : n > 0 ? `+${n}yr` : `${n}yr`;
              const fmt = (n: unknown) => {
                const num = Number(n ?? 0);
                if (num >= 1000) return `$${(num / 1000).toFixed(1)}T`;
                return `$${num.toFixed(0)}B`;
              };

              return (
                <div className="space-y-4">
                  {/* Empire selector */}
                  <div className="flex gap-2 flex-wrap">
                    {empires.map(emp => {
                      const p = players.find(pl => pl.empire === emp);
                      return (
                        <button
                          key={emp}
                          onClick={() => setGmStatsEmpire(emp)}
                          className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                          style={{
                            background: selectedEmpire === emp ? (p?.color ?? 'var(--accent)') : 'var(--surface2)',
                            borderColor: selectedEmpire === emp ? (p?.color ?? 'var(--accent)') : 'var(--border)',
                            color: selectedEmpire === emp ? '#fff' : 'var(--text)',
                            opacity: selectedEmpire === emp ? 1 : 0.8,
                          }}
                        >
                          {emp}
                        </button>
                      );
                    })}
                  </div>

                  {s && (
                    <div className="card space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="display-font text-lg font-black" style={{ color: players.find(pl => pl.empire === selectedEmpire)?.color ?? 'var(--accent)' }}>
                          {selectedEmpire}
                        </p>
                        <p className="text-xs font-mono" style={{ color: 'var(--text2)' }}>
                          Year {String((s.generatedYear ?? gmStatsYear) || year)} stats
                          {s.isInitial ? ' · initial baseline' : ''}
                        </p>
                      </div>

                      {/* Economy */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text2)' }}>Economy</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                          {[
                            ['GDP', fmt(s.gdp)],
                            ['GDP/capita', `$${Number(s.gdpPerCapita ?? 0).toFixed(1)}K`],
                            ['Area', `${Number(s.areaSqMiles ?? 0).toFixed(1)}K sq mi`],
                            ['Population', `${Number(s.population ?? 0).toFixed(1)}M`],
                            ['Birth Rate', `${Number(s.birthRate ?? 0).toFixed(1)}/1000`],
                            ['Inflation', `${Number(s.inflationRate ?? 0).toFixed(1)}%`],
                            ['Interest Rate', `${Number(s.interestRate ?? 0).toFixed(1)}%`],
                            ['Revenue', fmt(s.revenue)],
                            ['Spending', fmt(s.spending)],
                            ['Debt', fmt(s.debt)],
                            ['Trade Surplus', fmt(s.tradeSurplus)],
                            ['Stock Market', String(s.stockMarket ?? '')],
                            ['Technology', techLabel(Number(s.technologyYears ?? 0))],
                          ].map(([label, val]) => (
                            <div key={label} className="flex justify-between gap-2 py-0.5" style={{ borderBottom: '1px solid var(--border)' }}>
                              <span style={{ color: 'var(--text2)' }}>{label}</span>
                              <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Society */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text2)' }}>Society</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                          {[
                            ['Government', String(s.governmentType ?? '')],
                            ['Social Cohesion', String(s.socialCohesion ?? '')],
                            ['Public Approval', `${s.publicApproval ?? 0}%`],
                            ['Space Program', String(s.spaceProgram ?? 'None')],
                          ].map(([label, val]) => (
                            <div key={label} className="flex justify-between gap-2 py-0.5" style={{ borderBottom: '1px solid var(--border)' }}>
                              <span style={{ color: 'var(--text2)' }}>{label}</span>
                              <span className="font-semibold" style={{ color: 'var(--text)' }}>{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Military */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text2)' }}>Military</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                          {[
                            ['Intelligence', String(s.intelligence ?? '')],
                            ['Training', String(s.trainingLevel ?? '')],
                            ['Supply', String(s.militarySupply ?? '')],
                            ['Infantry (k)', String(mil.infantry ?? 0)],
                            ['Armor', String(mil.armor ?? 0)],
                            ['Artillery', String(mil.artillery ?? 0)],
                            ['Fighters', String(mil.fighters ?? 0)],
                            ['Bombers', String(mil.bombers ?? 0)],
                            ['Anti-Air', String(mil.antiAir ?? 0)],
                            ['Navy', String(mil.navy ?? 0)],
                            ['Nukes', String(mil.nukes ?? 0)],
                            ['Missiles', String(mil.missiles ?? 0)],
                            ['Anti-Missiles', String(mil.antiMissiles ?? 0)],
                          ].map(([label, val]) => (
                            <div key={label} className="flex justify-between gap-2 py-0.5" style={{ borderBottom: '1px solid var(--border)' }}>
                              <span style={{ color: 'var(--text2)' }}>{label}</span>
                              <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Military Tech */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text2)' }}>Military Technology</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                          {(['infantry','armor','artillery','fighters','bombers','antiAir','navy','nukes','missiles','antiMissiles'] as const).map(k2 => (
                            <div key={k2} className="flex justify-between gap-2 py-0.5" style={{ borderBottom: '1px solid var(--border)' }}>
                              <span style={{ color: 'var(--text2)' }}>{k2}</span>
                              <span className="font-mono font-semibold" style={{ color: milTech[k2] > 0 ? '#22c55e' : milTech[k2] < 0 ? 'var(--danger)' : 'var(--text)' }}>
                                {techLabel(milTech[k2] ?? 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* GM Notes */}
                      {!!s.gmNotes && (
                        <div className="rounded p-3 text-sm" style={{ background: 'var(--surface2)', borderLeft: '3px solid var(--accent)' }}>
                          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent)' }}>Analyst Notes</p>
                          <p style={{ color: 'var(--text)' }}>{String(s.gmNotes)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* RESET GAME */}
        {tab === 'reset' && (
          <div className="space-y-4">

            {/* Warning banner */}
            <div className="card" style={{ borderColor: 'var(--danger)', background: 'rgba(239,68,68,0.06)' }}>
              <p className="display-font text-sm font-bold mb-1" style={{ color: 'var(--danger)', letterSpacing: '0.08em' }}>
                ⚠ DANGER ZONE — FULL GAME RESET
              </p>
              <p className="text-sm" style={{ color: 'var(--text2)' }}>
                This will permanently delete <strong style={{ color: 'var(--text)' }}>all players, all turns, all advisor reports, all territory data, all chat messages, and all bidding state</strong>.
                The game returns to a blank slate. This cannot be undone.
              </p>
            </div>

            {/* Reset options */}
            <div className="card space-y-5">
              <p className="label">Reset Options</p>

              {/* Start year */}
              <div>
                <label className="label">Start Year</label>
                <input
                  type="number"
                  className="input text-sm w-32"
                  value={resetStartYear}
                  min={2020}
                  max={2100}
                  onChange={e => setResetStartYear(Number(e.target.value))}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>The year the new game starts from. Default 2032.</p>
              </div>

              {/* Keep settings */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetKeepSettings}
                  onChange={e => setResetKeepSettings(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span className="text-sm">Preserve game settings (content mode, join password, theme)</span>
              </label>

              {/* Open bidding */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetOpenBidding}
                    onChange={e => { setResetOpenBidding(e.target.checked); if (!e.target.checked) setResetBiddingDeadline(''); }}
                    style={{ width: 16, height: 16 }}
                  />
                  <span className="text-sm font-semibold">Open territory bidding immediately after reset</span>
                </label>

                {resetOpenBidding && (
                  <div className="pl-6 space-y-2">
                    <label className="label">Bidding Closes At (optional)</label>
                    <input
                      type="datetime-local"
                      className="input text-sm"
                      value={resetBiddingDeadline}
                      onChange={e => setResetBiddingDeadline(e.target.value)}
                    />
                    <p className="text-xs" style={{ color: 'var(--text2)' }}>
                      Leave blank for no timer. Players will see a countdown if a deadline is set.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation + execute */}
            <div className="card space-y-4" style={{ borderColor: 'var(--danger)' }}>
              <p className="label" style={{ color: 'var(--danger)' }}>Confirm Reset</p>
              <p className="text-sm" style={{ color: 'var(--text2)' }}>
                Type <code style={{ color: 'var(--danger)', fontWeight: 700 }}>RESET</code> exactly to enable the button.
              </p>
              <input
                type="text"
                className="input text-sm font-mono"
                placeholder="Type RESET here"
                value={resetConfirm}
                onChange={e => setResetConfirm(e.target.value)}
                style={{ borderColor: resetConfirm === 'RESET' ? 'var(--danger)' : undefined }}
              />
              <button
                className="btn-primary text-sm"
                style={{
                  background: resetConfirm === 'RESET' ? 'var(--danger)' : undefined,
                  opacity: resetConfirm === 'RESET' && !resetLoading ? 1 : 0.4,
                  cursor: resetConfirm === 'RESET' && !resetLoading ? 'pointer' : 'not-allowed',
                }}
                disabled={resetConfirm !== 'RESET' || resetLoading}
                onClick={async () => {
                  if (!window.confirm(
                    `FINAL WARNING: This will completely wipe the game starting from Year ${resetStartYear}. ` +
                    (resetOpenBidding ? 'Bidding will open immediately.' : '') +
                    ' There is no undo. Proceed?'
                  )) return;

                  setResetLoading(true);
                  setResetLog('Resetting...');
                  try {
                    const biddingClosesAt = resetOpenBidding && resetBiddingDeadline
                      ? new Date(resetBiddingDeadline).getTime()
                      : undefined;

                    const r = await fetch('/api/game/reset', {
                      method: 'POST',
                      headers: headers(),
                      body: JSON.stringify({
                        confirm: 'RESET',
                        startYear: resetStartYear,
                        openBidding: resetOpenBidding,
                        ...(biddingClosesAt ? { biddingClosesAt } : {}),
                        keepSettings: resetKeepSettings,
                      }),
                    });
                    const d = await r.json();
                    if (r.ok) {
                      setResetLog(
                        `✓ Reset complete. Deleted ${d.deletedKnownKeys + d.deletedWildcardKeys} keys. ` +
                        `New game starts at Year ${resetStartYear}.` +
                        (resetOpenBidding ? ' Bidding is now open.' : '')
                      );
                      setResetConfirm('');
                      // Refresh GM page state
                      setPlayers([]);
                      setTerritories({});
                      setActions({});
                      setYear(resetStartYear);
                    } else {
                      setResetLog(`✗ Error: ${d.error}`);
                    }
                  } catch (e) {
                    setResetLog(`✗ Network error: ${e instanceof Error ? e.message : String(e)}`);
                  }
                  setResetLoading(false);
                }}
              >
                {resetLoading ? 'Resetting…' : '🗑 Execute Full Reset'}
              </button>

              {resetLog && (
                <p className="text-sm font-mono" style={{ color: resetLog.startsWith('✓') ? '#22c55e' : 'var(--danger)' }}>
                  {resetLog}
                </p>
              )}
            </div>

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
