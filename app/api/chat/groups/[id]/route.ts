import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { getSession, extractToken } from '@/lib/auth';
import { ChatMessage, Group } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const groups = await dbGet<Group[]>('chat:groups') ?? [];
  const group = groups.find(g => g.id === params.id);
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  if (!group.members.includes(session.playerName)) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  }

  const after = parseInt(req.nextUrl.searchParams.get('after') ?? '0');
  const msgs = await dbGet<ChatMessage[]>(`chat:group:${params.id}`) ?? [];
  const filtered = after > 0 ? msgs.filter(m => m.timestamp > after) : msgs.slice(-100);

  // Clear unread
  const unread = await dbGet<Record<string, number>>(`chat:unread:${session.playerName}`) ?? {};
  const key = `group:${params.id}`;
  if (unread[key]) {
    unread[key] = 0;
    await dbSet(`chat:unread:${session.playerName}`, unread);
  }

  return NextResponse.json({ messages: filtered, group });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const groups = await dbGet<Group[]>('chat:groups') ?? [];
  const group = groups.find(g => g.id === params.id);
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  if (!group.members.includes(session.playerName)) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  }

  const { text, invitePlayer } = await req.json();

  // Handle invite
  if (invitePlayer) {
    if (!group.members.includes(invitePlayer)) {
      group.members.push(invitePlayer);
      await dbSet('chat:groups', groups);
    }
    return NextResponse.json({ success: true, group });
  }

  if (!text?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  const msg: ChatMessage = {
    id: uuidv4(),
    senderName: session.playerName,
    empireName: session.empireName,
    color: session.color,
    text: text.trim(),
    timestamp: Date.now(),
  };

  const msgs = await dbGet<ChatMessage[]>(`chat:group:${params.id}`) ?? [];
  msgs.push(msg);
  await dbSet(`chat:group:${params.id}`, msgs);

  // Increment unread for all other members
  for (const member of group.members) {
    if (member === session.playerName) continue;
    const unread = await dbGet<Record<string, number>>(`chat:unread:${member}`) ?? {};
    unread[`group:${params.id}`] = (unread[`group:${params.id}`] ?? 0) + 1;
    await dbSet(`chat:unread:${member}`, unread);
  }

  return NextResponse.json({ success: true, message: msg });
}
