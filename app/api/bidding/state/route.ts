import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { getGameId, gk } from '@/lib/game';
import { BidState, GameState, PlayerPoints } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const [bids, state, points] = await Promise.all([
    dbGet<BidState>(k('bidding:bids')),
    dbGet<GameState>(k('game:state')),
    dbGet<PlayerPoints>(k('bidding:points')),
  ]);

  // Normalize bids: old format stored a single Bid per country; new format stores Bid[].
  // Wrap any non-array value so clients always receive Record<string, Bid[]>.
  const rawBids = bids ?? {};
  const normalizedBids: Record<string, unknown[]> = {};
  for (const [country, value] of Object.entries(rawBids)) {
    if (Array.isArray(value)) {
      normalizedBids[country] = value;
    } else if (value && typeof value === 'object') {
      normalizedBids[country] = [value];
    }
  }

  return NextResponse.json({
    bids: normalizedBids,
    points: points ?? {},
    open: state?.biddingOpen ?? false,
    closesAt: state?.biddingClosesAt ?? null,
    phase: state?.phase ?? 0,
  });
}
