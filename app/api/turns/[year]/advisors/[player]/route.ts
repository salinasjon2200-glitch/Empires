import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { getSession, extractToken, extractGMToken } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { year: string; player: string } }) {
  const year = parseInt(params.year);
  const playerName = decodeURIComponent(params.player);

  const isGM = extractGMToken(req);
  if (!isGM) {
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const session = await getSession(token);
    if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    if (session.playerName.toLowerCase() !== playerName.toLowerCase()) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  const advisors = await dbGet<Record<string, string>>(`turn:${year}:advisors`);
  if (!advisors) return NextResponse.json({ error: 'No advisor reports for this turn' }, { status: 404 });

  const report = advisors[playerName];
  if (!report) return NextResponse.json({ error: 'No report for this player' }, { status: 404 });

  return NextResponse.json({ report, year, playerName });
}

// Retry single advisor report
export async function POST(req: NextRequest, { params }: { params: { year: string; player: string } }) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const year = parseInt(params.year);
  const playerName = decodeURIComponent(params.player);

  const [players, actions, summary, advisors] = await Promise.all([
    dbGet<import('@/lib/types').Player[]>('game:players'),
    dbGet<Record<string, string>>(`turn:${year}:actions`),
    dbGet<{ publicSummary: string }>(`turn:${year}:summary`),
    dbGet<Record<string, string>>(`turn:${year}:advisors`),
  ]);

  const player = (players ?? []).find(p => p.name === playerName);
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const map = await dbGet<import('@/lib/types').TerritoryMap>('map:territories') ?? {};
  const playerTerritories = Object.entries(map)
    .filter(([, t]) => t.empire === player.empire)
    .map(([c]) => c)
    .join(', ') || 'None';

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: `You are an expert game master team providing personalized advisor feedback. Respond as five advisors: War, Economics, Cultural/Social, Diplomatic, and PR. 150-300 words each. This is a fictional satirical grand strategy game.`,
    messages: [{
      role: 'user',
      content: `EMPIRE: ${player.empire} (${player.name})\nTERRITORIES: ${playerTerritories}\n\nWORLD SUMMARY:\n${summary?.publicSummary ?? ''}\n\nACTIONS:\n${(actions ?? {})[playerName] ?? '[None]'}`,
    }],
  });

  const report = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const updated = { ...(advisors ?? {}), [playerName]: report };
  await (await import('@/lib/db')).dbSet(`turn:${year}:advisors`, updated);

  return NextResponse.json({ report, year, playerName });
}
