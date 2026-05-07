/**
 * Database abstraction — uses Vercel KV when configured, falls back to JSON files in /data.
 * All reads/writes go through get/set/del/lpush/lrange/keys.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeKey(key: string): string {
  // Replace chars not safe for Windows filenames (colons, forward/backslashes, etc.)
  return key.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function filePath(key: string): string {
  return path.join(DATA_DIR, safeKey(key) + '.json');
}

// ─── KV detection ───────────────────────────────────────────────────────────
function hasKV(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// ─── KV client (lazy import) ─────────────────────────────────────────────────
let _kv: typeof import('@vercel/kv').kv | null = null;
async function kv() {
  if (!_kv) {
    const mod = await import('@vercel/kv');
    _kv = mod.kv;
  }
  return _kv!;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function dbGet<T>(key: string): Promise<T | null> {
  if (hasKV()) {
    const client = await kv();
    return client.get<T>(key);
  }
  ensureDataDir();
  const fp = filePath(key);
  if (!fs.existsSync(fp)) return null;
  try {
    const raw = fs.readFileSync(fp, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function dbSet(key: string, value: unknown): Promise<void> {
  if (hasKV()) {
    const client = await kv();
    await client.set(key, value);
    return;
  }
  ensureDataDir();
  fs.writeFileSync(filePath(key), JSON.stringify(value, null, 2), 'utf-8');
}

export async function dbDel(key: string): Promise<void> {
  if (hasKV()) {
    const client = await kv();
    await client.del(key);
    return;
  }
  const fp = filePath(key);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

// List operations (stored as JSON arrays in file fallback)
export async function dbLPush(key: string, ...values: unknown[]): Promise<void> {
  if (hasKV()) {
    const client = await kv();
    for (const v of values) await client.lpush(key, v as string);
    return;
  }
  const current = await dbGet<unknown[]>(key) ?? [];
  await dbSet(key, [...values.reverse(), ...current]);
}

export async function dbRPush(key: string, ...values: unknown[]): Promise<void> {
  if (hasKV()) {
    const client = await kv();
    for (const v of values) await client.rpush(key, v as string);
    return;
  }
  const current = await dbGet<unknown[]>(key) ?? [];
  await dbSet(key, [...current, ...values]);
}

export async function dbLRange<T>(key: string, start: number, end: number): Promise<T[]> {
  if (hasKV()) {
    const client = await kv();
    return client.lrange<T>(key, start, end);
  }
  const all = await dbGet<T[]>(key) ?? [];
  if (end === -1) return all.slice(start);
  return all.slice(start, end + 1);
}

export async function dbLLen(key: string): Promise<number> {
  if (hasKV()) {
    const client = await kv();
    return client.llen(key);
  }
  const all = await dbGet<unknown[]>(key) ?? [];
  return all.length;
}

// Trim list to max N items (keep newest = end of list)
export async function dbLTrim(key: string, maxLen: number): Promise<void> {
  if (hasKV()) {
    const client = await kv();
    await client.ltrim(key, -maxLen, -1);
    return;
  }
  const all = await dbGet<unknown[]>(key) ?? [];
  if (all.length > maxLen) await dbSet(key, all.slice(-maxLen));
}

export async function dbKeys(pattern: string): Promise<string[]> {
  if (hasKV()) {
    const client = await kv();
    return client.keys(pattern);
  }
  ensureDataDir();
  const files = fs.readdirSync(DATA_DIR);
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '\\.json$');
  return files
    .filter(f => regex.test(f))
    .map(f => f.replace(/\.json$/, '').replace(/_/g, (m, i, s) => {
      // rough reverse of safeKey — good enough for file-based dev
      return m;
    }));
}
