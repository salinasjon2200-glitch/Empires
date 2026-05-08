import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { GameInstance, GameState, WarChest } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  const index = await dbGet<GameInstance[]>('games:index') ?? [];
  return NextResponse.json({ games: index });
}

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const { name, startYear, contentMode, setupMode, warChestPerPlayer } = await req.json();
  if (!name || !startYear) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const id = uuidv4().slice(0, 8);

  const instance: GameInstance = {
    id,
    name,
    startYear,
    contentMode: contentMode ?? 'unrestricted',
    setupMode: setupMode ?? 'bidding',
    warChestPerPlayer: warChestPerPlayer ?? 0.25,
    createdAt: Date.now(),
    status: 'active',
  };

  const initialState: GameState = {
    phase: 0,
    currentYear: startYear,
    theme: 'dark-military',
    biddingOpen: false,
    turnOpen: true,
    processingComplete: false,
    contentMode: contentMode ?? 'unrestricted',
  };

  const initialWarChest: WarChest = {
    balance: 0,
    threshold: 0,
    contributions: [],
    lastTurnCost: 0,
    lastUpdated: Date.now(),
  };

  await dbSet(`${id}:game:state`, initialState);
  await dbSet(`${id}:game:players`, []);
  await dbSet(`${id}:war:chest`, initialWarChest);
  await dbSet(`${id}:turn:archive`, []);
  await dbSet(`${id}:chat:public`, []);

  const index = await dbGet<GameInstance[]>('games:index') ?? [];
  index.push(instance);
  await dbSet('games:index', index);

  return NextResponse.json({ ok: true, id, instance });
}

export async function PATCH(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  const { id, status } = await req.json();
  const index = await dbGet<GameInstance[]>('games:index') ?? [];
  const i = index.findIndex(g => g.id === id);
  if (i === -1) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  index[i] = { ...index[i], status };
  await dbSet('games:index', index);
  return NextResponse.json({ ok: true });
}
