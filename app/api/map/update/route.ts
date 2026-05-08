import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { TerritoryMap, Player } from '@/lib/types';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!auth || auth !== process.env.GM_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { description } = await req.json();
  if (!description?.trim()) {
    return NextResponse.json({ error: 'Missing description' }, { status: 400 });
  }

  const currentTerritories = await dbGet<TerritoryMap>('map:territories') ?? {};
  const players = await dbGet<Player[]>('game:players') ?? [];
  const activePlayers = players.filter(p => p.status === 'active');

  const playerList = activePlayers.map(p => `- ${p.empire} (${p.name}, color: ${p.color})`).join('\n');
  const currentMapJson = JSON.stringify(currentTerritories, null, 2);

  const prompt = `You are updating the territory map for a grand strategy game.

Active empires:
${playerList}

Current territory map:
\`\`\`json
${currentMapJson}
\`\`\`

The GM has described the following territorial changes:
"${description}"

Output ONLY a JSON block (fenced with \`\`\`json and \`\`\`) containing the COMPLETE updated territory map. Include all existing territories with any changes applied. Use this exact structure:
\`\`\`json
{
  "territories": {
    "France": { "empire": "Ice Melters", "leader": "Daniel", "color": "#eab308", "status": "active", "since": 2032 },
    "Germany": { "empire": "Contested", "leader": "", "color": "#6b7280", "status": "contested" }
  }
}
\`\`\`

Status values: "active" (owned by empire), "contested", "ungoverned". Omit countries with no owner.
Use the exact empire colors listed above. Do not add commentary outside the JSON block.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    return NextResponse.json({ error: 'AI did not return valid JSON', raw: text }, { status: 500 });
  }

  let parsed: { territories: TerritoryMap };
  try {
    parsed = JSON.parse(jsonMatch[1]);
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI JSON', raw: jsonMatch[1] }, { status: 500 });
  }

  const newTerritories = parsed.territories ?? {};
  await dbSet('map:territories', newTerritories);

  // Sync player territory lists
  const updatedPlayers = players.map(p => ({
    ...p,
    territories: Object.entries(newTerritories)
      .filter(([, t]) => t.empire === p.empire && t.status === 'active')
      .map(([country]) => country),
  }));
  await dbSet('game:players', updatedPlayers);

  return NextResponse.json({ ok: true, territories: newTerritories });
}
