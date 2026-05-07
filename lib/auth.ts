import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbSet } from './db';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Support SHA-256 hashes created by the seed script
  if (hash.startsWith('$sha256$')) {
    const { createHash } = await import('crypto');
    const computed = '$sha256$' + createHash('sha256').update(password).digest('hex');
    return computed === hash;
  }
  return bcrypt.compare(password, hash);
}

export function generateToken(): string {
  return uuidv4();
}

export interface SessionData {
  token: string;
  playerName: string;
  empireName: string;
  color: string;
  createdAt: number;
}

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(playerName: string, empireName: string, color: string): Promise<string> {
  const token = generateToken();
  const session: SessionData = { token, playerName, empireName, color, createdAt: Date.now() };
  await dbSet(`session:${token}`, session);
  return token;
}

export async function getSession(token: string): Promise<SessionData | null> {
  if (!token) return null;
  const session = await dbGet<SessionData>(`session:${token}`);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL) return null;
  return session;
}

export async function deleteSession(token: string): Promise<void> {
  const { dbDel } = await import('./db');
  await dbDel(`session:${token}`);
}

export function extractToken(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export function verifyGMPassword(password: string): boolean {
  return password === process.env.GM_PASSWORD;
}

export function extractGMToken(req: Request): boolean {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return verifyGMPassword(auth.slice(7));
}
