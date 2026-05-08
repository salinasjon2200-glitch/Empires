import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { year: string } }) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const year = parseInt(params.year);
  const summary = await dbGet<{ publicSummary: string; perfectKnowledge: string }>(`turn:${year}:summary`);
  if (!summary?.perfectKnowledge) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ perfectKnowledge: summary.perfectKnowledge, year });
}
