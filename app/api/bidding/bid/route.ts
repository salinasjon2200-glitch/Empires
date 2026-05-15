import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet, dbRPush } from '@/lib/db';
import { getSession, extractToken } from '@/lib/auth';
import { getGameId, gk } from '@/lib/game';
import { Bid, BidState, GameState, PlayerPoints, Player, ChatMessage } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const STARTING_POINTS = 100;
const MIN_BID = 10;

export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const gameState = await dbGet<GameState>(k('game:state'));

  if (!gameState?.biddingOpen) {
    return NextResponse.json({ error: 'Bidding is not open' }, { status: 400 });
  }
  if (gameState.biddingClosesAt && Date.now() > gameState.biddingClosesAt) {
    return NextResponse.json({ error: 'Bidding time has expired' }, { status: 400 });
  }

  // Verify player is actually registered in this game
  const gamePlayers = await dbGet<Player[]>(k('game:players')) ?? [];
  if (!gamePlayers.find(p => p.name === session.playerName && p.status === 'active')) {
    return NextResponse.json({ error: 'You are not a registered player in this game' }, { status: 403 });
  }

  const { country, amount } = await req.json();
  if (!country || typeof amount !== 'number' || amount < MIN_BID) {
    return NextResponse.json({ error: `Minimum bid is ${MIN_BID} points` }, { status: 400 });
  }

  const [bids, points] = await Promise.all([
    dbGet<BidState>(k('bidding:bids')),
    dbGet<PlayerPoints>(k('bidding:points')),
  ]);

  // Normalize: old Redis data stored a single Bid per country; new format is Bid[].
  const rawBids = bids ?? {};
  const currentBids: BidState = {};
  for (const [country, value] of Object.entries(rawBids)) {
    if (Array.isArray(value)) {
      currentBids[country] = value as Bid[];
    } else if (value && typeof value === 'object') {
      currentBids[country] = [value as Bid];
    }
  }
  const currentPoints: PlayerPoints = points ?? {};

  if (currentPoints[session.playerName] === undefined) {
    currentPoints[session.playerName] = STARTING_POINTS;
  }

  // Current leaders for this country (all at same amount, may be empty)
  const leaders: Bid[] = currentBids[country] ?? [];
  const currentTopAmount = leaders.length > 0 ? leaders[0].amount : 0;
  const myIndex = leaders.findIndex(b => b.playerName === session.playerName);
  const wasLeading = myIndex !== -1;
  const myExistingCommitment = wasLeading ? currentTopAmount : 0;

  // Must bid at least current top to enter; equal amount is allowed (tie)
  if (leaders.length > 0 && !wasLeading && amount < currentTopAmount) {
    return NextResponse.json(
      { error: `Must bid at least ${currentTopAmount} pts to match the current leader, or more to take the lead` },
      { status: 400 }
    );
  }

  // Must be raising if already a leader
  if (wasLeading && amount <= currentTopAmount) {
    return NextResponse.json(
      { error: 'You are already tied for the lead at this amount — bid higher to break the tie' },
      { status: 400 }
    );
  }

  const additionalCost = amount - myExistingCommitment;
  if (additionalCost > 0 && currentPoints[session.playerName] < additionalCost) {
    return NextResponse.json({ error: 'Not enough points' }, { status: 400 });
  }

  const newBidEntry: Bid = {
    playerName: session.playerName,
    empireName: session.empireName,
    color: session.color,
    amount,
    placedAt: Date.now(),
  };

  const feedMessages: ChatMessage[] = [];

  if (amount > currentTopAmount) {
    // Outbid: refund all current leaders (except self if was already leading)
    for (const leader of leaders) {
      if (leader.playerName !== session.playerName) {
        currentPoints[leader.playerName] = (currentPoints[leader.playerName] ?? STARTING_POINTS) + leader.amount;
        feedMessages.push({
          id: uuidv4(),
          senderName: 'System',
          empireName: 'System',
          color: '#6b7280',
          text: `${session.empireName} bid ${amount} on ${country}, outbidding ${leader.empireName} (${leader.amount})`,
          timestamp: Date.now(),
        });
      }
    }
    currentBids[country] = [newBidEntry];
    currentPoints[session.playerName] -= additionalCost;
  } else {
    // Equal bid — join the tie
    currentBids[country] = [...leaders, newBidEntry];
    currentPoints[session.playerName] -= amount;
    feedMessages.push({
      id: uuidv4(),
      senderName: 'System',
      empireName: 'System',
      color: '#6b7280',
      text: `${session.empireName} matched the bid of ${amount} on ${country} — ${currentBids[country].length} empires now tied`,
      timestamp: Date.now(),
    });
  }

  await Promise.all([
    dbSet(k('bidding:bids'), currentBids),
    dbSet(k('bidding:points'), currentPoints),
    ...feedMessages.map(msg => dbRPush(k('bidding:feed'), msg)),
  ]);

  return NextResponse.json({ success: true, remainingPoints: currentPoints[session.playerName] });
}
