import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet, dbDel, dbKeys } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { getGameId, gk } from '@/lib/game';
import { GameState, Group, Player } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const {
    confirm,
    startYear = 2032,
    openBidding = false,
    biddingClosesAt,        // unix ms timestamp, optional
    keepSettings = true,    // preserve contentMode, joinPassword, theme
  } = await req.json();

  if (confirm !== 'RESET') {
    return NextResponse.json({ error: 'Confirmation string must be exactly "RESET"' }, { status: 400 });
  }

  // ── Collect existing data needed to build the full delete list ───────────
  const [archive, players, groups, currentState] = await Promise.all([
    dbGet<number[]>(k('turn:archive')) ?? Promise.resolve([] as number[]),
    dbGet<Player[]>(k('game:players')) ?? Promise.resolve([] as Player[]),
    dbGet<Group[]>(k('chat:groups')) ?? Promise.resolve([] as Group[]),
    dbGet<GameState>(k('game:state')) ?? Promise.resolve(null),
  ]);

  // ── Build exhaustive delete list from known structured data ──────────────
  const knownKeys: string[] = [
    'game:players',
    'game:state',
    'map:territories',
    'turn:archive',
    'war:chest',
    'chat:public',
    'chat:groups',
    'vote:theme',
    'bidding:bids',
    'bidding:points',
  ];

  const archiveYears = (archive ?? []) as number[];
  const playerList = (players ?? []) as Player[];
  const groupList = (groups ?? []) as Group[];

  for (const year of archiveYears) {
    knownKeys.push(
      `turn:${year}:actions`,
      `turn:${year}:summary`,
      `turn:${year}:advisors`,
      `turn:${year}:processing`,
      `turn:${year}:codes`,
      `map:history:${year}`,
    );
    for (const p of playerList) {
      knownKeys.push(`turn:${year}:advisor:${p.name}`);
      if (p.isMerged || p.leaders) knownKeys.push(`turn:${year}:leader-actions:${p.empire}`);
    }
  }

  for (const g of groupList) {
    knownKeys.push(`chat:group:${g.id}`);
  }

  // ── Also sweep wildcards in KV to catch any stragglers ──────────────────
  // (dbKeys with patterns works in KV mode; returns raw keys already including prefix)
  const rawWildcardKeys: string[] = [];
  try {
    const results = await Promise.all([
      dbKeys(k('turn:*:advisor:*')),
      dbKeys(k('turn:*:leader-actions:*')),
      dbKeys(k('chat:private:*')),
      dbKeys(k('chat:group:*')),
    ]);
    for (const keys of results) rawWildcardKeys.push(...keys);
  } catch { /* file mode or KV doesn't support pattern; known list covers it */ }

  // ── Delete everything ────────────────────────────────────────────────────
  await Promise.all([
    ...knownKeys.map(key => dbDel(k(key)).catch(() => {})),
    ...rawWildcardKeys.map(key => dbDel(key).catch(() => {})), // raw keys from dbKeys, no k() wrap
  ]);

  // ── Write fresh game state ───────────────────────────────────────────────
  const freshState: GameState = {
    phase: openBidding ? 1 : 0,
    currentYear: startYear,
    theme: keepSettings ? (currentState?.theme ?? 'dark-military') : 'dark-military',
    biddingOpen: openBidding,
    ...(openBidding && biddingClosesAt ? { biddingClosesAt } : {}),
    turnOpen: false,
    processingComplete: false,
    ...(keepSettings && currentState?.contentMode ? { contentMode: currentState.contentMode } : {}),
    ...(keepSettings && currentState?.joinPassword ? { joinPassword: currentState.joinPassword } : {}),
  };

  await dbSet(k('game:state'), freshState);

  return NextResponse.json({
    success: true,
    deletedKnownKeys: knownKeys.length,
    deletedWildcardKeys: rawWildcardKeys.length,
    freshState,
  });
}
