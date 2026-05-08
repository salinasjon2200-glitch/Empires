import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function hasKV(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvCmd(command: unknown[]): Promise<unknown> {
  const url = process.env.KV_REST_API_URL!;
  const token = process.env.KV_REST_API_TOKEN!;
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([command]),
    cache: 'no-store' as RequestCache,
  });
  if (!res.ok) throw new Error(`KV error: ${res.status}`);
  const data = await res.json() as Array<{ result: unknown; error?: string }>;
  if (data[0]?.error) throw new Error(`KV command error: ${data[0].error}`);
  return data[0]?.result ?? null;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function filePath(key: string): string {
  return path.join(DATA_DIR, safeKey(key) + '.json');
}

export async function dbGet<T>(key: string): Promise<T | null> {
  if (hasKV()) {
    const result = await kvCmd(['GET', key]) as string | null;
    if (result === null) return null;
    try { return JSON.parse(result) as T; } catch { return result as unknown as T; }
  }
  ensureDataDir();
  const fp = filePath(key);
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')) as T; } catch { return null; }
}

export async function dbSet(key: string, value: unknown): Promise<void> {
  if (hasKV()) {
    await kvCmd(['SET', key, JSON.stringify(value)]);
    return;
  }
  ensureDataDir();
  fs.writeFileSync(filePath(key), JSON.stringify(value, null, 2), 'utf-8');
}

export async function dbDel(key: string): Promise<void> {
  if (hasKV()) {
    await kvCmd(['DEL', key]);
    return;
  }
  const fp = filePath(key);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// List operations — stored as JSON arrays via GET/SET for consistency across KV and file modes
export async function dbLPush(key: string, ...values: unknown[]): Promise<void> {
  const current = await dbGet<unknown[]>(key) ?? [];
  await dbSet(key, [...values.reverse(), ...current]);
}

export async function dbRPush(key: string, ...values: unknown[]): Promise<void> {
  const current = await dbGet<unknown[]>(key) ?? [];
  await dbSet(key, [...current, ...values]);
}

export async function dbLRange<T>(key: string, start: number, end: number): Promise<T[]> {
  const all = await dbGet<T[]>(key) ?? [];
  if (end === -1) return all.slice(start);
  return all.slice(start, end + 1);
}

export async function dbLLen(key: string): Promise<number> {
  const all = await dbGet<unknown[]>(key) ?? [];
  return all.length;
}

export async function dbLTrim(key: string, maxLen: number): Promise<void> {
  const all = await dbGet<unknown[]>(key) ?? [];
  if (all.length > maxLen) await dbSet(key, all.slice(-maxLen));
}

export async function dbKeys(pattern: string): Promise<string[]> {
  if (hasKV()) {
    return (await kvCmd(['KEYS', pattern]) as string[]) ?? [];
  }
  ensureDataDir();
  const files = fs.readdirSync(DATA_DIR);
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '\\.json$');
  return files
    .filter(f => regex.test(f))
    .map(f => f.replace(/\.json$/, ''));
}
