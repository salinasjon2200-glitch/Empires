import { NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { TerritoryMap } from '@/lib/types';

export async function GET() {
  const territories = await dbGet<TerritoryMap>('map:territories') ?? {};
  return NextResponse.json({ territories });
}
