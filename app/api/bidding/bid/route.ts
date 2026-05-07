import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet, dbRPush } from '@/lib/db';
import { getSession, extractToken } from '@/lib/auth';
import { BidState, GameState, PlayerPoints, ChatMessage } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

const STARTING_POINTS = 100;
const MIN_BID = 10;

export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const gameState = await dbGet<GameState>('game:state');
  if (!gameState?.biddingOpen) {
    return NextResponse.json({ error: 'Bidding is not open' }, { status: 400 });
  }
  if (gameState.biddingClosesAt && Date.now() > gameState.biddingClosesAt) {
    return NextResponse.json({ error: 'Bidding has closed' }, { status: 400 });
  }

  const { country, amount } = await req.json();
  if (!country || typeof amount !== 'number' || amount < MIN_BID) {
    return NextResponse.json({ error: `Minimum bid is ${MIN_BID} points` }, { status: 400 });
  }

  const [bids, points] = await Promise.all([
    dbGet<BidState>('bidding:bids'),
    dbGet<PlayerPoints>('bidding:points'),
  ]);

  const currentBids = bids ?? {};
  const currentPoints = points ?? {};

  // Initialize player points
  if (currentPoints[session.playerName] === undefined) {
    currentPoints[session.playerName] = STARTING_POINTS;
  }

  const currentPlayerBid = currentBids[country];
  const wasLeading = currentPlayerBid?.playerName === session.playerName;

  // Calculate what it will cost (difference from current bid on this country, if already leading)
  const existingBidOnCountry = wasLeading ? (currentPlayerBid?.amount ?? 0) : 0;
  const additionalCost = amount - existingBidOnCountry;

  if (additionalCost > 0 && currentPoints[session.playerName] < additionalCost) {
    return NextResponse.json({ error: 'Not enough points' }, { status: 400 });
  }

  // Check if outbidding someone
  if (currentPlayerBid && !wasLeading && amount <= currentPlayerBid.amount) {
    return NextResponse.json({ error: `Must bid more than current leader (${currentPlayerBid.amount})` }, { status: 400 });
  }

  // Refund old leader if different player
  if (currentPlayerBid && !wasLeading) {
    if (currentPoints[currentPlayerBid.playerName] === undefined) {
      currentPoints[currentPlayerBid.playerName] = STARTING_POINTS;
    }
    currentPoints[currentPlayerBid.playerName] += currentPlayerBid.amount;

    // Post feed notification
    const feedMsg: ChatMessage = {
      id: uuidv4(),
      senderName: 'System',
      empireName: 'System',
      color: '#6b7280',
      text: `${session.empireName} bid ${amount} on ${country}, outbidding ${currentPlayerBid.playerName} (${currentPlayerBid.amount})`,
      timestamp: Date.now(),
    };
    await dbRPush('bidding:feed', feedMsg);
  }

  // Place new bid
  currentBids[country] = {
    playerName: session.playerName,
    empireName: session.empireName,
    color: session.color,
    amount,
    placedAt: Date.now(),
  };

  // Deduct cost
  if (wasLeading) {
    currentPoints[session.playerName] -= Math.max(0, additionalCost);
  } else {
    currentPoints[session.playerName] -= amount;
  }

  await Promise.all([
    dbSet('bidding:bids', currentBids),
    dbSet('bidding:points', currentPoints),
  ]);

  return NextResponse.json({ success: true, remainingPoints: currentPoints[session.playerName] });
}
