import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { year: string } }) {
  const year = parseInt(params.year);
  if (isNaN(year)) return NextResponse.json({ error: 'Invalid year' }, { status: 400 });

  const summary = await dbGet<{ publicSummary: string; perfectKnowledge?: string }>(`turn:${year}:summary`);
  if (!summary) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ publicSummary: summary.publicSummary, year });
}
