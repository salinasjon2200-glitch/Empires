import { NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { BidState, GameState, PlayerPoints } from '@/lib/types';

export async function GET() {
  const [bids, state, points] = await Promise.all([
    dbGet<BidState>('bidding:bids'),
    dbGet<GameState>('game:state'),
    dbGet<PlayerPoints>('bidding:points'),
  ]);

  return NextResponse.json({
    bids: bids ?? {},
    points: points ?? {},
    open: state?.biddingOpen ?? false,
    closesAt: state?.biddingClosesAt ?? null,
    phase: state?.phase ?? 0,
  });
}
