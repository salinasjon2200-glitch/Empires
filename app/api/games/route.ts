import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet, dbDel, dbKeys } from '@/lib/db';import { extractGMToken } from '@/lib/auth';
import { GameInstance, GameState, WarChest } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  const index = await dbGet<GameInstance[]>('games:index') ?? [];
  return NextResponse.json({ games: index });
}

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const { name, startYear, contentMode, setupMode, warChestPerPlayer } = await req.json();
  if (!name || !startYear) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const id = uuidv4().slice(0, 8);

  const instance: GameInstance = {
    id,
    name,
    startYear,
    contentMode: contentMode ?? 'unrestricted',
    setupMode: setupMode ?? 'bidding',
    warChestPerPlayer: warChestPerPlayer ?? 0.25,
    createdAt: Date.now(),
    status: 'active',
  };

  const initialState: GameState = {
    phase: 0,
    currentYear: startYear,
    theme: 'dark-military',
    biddingOpen: false,
    turnOpen: true,
    processingComplete: false,
    contentMode: contentMode ?? 'unrestricted',
  };

  const initialWarChest: WarChest = {
    balance: 0,
    threshold: 0,
    contributions: [],
    lastTurnCost: 0,
    lastUpdated: Date.now(),
  };

  await dbSet(`${id}:game:state`, initialState);
  await dbSet(`${id}:game:players`, []);
  await dbSet(`${id}:war:chest`, initialWarChest);
  await dbSet(`${id}:turn:archive`, []);
  await dbSet(`${id}:chat:public`, []);

  const index = await dbGet<GameInstance[]>('games:index') ?? [];
  index.push(instance);
  await dbSet('games:index', index);

  return NextResponse.json({ ok: true, id, instance });
}

export async function PATCH(req: NextRequest) {
  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }

  const { id, status, name } = await req.json();

  const index = await dbGet<GameInstance[]>('games:index') ?? [];
  const i = index.findIndex(g => g.id === id);

  if (i === -1) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  // Rename the game
  if (name !== undefined) {
    const trimmedName = String(name).trim();

    if (!trimmedName) {
      return NextResponse.json(
        { error: 'Game name cannot be empty' },
        { status: 400 }
      );
    }

    // Don't allow two games to have the same name.
    const duplicate = index.some(
      (g, indexNumber) =>
        indexNumber !== i &&
        g.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      return NextResponse.json(
        { error: 'A game with that name already exists' },
        { status: 409 }
      );
    }

    index[i] = {
      ...index[i],
      name: trimmedName,
    };
  }

  // Preserve the existing status functionality.
  if (status !== undefined) {
    index[i] = {
      ...index[i],
      status,
    };
  }

  await dbSet('games:index', index);

  return NextResponse.json({
    ok: true,
    game: index[i],
  });
}
export async function DELETE(req: NextRequest) {
  if (!extractGMToken(req)) {
    return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  }

  const { id, confirm } = await req.json();

  if (confirm !== 'DELETE') {
    return NextResponse.json(
      { error: 'Confirmation string must be exactly "DELETE"' },
      { status: 400 }
    );
  }

  // S2 is the original legacy game and uses unprefixed database keys.
  if (!id || id === 's2') {
    return NextResponse.json(
      {
        error:
          'The legacy S2 game cannot be deleted here. Use Full Game Reset for S2.'
      },
      { status: 400 }
    );
  }

  const index = await dbGet<GameInstance[]>('games:index') ?? [];
  const game = index.find(g => g.id === id);

  if (!game) {
    return NextResponse.json(
      { error: 'Game not found' },
      { status: 404 }
    );
  }

  // Every normal game stores its data under:
  // gameId:...
  //
  // Delete every key belonging to that game.
  let gameKeys: string[] = [];

  try {
    gameKeys = await dbKeys(`${id}:*`);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Could not safely inspect the game data. The game was NOT deleted.',
      },
      { status: 500 }
    );
  }

  // Sessions are stored separately from the game namespace.
  // Delete sessions belonging to this game too.
  let sessionKeys: string[] = [];

  try {
    const allSessionKeys = await dbKeys('session:*');
    const matchingSessions: string[] = [];

    for (const key of allSessionKeys) {
      const session = await dbGet<{ gameId?: string }>(key);

      if (session?.gameId === id) {
        matchingSessions.push(key);
      }
    }

    sessionKeys = matchingSessions;
  } catch {
    sessionKeys = [];
  }

const keysToDelete = Array.from(
  new Set([
    ...gameKeys,
    ...sessionKeys,
  ])
);

  await Promise.all(
    keysToDelete.map(key => dbDel(key).catch(() => {}))
  );

  // Remove the game itself from the game index.
  const newIndex = index.filter(g => g.id !== id);
  await dbSet('games:index', newIndex);

  return NextResponse.json({
    ok: true,
    deletedGame: game,
    deletedKeys: keysToDelete.length,
  });
}
