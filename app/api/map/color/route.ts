import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { TerritoryMap, Player } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';
import { extractGMToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const { empire, color } = await req.json();
  if (!empire?.trim()) return NextResponse.json({ error: 'Missing empire' }, { status: 400 });
  if (!color?.match(/^#[0-9a-fA-F]{6}$/)) return NextResponse.json({ error: 'Invalid color (must be #rrggbb)' }, { status: 400 });

  const [territories, players] = await Promise.all([
    dbGet<TerritoryMap>(k('map:territories')) ?? {},
    dbGet<Player[]>(k('game:players')) ?? [],
  ]);

  const resolvedTerritories = (territories as TerritoryMap) ?? {};
  const resolvedPlayers = (players as Player[]) ?? [];

  let updated = 0;
  const newTerritories: TerritoryMap = {};
  for (const [country, t] of Object.entries(resolvedTerritories)) {
    if (t.empire === empire) {
      newTerritories[country] = { ...t, color };
      updated++;
    } else {
      newTerritories[country] = t;
    }
  }

  const newPlayers = resolvedPlayers.map(p => p.empire === empire ? { ...p, color } : p);

  await Promise.all([
    dbSet(k('map:territories'), newTerritories),
    dbSet(k('game:players'), newPlayers),
  ]);

  return NextResponse.json({ ok: true, updated });
}
