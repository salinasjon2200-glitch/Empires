import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import { Player, TerritoryMap, MergedLeader } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const { empireNames, newEmpireName, newColor, leaders } = await req.json() as {
    empireNames: string[];           // empires to merge
    newEmpireName: string;           // merged empire display name
    newColor: string;                // merged empire color
    leaders: { name: string; originalEmpire: string; weight: number; password: string }[];
  };

  if (!empireNames?.length || !newEmpireName?.trim() || !newColor || !leaders?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const totalWeight = leaders.reduce((s, l) => s + l.weight, 0);
  if (totalWeight !== 100) {
    return NextResponse.json({ error: `Leader weights must sum to 100 (got ${totalWeight})` }, { status: 400 });
  }

  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  const map = await dbGet<TerritoryMap>(k('map:territories')) ?? {};

  // Collect territories from all empires being merged
  const mergedTerritories = players
    .filter(p => empireNames.includes(p.empire))
    .flatMap(p => p.territories);

  // Hash leader passwords
  const hashedLeaders: MergedLeader[] = await Promise.all(
    leaders.map(async l => ({
      name: l.name,
      originalEmpire: l.originalEmpire,
      weight: l.weight,
      passwordHash: await hashPassword(l.password),
    }))
  );

  // Build merged player record (use first empire's name field as internal name)
  const mergedPlayer: Player = {
    name: newEmpireName,
    empire: newEmpireName,
    passwordHash: '',   // not used — leaders have individual passwords
    color: newColor,
    status: 'active',
    territories: mergedTerritories,
    isMerged: true,
    leaders: hashedLeaders,
  };

  // Update player list: remove merged empires, add merged player
  const updatedPlayers = [
    ...players.filter(p => !empireNames.includes(p.empire)),
    mergedPlayer,
  ];

  // Update territory map: reassign all merged empire territories to new empire
  const updatedMap: TerritoryMap = {};
  for (const [country, t] of Object.entries(map)) {
    if (empireNames.includes(t.empire)) {
      updatedMap[country] = { ...t, empire: newEmpireName, color: newColor };
    } else {
      updatedMap[country] = t;
    }
  }

  await Promise.all([
    dbSet(k('game:players'), updatedPlayers),
    dbSet(k('map:territories'), updatedMap),
  ]);

  return NextResponse.json({ ok: true, empire: mergedPlayer });
}
