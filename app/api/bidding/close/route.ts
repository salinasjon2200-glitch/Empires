import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { getGameId, gk } from '@/lib/game';
import { Bid, BidState, ChatMessage, GameState, Player, TerritoryMap } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }

  const gameId = getGameId(req);
  const k = gk(gameId);

  const body = await req.json().catch(() => ({}));
  const openMinutes: number = body.openMinutes ?? 0;
  const action: string = body.action ?? 'open'; // 'open' | 'close' | 'confirm'

  const state = await dbGet<GameState>(k('game:state')) ?? {} as GameState;

  // ── Open bidding ────────────────────────────────────────────────────────
  if (action === 'open') {
    const closesAt = openMinutes > 0 ? Date.now() + openMinutes * 60 * 1000 : undefined;
    await dbSet(k('game:state'), { ...state, biddingOpen: true, phase: 1, biddingClosesAt: closesAt });
    return NextResponse.json({ success: true, closesAt });
  }

  // ── Close bidding ───────────────────────────────────────────────────────
  if (action === 'close') {
    await dbSet(k('game:state'), { ...state, biddingOpen: false });
    return NextResponse.json({ success: true });
  }

  // ── Confirm: assign territories from closed bids ────────────────────────
  if (action === 'confirm') {
    // GUARD: bidding must be closed before territories can be assigned.
    // Prevents assigning mid-round while players are still bidding.
    if (state.biddingOpen) {
      return NextResponse.json(
        { error: 'Bidding is still open. Close bidding before confirming territory assignments.' },
        { status: 400 }
      );
    }

    const rawBids = await dbGet<Record<string, unknown>>(k('bidding:bids')) ?? {};
    // Normalize: old format stored a single Bid per country; new format is Bid[].
    const bids: BidState = {};
    for (const [country, value] of Object.entries(rawBids)) {
      if (Array.isArray(value)) {
        bids[country] = value as Bid[];
      } else if (value && typeof value === 'object') {
        bids[country] = [value as Bid];
      }
    }
    const players = await dbGet<Player[]>(k('game:players')) ?? [];

    // Start from the EXISTING territory map — only update countries that were bid on.
    const existingMap = await dbGet<TerritoryMap>(k('map:territories')) ?? {};
    const map: TerritoryMap = { ...existingMap };

    const suffixes = ['(West)', '(East)', '(North)', '(South)', '(Part 1)', '(Part 2)', '(Part 3)'];

    // Each entry in bids is already an array of tied top-bidders for that country
    for (const [country, bidders] of Object.entries(bids)) {
      if (!bidders || bidders.length === 0) continue;
      const playerIdx = (pName: string) => players.findIndex(pl => pl.name === pName);

      if (bidders.length === 1) {
        const bid = bidders[0]!;
        const p = players[playerIdx(bid.playerName)];
        if (p) {
          map[country] = { empire: p.empire, leader: p.name, color: p.color, status: 'active', since: state.currentYear };
          if (!p.territories.includes(country)) p.territories.push(country);
        }
      } else {
        // Tie — split country with suffixes; remove the unsuffixed entry if it existed
        delete map[country];
        bidders.forEach((bid, i) => {
          const splitName = `${country} ${suffixes[i] ?? `(Part ${i + 1})`}`;
          const p = players[playerIdx(bid.playerName)];
          if (p) {
            map[splitName] = { empire: p.empire, leader: p.name, color: p.color, status: 'active', since: state.currentYear };
            if (!p.territories.includes(splitName)) p.territories.push(splitName);
          }
        });
      }
    }

    await Promise.all([
      dbSet(k('map:territories'), map),
      dbSet(k('game:players'), players),
      dbSet(k('game:state'), { ...state, biddingOpen: false, phase: 2 }),
    ]);

    return NextResponse.json({ success: true, territories: map, assignedCount: Object.keys(bids).length });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// ── GET — diagnostic: compare bids vs current map ────────────────────────────
export async function GET(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const [rawBids, feed, map, players] = await Promise.all([
    dbGet<Record<string, unknown>>(k('bidding:bids')) ?? Promise.resolve({}),
    dbGet<ChatMessage[]>(k('bidding:feed')) ?? Promise.resolve([]),
    dbGet<TerritoryMap>(k('map:territories')) ?? Promise.resolve({} as TerritoryMap),
    dbGet<Player[]>(k('game:players')) ?? Promise.resolve([] as Player[]),
  ]);

  // Normalize bids
  const bids: BidState = {};
  for (const [country, value] of Object.entries(rawBids ?? {})) {
    if (Array.isArray(value)) bids[country] = value as Bid[];
    else if (value && typeof value === 'object') bids[country] = [value as Bid];
  }

  // Build summary: for each bid, was it assigned in the map?
  const bidSummary = Object.entries(bids).map(([country, bidders]) => {
    const assignedIn = Object.keys(map ?? {}).filter(k =>
      k === country || k.startsWith(`${country} (`)
    );
    return {
      country,
      winner: bidders[0]?.empireName ?? '?',
      winnerPlayer: bidders[0]?.playerName ?? '?',
      amount: bidders[0]?.amount ?? 0,
      tied: bidders.length > 1,
      tiedWith: bidders.length > 1 ? bidders.map(b => b.empireName) : [],
      assignedIn,
      missing: assignedIn.length === 0,
    };
  });

  // Find empires with no territories at all
  const empiresWithTerritories = new Set(Object.values(map ?? {}).map(t => t.empire));
  const empiresWithoutTerritories = (players ?? [])
    .filter(p => p.status === 'active' && !empiresWithTerritories.has(p.empire))
    .map(p => p.empire);

  return NextResponse.json({
    bidsFound: Object.keys(bids).length,
    feedMessages: (feed ?? []).length,
    missing: bidSummary.filter(b => b.missing),
    assigned: bidSummary.filter(b => !b.missing),
    empiresWithoutTerritories,
    recentFeed: (feed ?? []).slice(-20).map(m => m.text),
  });
}

// PUT: open bidding with a timer (legacy support)
export async function PUT(req: NextRequest) {
  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }
  const gameId = getGameId(req);
  const k = gk(gameId);
  const { openMinutes } = await req.json();
  const state = await dbGet<GameState>(k('game:state')) ?? {} as GameState;
  const closesAt = openMinutes > 0 ? Date.now() + openMinutes * 60 * 1000 : undefined;
  await dbSet(k('game:state'), { ...state, biddingOpen: true, phase: 1, biddingClosesAt: closesAt });
  return NextResponse.json({ success: true, closesAt });
}
