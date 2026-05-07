import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbKeys } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { ChatMessage, Group } from '@/lib/types';

export async function GET(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const [publicMsgs, groups] = await Promise.all([
    dbGet<ChatMessage[]>('chat:public'),
    dbGet<Group[]>('chat:groups'),
  ]);

  // Collect private chats
  const privateKeys = await dbKeys('chat:private:*');
  const privateChats: Record<string, ChatMessage[]> = {};
  for (const key of privateKeys) {
    const msgs = await dbGet<ChatMessage[]>(key);
    if (msgs?.length) privateChats[key] = msgs;
  }

  // Collect group chats
  const groupChats: Record<string, { group: Group; messages: ChatMessage[] }> = {};
  for (const group of groups ?? []) {
    const msgs = await dbGet<ChatMessage[]>(`chat:group:${group.id}`) ?? [];
    groupChats[group.id] = { group, messages: msgs };
  }

  return NextResponse.json({
    public: publicMsgs ?? [],
    private: privateChats,
    groups: groupChats,
  });
}
