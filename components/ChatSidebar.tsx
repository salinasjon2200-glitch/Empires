'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, Group } from '@/lib/types';

interface Props {
  sessionToken: string | null;
  playerName: string | null;
  empireName: string | null;
  color: string | null;
  gmPassword?: string | null;
}

type Tab = 'global' | 'direct' | 'groups';

export default function ChatSidebar({ sessionToken, playerName, empireName, color, gmPassword }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('global');
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [unreadBreakdown, setUnreadBreakdown] = useState<Record<string, number>>({});

  // Global
  const [publicMsgs, setPublicMsgs] = useState<ChatMessage[]>([]);
  const [pubInput, setPubInput] = useState('');
  const pubAfter = useRef(0);

  // Direct
  const [directTarget, setDirectTarget] = useState('');
  const [directInput, setDirectInput] = useState('');
  const [directMsgs, setDirectMsgs] = useState<ChatMessage[]>([]);
  const directAfter = useRef(0);
  const [allPlayers, setAllPlayers] = useState<{ name: string; empire: string; color: string }[]>([]);

  // Groups
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [groupMsgs, setGroupMsgs] = useState<ChatMessage[]>([]);
  const [groupInput, setGroupInput] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState('');
  const groupAfter = useRef(0);

  const headers = useCallback((): Record<string, string> => {
    if (gmPassword) return { 'Authorization': `Bearer ${gmPassword}` };
    return { 'Authorization': `Bearer ${sessionToken ?? ''}`, 'Content-Type': 'application/json' };
  }, [sessionToken, gmPassword]);

  // Poll public chat
  useEffect(() => {
    const poll = async () => {
      const r = await fetch(`/api/chat/public?after=${pubAfter.current}`);
      if (r.ok) {
        const { messages } = await r.json();
        if (messages?.length) {
          pubAfter.current = Math.max(...messages.map((m: ChatMessage) => m.timestamp));
          setPublicMsgs(prev => [...prev.slice(-400), ...messages]);
        }
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  // Poll unread counts
  useEffect(() => {
    if (!sessionToken) return;
    const poll = async () => {
      const r = await fetch('/api/chat/unread', { headers: headers() });
      if (r.ok) {
        const { total, unread } = await r.json();
        setUnreadTotal(total);
        if (unread) setUnreadBreakdown(unread);
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [sessionToken, headers]);

  // Poll direct chat when active
  useEffect(() => {
    if (!directTarget || (!sessionToken && !gmPassword)) return;
    directAfter.current = 0;
    setDirectMsgs([]);
    const poll = async () => {
      const r = await fetch(`/api/chat/private?other=${encodeURIComponent(directTarget)}&after=${directAfter.current}`, { headers: headers() });
      if (r.ok) {
        const { messages } = await r.json();
        if (messages?.length) {
          directAfter.current = Math.max(...messages.map((m: ChatMessage) => m.timestamp));
          setDirectMsgs(prev => [...prev.slice(-400), ...messages]);
        }
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [directTarget, sessionToken, headers]);

  // Poll group chat when active
  useEffect(() => {
    if (!activeGroup || !sessionToken) return;
    groupAfter.current = 0;
    setGroupMsgs([]);
    const poll = async () => {
      const r = await fetch(`/api/chat/groups/${activeGroup.id}?after=${groupAfter.current}`, { headers: headers() });
      if (r.ok) {
        const { messages } = await r.json();
        if (messages?.length) {
          groupAfter.current = Math.max(...messages.map((m: ChatMessage) => m.timestamp));
          setGroupMsgs(prev => [...prev.slice(-400), ...messages]);
        }
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [activeGroup, sessionToken, headers]);

  // Load groups
  useEffect(() => {
    if (!sessionToken) return;
    fetch('/api/chat/groups', { headers: headers() }).then(r => r.json()).then(d => {
      if (d.groups) setGroups(d.groups);
    }).catch(() => {});
  }, [sessionToken, headers]);

  // Load players for direct chat selector
  useEffect(() => {
    fetch('/api/game/players').then(r => r.json()).then(d => {
      if (d.players) setAllPlayers(d.players);
    }).catch(() => {});
  }, []);

  async function sendPublic() {
    if (!pubInput.trim()) return;
    const body: Record<string, string> = { text: pubInput };
    if (gmPassword) body.gmPassword = gmPassword;
    else if (sessionToken) body.sessionToken = sessionToken;
    await fetch('/api/chat/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setPubInput('');
  }

  async function sendDirect() {
    if (!directInput.trim() || !directTarget) return;
    const authToken = sessionToken ?? gmPassword;
    if (!authToken) return;
    const text = directInput.trim();
    setDirectInput('');
    const optimistic: ChatMessage = {
      id: 'tmp-' + Date.now(),
      senderName: playerName ?? 'Game Master',
      empireName: empireName ?? 'GM',
      color: color ?? '#ffffff',
      text,
      timestamp: Date.now(),
    };
    setDirectMsgs(prev => [...prev, optimistic]);
    directAfter.current = Math.max(directAfter.current, optimistic.timestamp);
    await fetch('/api/chat/private', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ text, receiverName: directTarget }),
    });
  }

  async function sendGroup() {
    if (!groupInput.trim() || !activeGroup) return;
    await fetch(`/api/chat/groups/${activeGroup.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
      body: JSON.stringify({ text: groupInput }),
    });
    setGroupInput('');
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    const members = newGroupMembers.split(',').map(s => s.trim()).filter(Boolean);
    const r = await fetch('/api/chat/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
      body: JSON.stringify({ name: newGroupName, members }),
    });
    if (r.ok) {
      const { group } = await r.json();
      setGroups(prev => [...prev, group]);
      setActiveGroup(group);
      setNewGroupName('');
      setNewGroupMembers('');
    }
  }

  function fmt(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all"
        style={{
          background: 'var(--accent)',
          color: 'var(--bg)',
          animation: !open && unreadTotal > 0 ? 'pulse 1.5s infinite' : 'none',
          boxShadow: !open && unreadTotal > 0 ? '0 0 0 4px rgba(239,68,68,0.3)' : undefined,
        }}
        title={unreadTotal > 0 ? `${unreadTotal} unread message${unreadTotal > 1 ? 's' : ''}` : 'Toggle chat'}
      >
        {open ? '✕' : '💬'}
        {!open && unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
            style={{ background: 'var(--danger)', color: '#fff' }}>
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>

      {/* Sidebar */}
      {open && (
        <div
          className="fixed right-0 top-0 bottom-0 z-30 flex flex-col shadow-2xl"
          style={{ width: 340, background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="display-font text-xs tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
              Diplomatic Channels
            </span>
            <button onClick={() => setOpen(false)} style={{ color: 'var(--text2)' }}>✕</button>
          </div>

          {/* Unread notifications strip */}
          {(() => {
            const unreadDirect = Object.entries(unreadBreakdown)
              .filter(([k, v]) => k.startsWith('private:') && v > 0)
              .map(([k, v]) => ({ senderName: k.slice('private:'.length), count: v }));
            const unreadGroups = Object.entries(unreadBreakdown)
              .filter(([k, v]) => k.startsWith('group:') && v > 0)
              .map(([k, v]) => ({ groupId: k.slice('group:'.length), count: v }));
            if (unreadDirect.length === 0 && unreadGroups.length === 0) return null;
            return (
              <div style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', padding: '0.5rem 0.75rem' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--accent)' }}>
                  🔔 New Messages
                </p>
                <div className="space-y-1">
                  {unreadDirect.map(({ senderName, count }) => {
                    const p = allPlayers.find(p => p.name === senderName);
                    return (
                      <button
                        key={senderName}
                        className="w-full flex items-center gap-2 text-left rounded px-2 py-1 transition-colors"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                        onClick={() => { setTab('direct'); setDirectTarget(senderName); }}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p?.color ?? '#888' }} />
                        <span className="text-xs flex-1 truncate font-medium">{p?.empire ?? senderName}</span>
                        <span className="text-xs font-bold rounded-full px-1.5 py-0.5" style={{ background: 'var(--danger)', color: '#fff', fontSize: '0.6rem' }}>
                          {count > 9 ? '9+' : count}
                        </span>
                      </button>
                    );
                  })}
                  {unreadGroups.map(({ groupId, count }) => {
                    const g = groups.find(g => g.id === groupId);
                    return (
                      <button
                        key={groupId}
                        className="w-full flex items-center gap-2 text-left rounded px-2 py-1 transition-colors"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                        onClick={() => { setTab('groups'); setActiveGroup(g ?? null); }}
                      >
                        <span className="text-xs">🔗</span>
                        <span className="text-xs flex-1 truncate font-medium">{g?.name ?? groupId}</span>
                        <span className="text-xs font-bold rounded-full px-1.5 py-0.5" style={{ background: 'var(--danger)', color: '#fff', fontSize: '0.6rem' }}>
                          {count > 9 ? '9+' : count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Tabs */}
          {(() => {
            const directUnread = Object.entries(unreadBreakdown).filter(([k]) => k.startsWith('private:')).reduce((s, [, v]) => s + v, 0);
            const groupUnread = Object.entries(unreadBreakdown).filter(([k]) => k.startsWith('group:')).reduce((s, [, v]) => s + v, 0);
            const tabLabels: Record<Tab, { label: string; badge: number }> = {
              global: { label: 'Global', badge: 0 },
              direct: { label: 'Direct', badge: directUnread },
              groups: { label: 'Intel Network', badge: groupUnread },
            };
            return (
              <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
                {(['global', 'direct', 'groups'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors relative"
                    style={{
                      color: tab === t ? 'var(--accent)' : 'var(--text2)',
                      borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                      background: 'transparent',
                    }}
                  >
                    {tabLabels[t].label}
                    {tabLabels[t].badge > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center rounded-full font-bold"
                        style={{ background: 'var(--danger)', color: '#fff', fontSize: '0.6rem', width: '1.1rem', height: '1.1rem', verticalAlign: 'middle' }}>
                        {tabLabels[t].badge > 9 ? '9+' : tabLabels[t].badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
          })()}

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">

            {/* GLOBAL TAB */}
            {tab === 'global' && (
              <>
                <MessageList messages={publicMsgs} />
                {(sessionToken || gmPassword) && (
                  <MessageInput value={pubInput} onChange={setPubInput} onSend={sendPublic} placeholder="Open channel..." />
                )}
              </>
            )}

            {/* DIRECT TAB */}
            {tab === 'direct' && (
              <>
                {!directTarget ? (
                  <div className="p-4 space-y-2 overflow-y-auto flex-1">
                    <p className="text-xs mb-3" style={{ color: 'var(--text2)' }}>Select an empire to open a direct channel:</p>
                    {allPlayers.filter(p => p.name !== playerName).map(p => {
                      const pUnread = unreadBreakdown[`private:${p.name}`] ?? 0;
                      return (
                        <button
                          key={p.name}
                          className="w-full text-left px-3 py-2 rounded flex items-center gap-3 transition-colors"
                          style={{
                            background: 'var(--surface2)',
                            border: pUnread > 0 ? '1px solid var(--accent)' : '1px solid var(--border)',
                          }}
                          onClick={() => setDirectTarget(p.name)}
                        >
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold">{p.empire}</div>
                            <div className="text-xs" style={{ color: 'var(--text2)' }}>{p.name}</div>
                          </div>
                          {pUnread > 0 && (
                            <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0"
                              style={{ background: 'var(--danger)', color: '#fff' }}>
                              {pUnread > 9 ? '9+' : pUnread}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {allPlayers.filter(p => p.name !== playerName).length === 0 && (
                      <p className="text-xs" style={{ color: 'var(--text2)' }}>No other players found.</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                      <button onClick={() => { setDirectTarget(''); setDirectMsgs([]); }} style={{ color: 'var(--text2)' }}>←</button>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: allPlayers.find(p => p.name === directTarget)?.color ?? '#888' }} />
                      <span className="text-sm font-semibold">{allPlayers.find(p => p.name === directTarget)?.empire ?? directTarget}</span>
                    </div>
                    <MessageList messages={directMsgs} />
                    <MessageInput value={directInput} onChange={setDirectInput} onSend={sendDirect} placeholder="Diplomatic communiqué..." />
                  </div>
                )}
              </>
            )}

            {/* GROUPS TAB */}
            {tab === 'groups' && (
              <>
                {!activeGroup ? (
                  <div className="p-4 space-y-4 overflow-y-auto flex-1">
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text2)' }}>Intelligence Networks</p>
                    {groups.map(g => (
                      <button
                        key={g.id}
                        className="w-full text-left card-sm hover:border-accent transition-colors"
                        onClick={() => setActiveGroup(g)}
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div className="text-sm font-semibold">{g.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text2)' }}>{g.members.join(', ')}</div>
                      </button>
                    ))}
                    {sessionToken && (
                      <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                        <p className="text-xs" style={{ color: 'var(--text2)' }}>Create new network:</p>
                        <input className="input text-sm" placeholder="Network name..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
                        <input className="input text-sm" placeholder="Members (comma-separated names)..." value={newGroupMembers} onChange={e => setNewGroupMembers(e.target.value)} />
                        <button className="btn-primary w-full" onClick={createGroup}>Establish Network</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                      <button onClick={() => { setActiveGroup(null); setGroupMsgs([]); }} style={{ color: 'var(--text2)' }}>←</button>
                      <span className="text-sm font-semibold">{activeGroup.name}</span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--text2)' }}>{activeGroup.members.length} members</span>
                    </div>
                    <MessageList messages={groupMsgs} />
                    {sessionToken && (
                      <MessageInput value={groupInput} onChange={setGroupInput} onSend={sendGroup} placeholder="Secure transmission..." />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MessageList({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {messages.map(m => (
        <div key={m.id} className="text-xs">
          <span className="font-bold" style={{ color: m.isGM ? '#ffffff' : m.color }}>
            {m.isGM ? '🎲 GM' : m.empireName}
          </span>
          {' '}
          <span style={{ color: 'var(--text2)' }}>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div style={{ color: 'var(--text)' }}>{m.text}</div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageInput({ value, onChange, onSend, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
}) {
  return (
    <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
      <textarea
        className="input w-full text-sm"
        rows={3}
        style={{ resize: 'none', lineHeight: '1.4', display: 'block' }}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="btn-primary w-full text-sm"
        style={{ padding: '0.5rem', touchAction: 'manipulation' }}
        onClick={onSend}
      >
        Send ➤
      </button>
    </div>
  );
}
