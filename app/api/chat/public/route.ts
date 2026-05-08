import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { getSession, extractToken, verifyGMPassword } from '@/lib/auth';
import { ChatMessage } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const after = parseInt(req.nextUrl.searchParams.get('after') ?? '0');
  const msgs = await dbGet<ChatMessage[]>(k('chat:public')) ?? [];
  const filtered = after > 0 ? msgs.filter(m => m.timestamp > after) : msgs.slice(-100);
  return NextResponse.json({ messages: filtered });
}

export async function POST(req: NextRequest) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const { text, sessionToken, gmPassword } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  let senderName = 'Unknown';
  let empireName = 'Unknown';
  let color = '#6b7280';
  let isGM = false;

  if (gmPassword && verifyGMPassword(gmPassword)) {
    senderName = 'Game Master';
    empireName = 'GM';
    color = '#ffffff';
    isGM = true;
  } else if (sessionToken) {
    const session = await getSession(sessionToken);
    if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    senderName = session.playerName;
    empireName = session.empireName;
    color = session.color;
  } else {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const msg: ChatMessage = { id: uuidv4(), senderName, empireName, color, text: text.trim(), timestamp: Date.now(), isGM };
  const msgs = await dbGet<ChatMessage[]>(k('chat:public')) ?? [];
  msgs.push(msg);
  if (msgs.length > 500) msgs.splice(0, msgs.length - 500);
  await dbSet(k('chat:public'), msgs);

  return NextResponse.json({ success: true, message: msg });
}
