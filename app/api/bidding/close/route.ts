import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { Bid, BidState, GameState, Player, TerritoryMap } from '@/lib/types';

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const openMinutes: number = body.openMinutes ?? 0;
  const action: string = body.action ?? 'open'; // 'open' | 'close' | 'confirm'

  const state = await dbGet<GameState>('game:state') ?? {} as GameState;

  if (action === 'open') {
    const closesAt = openMinutes > 0 ? Date.now() + openMinutes * 60 * 1000 : undefined;
    await dbSet('game:state', { ...state, biddingOpen: true, biddingClosesAt: closesAt });
    return NextResponse.json({ success: true, closesAt });
  }

  if (action === 'close') {
    await dbSet('game:state', { ...state, biddingOpen: false });
    return NextResponse.json({ success: true });
  }

  if (action === 'confirm') {
    // Finalize: assign territories from bids, handle ties
    const bids = await dbGet<BidState>('bidding:bids') ?? {};
    const players = await dbGet<Player[]>('game:players') ?? [];
    const map: TerritoryMap = {};

    // Group countries by top bidder; detect ties
    const countryTops: Record<string, { amount: number; bidders: Bid[] }> = {};
    for (const [country, bid] of Object.entries(bids)) {
      if (!bid) continue;
      if (!countryTops[country]) countryTops[country] = { amount: bid.amount, bidders: [bid] };
      else if (bid.amount === countryTops[country].amount) countryTops[country].bidders.push(bid);
      else if (bid.amount > countryTops[country].amount) countryTops[country] = { amount: bid.amount, bidders: [bid] };
    }

    const suffixes = ['(West)', '(East)', '(North)', '(South)', '(Part 1)', '(Part 2)', '(Part 3)'];

    for (const [country, { bidders }] of Object.entries(countryTops)) {
      const playerIdx = (p: string) => players.findIndex(pl => pl.name === p);

      if (bidders.length === 1) {
        const bid = bidders[0]!;
        const p = players[playerIdx(bid.playerName)];
        if (p) {
          map[country] = { empire: p.empire, leader: p.name, color: p.color, status: 'active', since: state.currentYear };
          if (!p.territories.includes(country)) p.territories.push(country);
        }
      } else {
        // Tie — split
        bidders.forEach((bid, i) => {
          const splitName = `${country} ${suffixes[i] ?? `(Part ${i+1})`}`;
          const p = players[playerIdx(bid.playerName)];
          if (p) {
            map[splitName] = { empire: p.empire, leader: p.name, color: p.color, status: 'active', since: state.currentYear };
            if (!p.territories.includes(splitName)) p.territories.push(splitName);
          }
        });
      }
    }

    await Promise.all([
      dbSet('map:territories', map),
      dbSet('game:players', players),
      dbSet('game:state', { ...state, biddingOpen: false, phase: 2 }),
    ]);

    return NextResponse.json({ success: true, territories: map });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// Also allow GET to open bidding with duration (for timer start)
export async function PUT(req: NextRequest) {
  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }
  const { openMinutes } = await req.json();
  const state = await dbGet<GameState>('game:state') ?? {} as GameState;
  const closesAt = openMinutes > 0 ? Date.now() + openMinutes * 60 * 1000 : undefined;
  await dbSet('game:state', { ...state, biddingOpen: true, phase: 1, biddingClosesAt: closesAt });
  return NextResponse.json({ success: true, closesAt });
}
