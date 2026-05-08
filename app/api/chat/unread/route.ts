import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { getSession, extractToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const unread = await dbGet<Record<string, number>>(`chat:unread:${session.playerName}`) ?? {};
  const total = Object.values(unread).reduce((a, b) => a + b, 0);
  return NextResponse.json({ unread, total });
}
