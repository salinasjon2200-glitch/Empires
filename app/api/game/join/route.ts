import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';
import { Player, GameState, TerritoryMap } from '@/lib/types';
import { PLAYER_COLORS, COUNTRIES } from '@/lib/constants';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const { action, name, empire, password, email, joinCode, sessionToken, territories } = await req.json();

  const state = await dbGet<GameState>(k('game:state'));

  // ── Step 1: Register ─────────────────────────────────────────────────────
  if (action === 'register') {
    if (!name || !empire || !password || !joinCode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const storedJoinPassword = state?.joinPassword;
    if (!storedJoinPassword) {
      return NextResponse.json({ error: 'Join registration is not currently open' }, { status: 403 });
    }
    if (joinCode !== storedJoinPassword) {
      return NextResponse.json({ error: 'Invalid join code' }, { status: 401 });
    }

    const players = await dbGet<Player[]>(k('game:players')) ?? [];
    if (players.find(p => p.empire.toLowerCase() === empire.toLowerCase())) {
      return NextResponse.json({ error: 'Empire name already taken' }, { status: 409 });
    }
    if (players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'Player name already taken' }, { status: 409 });
    }

    const color = PLAYER_COLORS[players.length % PLAYER_COLORS.length];
    const passwordHash = await hashPassword(password);
    const joinedYear = state?.currentYear ?? 2032;
    const newPlayer: Player = { name, empire, email: email || undefined, passwordHash, color, status: 'active', joinedYear, territories: [] };
    players.push(newPlayer);
    await dbSet(k('game:players'), players);

    const token = await createSession(name, empire, color);

    // Find unclaimed countries
    const map = await dbGet<TerritoryMap>(k('map:territories')) ?? {};
    const claimed = new Set(
      Object.entries(map)
        .filter(([, t]) => t.status === 'active')
        .map(([country]) => country)
    );
    const unclaimed = COUNTRIES.filter(c => !claimed.has(c));

    // Send notification email
    if (process.env.RESEND_API_KEY) {
      const emailBody = email
        ? `New empire self-registered via join link.<br><br><b>Player:</b> ${name}<br><b>Empire:</b> ${empire}<br><b>Email:</b> ${email}`
        : `New empire self-registered via join link.<br><br><b>Player:</b> ${name}<br><b>Empire:</b> ${empire}<br><i>No email provided.</i>`;
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

    return NextResponse.json({ success: true, sessionToken: token, name, empire, color, unclaimed });
  }

  // ── Step 2: Claim territories ────────────────────────────────────────────
  if (action === 'claim') {
    if (!sessionToken || !territories || !Array.isArray(territories)) {
      return NextResponse.json({ error: 'Missing sessionToken or territories' }, { status: 400 });
    }
    if (territories.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 territories allowed' }, { status: 400 });
    }

    // Verify session
    const { getSession } = await import('@/lib/auth');
    const session = await getSession(sessionToken);
    if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const players = await dbGet<Player[]>(k('game:players')) ?? [];
    const player = players.find(p => p.name === session.playerName);
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const map = await dbGet<TerritoryMap>(k('map:territories')) ?? {};

    // Validate all requested territories are unclaimed
    for (const country of territories) {
      if (map[country]?.status === 'active') {
        return NextResponse.json({ error: `${country} is already claimed` }, { status: 409 });
      }
    }

    // Assign territories
    for (const country of territories) {
      map[country] = { empire: player.empire, leader: player.name, color: player.color, status: 'active', since: state?.currentYear ?? 2032 };
    }
    await dbSet(k('map:territories'), map);

    // Update player territories list
    const updatedPlayers = players.map(p =>
      p.name === player.name ? { ...p, territories } : p
    );
    await dbSet(k('game:players'), updatedPlayers);

    return NextResponse.json({ success: true, territories });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
