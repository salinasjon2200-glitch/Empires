import { NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';

export async function GET() {
  const archive = await dbGet<number[]>('turn:archive') ?? [];
  return NextResponse.json({ archive });
}
