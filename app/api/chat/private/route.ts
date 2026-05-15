import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { getSession, extractToken } from '@/lib/auth';
import { ChatMessage } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

function chatKey(a: string, b: string) {
  return `chat:private:${[a, b].sort().join(':')}`;
}

export async function GET(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const other = req.nextUrl.searchParams.get('other');
  if (!other) return NextResponse.json({ error: 'other param required' }, { status: 400 });

  const isGM = token === process.env.GM_PASSWORD;
  const myName = isGM ? 'Game Master' : (await getSession(token))?.playerName;
  if (!myName) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const after = parseInt(req.nextUrl.searchParams.get('after') ?? '0');
  const msgs = await dbGet<ChatMessage[]>(chatKey(myName, other)) ?? [];
  const filtered = after > 0 ? msgs.filter(m => m.timestamp > after) : msgs.slice(-100);

  if (!isGM) {
    const unread = await dbGet<Record<string, number>>(`chat:unread:${myName}`) ?? {};
    const key = `private:${other}`;
    if (unread[key]) { unread[key] = 0; await dbSet(`chat:unread:${myName}`, unread); }
  }

  return NextResponse.json({ messages: filtered });
}

export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let senderName: string;
  let senderEmpire: string;
  let senderColor: string;

  const isGM = token === process.env.GM_PASSWORD;
  if (isGM) {
    senderName = 'Game Master';
    senderEmpire = 'GM';
    senderColor = '#ffffff';
  } else {
    const session = await getSession(token);
    if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    senderName = session.playerName;
    senderEmpire = session.empireName;
    senderColor = session.color;
  }

  const { text, receiverName } = await req.json();
  if (!text?.trim() || !receiverName) return NextResponse.json({ error: 'text and receiverName required' }, { status: 400 });

  const msg: ChatMessage = {
    id: uuidv4(),
    senderName,
    empireName: senderEmpire,
    color: senderColor,
    text: text.trim(),
    timestamp: Date.now(),
  };

  const key = chatKey(senderName, receiverName);
  const msgs = await dbGet<ChatMessage[]>(key) ?? [];
  msgs.push(msg);
  await dbSet(key, msgs);

  // Increment unread for receiver
  const unread = await dbGet<Record<string, number>>(`chat:unread:${receiverName}`) ?? {};
  unread[`private:${senderName}`] = (unread[`private:${senderName}`] ?? 0) + 1;
  await dbSet(`chat:unread:${receiverName}`, unread);

  return NextResponse.json({ success: true, message: msg });
}
