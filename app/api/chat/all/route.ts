import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet, dbDel, dbKeys } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { ChatMessage, Group } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const [publicMsgs, groups] = await Promise.all([
    dbGet<ChatMessage[]>(k('chat:public')),
    dbGet<Group[]>(k('chat:groups')),
  ]);

  // Collect private chats
  const privateKeys = await dbKeys(k('chat:private:*'));
  const privateChats: Record<string, ChatMessage[]> = {};
  for (const key of privateKeys) {
    const msgs = await dbGet<ChatMessage[]>(key);
    if (msgs?.length) privateChats[key] = msgs;
  }

  // Collect group chats
  const groupChats: Record<string, { group: Group; messages: ChatMessage[] }> = {};
  for (const group of groups ?? []) {
    const msgs = await dbGet<ChatMessage[]>(k(`chat:group:${group.id}`)) ?? [];
    groupChats[group.id] = { group, messages: msgs };
  }

  return NextResponse.json({
    public: publicMsgs ?? [],
    private: privateChats,
    groups: groupChats,
  });
}

// GM: delete a specific chat channel or a single message
// Body: { target: 'public' | 'private:<key>' | 'group:<id>', messageId?: string }
// If messageId is provided, only that message is removed; otherwise the whole channel is cleared.
export async function DELETE(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);
  const { target, messageId } = await req.json();

  async function deleteFromKey(redisKey: string) {
    if (messageId) {
      const msgs = await dbGet<ChatMessage[]>(redisKey) ?? [];
      await dbSet(redisKey, msgs.filter(m => m.id !== messageId));
    } else {
      await dbSet(redisKey, []);
    }
  }

  if (target === 'public') {
    await deleteFromKey(k('chat:public'));
  } else if (typeof target === 'string' && target.startsWith('private:')) {
    // target = 'private:chat:private:Alice:Bob'
    const redisKey = target.slice('private:'.length);
    await deleteFromKey(redisKey);
  } else if (typeof target === 'string' && target.startsWith('group:')) {
    const groupId = target.slice('group:'.length);
    await deleteFromKey(k(`chat:group:${groupId}`));
  } else {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
