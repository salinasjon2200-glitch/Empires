import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { extractGMToken } from '@/lib/auth';
import { Player, GameState } from '@/lib/types';
import { PLAYER_COLORS } from '@/lib/constants';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

// POST – register a new player (GM only)
export async function POST(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }

  const { name, empire, password, email } = await req.json();
  if (!name || !empire || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  if (players.find(p => p.empire.toLowerCase() === empire.toLowerCase())) {
    return NextResponse.json({ error: 'Empire already exists' }, { status: 409 });
  }

  const state = await dbGet<GameState>(k('game:state'));
  const color = PLAYER_COLORS[players.length % PLAYER_COLORS.length];
  const passwordHash = await hashPassword(password);
  const joinedYear = state?.currentYear ?? 2032;
  const newPlayer: Player = { name, empire, email: email || undefined, passwordHash, color, status: 'active', joinedYear, territories: [] };
  players.push(newPlayer);
  await dbSet(k('game:players'), players);

  // Send notification email
  if (process.env.RESEND_API_KEY) {
    const emailBody = email
      ? `New empire registered.<br><br><b>Player:</b> ${name}<br><b>Empire:</b> ${empire}<br><b>Email:</b> ${email}`
      : `New empire registered.<br><br><b>Player:</b> ${name}<br><b>Empire:</b> ${empire}<br><i>No email provided.</i>`;
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Empires <onboarding@resend.dev>',
        to: ['stanleyloomis451@gmail.com'],
        subject: `New Empire Joined: ${empire} (${name})`,
        html: emailBody,
      }),
    }).catch(e => console.error('Email notification failed:', e));
  }

  return NextResponse.json({ success: true, color, empire, name });
}

// GET – list all players with passwords visible (GM only)
export async function GET(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }
  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  return NextResponse.json({ players });
}
