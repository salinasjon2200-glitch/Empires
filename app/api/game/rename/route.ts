import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken, hashPassword } from '@/lib/auth';
import { getGameId, gk } from '@/lib/game';
import { Player } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const { oldEmpireName, newEmpireName, newLeaderName, newPassword } = await req.json();

  if (!oldEmpireName?.trim()) {
    return NextResponse.json({ error: 'oldEmpireName is required' }, { status: 400 });
  }

  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  const playerIndex = players.findIndex(p => p.empire === oldEmpireName);
  if (playerIndex === -1) {
    return NextResponse.json({ error: `Empire "${oldEmpireName}" not found` }, { status: 404 });
  }

  const effectiveNewEmpire = newEmpireName?.trim() || oldEmpireName;
  const oldLeaderName = players[playerIndex].name;
  const effectiveNewLeader = newLeaderName?.trim() || oldLeaderName;

  // Check empire name not already taken (only if actually changing it)
  if (effectiveNewEmpire !== oldEmpireName &&
      players.some((p, i) => i !== playerIndex && p.empire === effectiveNewEmpire)) {
    return NextResponse.json({ error: `Empire name "${effectiveNewEmpire}" is already in use` }, { status: 409 });
  }

  // Build updated player record
  const updatedPlayer: Player = {
    ...players[playerIndex],
    empire: effectiveNewEmpire,
    name: effectiveNewLeader,
  };

  // Optionally update password
  let passwordChanged = false;
  if (newPassword?.trim()) {
    updatedPlayer.passwordHash = await hashPassword(newPassword.trim());
    passwordChanged = true;
  }

  players[playerIndex] = updatedPlayer;
  await dbSet(k('game:players'), players);

  // Update territories (leader + empire name on map)
  const territories = await dbGet<Record<string, { empire: string; leader: string; color: string; status: string }>>(k('map:territories')) ?? {};
  let updatedCount = 0;
  for (const country of Object.keys(territories)) {
    if (territories[country].empire === oldEmpireName) {
      territories[country] = {
        ...territories[country],
        empire: effectiveNewEmpire,
        leader: effectiveNewLeader,
      };
      updatedCount++;
    }
  }
  await dbSet(k('map:territories'), territories);

  // Migrate current-turn actions key if leader or empire name changed
  try {
    const stateR = await dbGet<{ currentYear: number }>(k('game:state'));
    const currentYear = stateR?.currentYear ?? 2032;
    const actions = await dbGet<Record<string, string>>(k(`turn:${currentYear}:actions`)) ?? {};
    let actionsChanged = false;

    if (oldLeaderName !== effectiveNewLeader && actions[oldLeaderName] !== undefined) {
      actions[effectiveNewLeader] = actions[oldLeaderName];
      delete actions[oldLeaderName];
      actionsChanged = true;
    }
    if (oldEmpireName !== effectiveNewEmpire && actions[oldEmpireName] !== undefined) {
      actions[effectiveNewEmpire] = actions[oldEmpireName];
      delete actions[oldEmpireName];
      actionsChanged = true;
    }
    if (actionsChanged) await dbSet(k(`turn:${currentYear}:actions`), actions);
  } catch {
    // Non-fatal
  }

  return NextResponse.json({
    success: true,
    oldEmpireName,
    newEmpireName: effectiveNewEmpire,
    oldLeaderName,
    newLeaderName: effectiveNewLeader,
    passwordChanged,
    territoriesUpdated: updatedCount,
  });
}
