import { NextRequest, NextResponse } from 'next/server';
import { verifyGMPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!verifyGMPassword(password)) {
      return NextResponse.json({ error: 'Invalid GM password' }, { status: 401 });
    }
    return NextResponse.json({ gmToken: process.env.GM_PASSWORD });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
