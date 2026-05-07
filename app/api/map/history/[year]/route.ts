import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { TerritoryMap } from '@/lib/types';

export async function GET(_req: NextRequest, { params }: { params: { year: string } }) {
  const year = parseInt(params.year);
  const territories = await dbGet<TerritoryMap>(`map:history:${year}`);
  if (!territories) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ territories, year });
}
