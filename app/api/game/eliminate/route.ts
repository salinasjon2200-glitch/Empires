import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { Player, TerritoryMap, ChatMessage } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }

  const { empireName, year } = await req.json();
  if (!empireName) return NextResponse.json({ error: 'empireName required' }, { status: 400 });

  const players = await dbGet<Player[]>('game:players') ?? [];
  const idx = players.findIndex(p => p.empire.toLowerCase() === empireName.toLowerCase());
  if (idx === -1) return NextResponse.json({ error: 'Empire not found' }, { status: 404 });

  players[idx].status = 'eliminated';
  players[idx].eliminatedYear = year ?? new Date().getFullYear();
  players[idx].territories = [];
  await dbSet('game:players', players);

  // Clear their territories on the map
  const map = await dbGet<TerritoryMap>('map:territories') ?? {};
  for (const [country, t] of Object.entries(map)) {
    if (t.empire.toLowerCase() === empireName.toLowerCase()) {
      map[country] = { ...t, empire: 'Ungoverned', color: '#374151', status: 'ungoverned' };
    }
  }
  await dbSet('map:territories', map);

  // Post public chat notification
  const msg: ChatMessage = {
    id: uuidv4(),
    senderName: 'Game Master',
    empireName: 'GM',
    color: '#ffffff',
    text: `📢 ${empireName} has been eliminated. Their territories are now ungoverned.`,
    timestamp: Date.now(),
    isGM: true,
  };
  const chat = await dbGet<ChatMessage[]>('chat:public') ?? [];
  chat.push(msg);
  await dbSet('chat:public', chat.slice(-500));

  return NextResponse.json({ success: true });
}
