import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { TerritoryMap, Player } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const territories = await dbGet<TerritoryMap>(k('map:territories')) ?? {};
  return NextResponse.json({ territories });
}

export async function POST(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!auth || auth !== process.env.GM_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { country, empire, leader, color, status } = await req.json();
  if (!country) return NextResponse.json({ error: 'Missing country' }, { status: 400 });

  const territories = await dbGet<TerritoryMap>(k('map:territories')) ?? {};

  if (status === 'remove') {
    delete territories[country];
  } else {
    territories[country] = { empire: empire ?? '', leader: leader ?? '', color: color ?? '#6b7280', status: status ?? 'active', since: new Date().getFullYear() };
  }

  await dbSet(k('map:territories'), territories);

  // Keep player territory lists in sync
  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  const updated = players.map(p => {
    const terrs = p.territories.filter(t => t !== country);
    if (status === 'active' && p.empire === empire) terrs.push(country);
    return { ...p, territories: terrs };
  });
  await dbSet(k('game:players'), updated);

  return NextResponse.json({ ok: true, territories });
}
