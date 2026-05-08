import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { getSession, extractToken } from '@/lib/auth';
import { Group } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const groups = await dbGet<Group[]>('chat:groups') ?? [];
  const mine = groups.filter(g => g.members.includes(session.playerName));
  return NextResponse.json({ groups: mine });
}

export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const { name, members } = await req.json();
  if (!name || !Array.isArray(members)) return NextResponse.json({ error: 'name and members required' }, { status: 400 });

  const seen = new Set<string>();
  const allMembers: string[] = [session.playerName, ...members].filter(m => { if (seen.has(m)) return false; seen.add(m); return true; });
  const group: Group = {
    id: uuidv4(),
    name,
    members: allMembers,
    createdBy: session.playerName,
    createdAt: Date.now(),
  };

  const groups = await dbGet<Group[]>('chat:groups') ?? [];
  groups.push(group);
  await dbSet('chat:groups', groups);

  return NextResponse.json({ success: true, group });
}
