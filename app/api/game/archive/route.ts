import { NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const archive = await dbGet<number[]>('turn:archive') ?? [];
  return NextResponse.json({ archive });
}
