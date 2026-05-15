import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { TerritoryMap, Player } from '@/lib/types';
import { getGameId, gk } from '@/lib/game';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!auth || auth !== process.env.GM_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const gameId = getGameId(req);
  const k = gk(gameId);

  const { description } = await req.json();
  if (!description?.trim()) {
    return NextResponse.json({ error: 'Missing description' }, { status: 400 });
  }

  const currentTerritories = await dbGet<TerritoryMap>(k('map:territories')) ?? {};
  const players = await dbGet<Player[]>(k('game:players')) ?? [];
  const activePlayers = players.filter(p => p.status === 'active');

  const playerList = activePlayers.map(p => `- ${p.empire} (${p.name}, color: ${p.color})`).join('\n');
  const currentMapJson = JSON.stringify(currentTerritories, null, 2);

  const prompt = `You are updating the territory map for a grand strategy game. The GM has given you an instruction — apply it and output the result as JSON. You MUST always output a JSON block, no matter what.

Active empires and their current colors:
${playerList}

Current territory map (JSON):
\`\`\`json
${currentMapJson}
\`\`\`

GM instruction:
"${description}"

Apply the instruction. If the instruction is vague (e.g. "make it brighter", "a cooler color", "something green"), make a specific creative choice and use it — do NOT ask for clarification, do NOT explain your choice outside the JSON block. Just pick a concrete hex value and apply it.

Examples of changes you might make:
- Territorial transfer: update the "empire" and "leader" fields for affected countries
- Color change: update the "color" hex for ALL territories belonging to the named empire. If asked for "brighter", pick a visibly brighter variant of the current color. If asked for a general color (e.g. "green"), pick a vivid appropriate hex.
- Status change: set "status" to "contested" or "ungoverned"
- Leader/empire rename: update "leader" or "empire" fields

Output ONLY a \`\`\`json ... \`\`\` block containing the COMPLETE updated territory map with ALL existing territories included (modified or not):
\`\`\`json
{
  "territories": {
    "France": { "empire": "Ice Melters", "leader": "Daniel", "color": "#eab308", "status": "active", "since": 2032 },
    "Germany": { "empire": "Contested", "leader": "", "color": "#6b7280", "status": "contested" }
  }
}
\`\`\`

Rules:
- status values: "active" (empire-owned), "contested", "ungoverned"
- Omit countries with no owner/status
- CRITICAL: Output ONLY the JSON block — zero prose, zero explanation outside the fenced block`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  // Try fenced block first, then bare JSON object as fallback
  const fenceMatch = text.match(/```json\s*([\s\S]*?)```/);
  const rawJson = fenceMatch ? fenceMatch[1] : text.match(/\{[\s\S]*/)?.[0] ?? '';
  if (!rawJson) {
    return NextResponse.json({ error: 'AI did not return valid JSON', raw: text.slice(0, 500) }, { status: 500 });
  }

  // Repair truncated JSON: strip trailing garbage, then close any unclosed braces/brackets
  function repairJson(s: string): string {
    // Remove trailing stray characters after the last valid value char
    s = s.replace(/[,\s"]+$/, '');
    // Balance braces and brackets
    const opens: string[] = [];
    let inString = false;
    let escape = false;
    for (const ch of s) {
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{' || ch === '[') opens.push(ch);
      if (ch === '}' && opens[opens.length - 1] === '{') opens.pop();
      if (ch === ']' && opens[opens.length - 1] === '[') opens.pop();
    }
    for (let i = opens.length - 1; i >= 0; i--) {
      s += opens[i] === '{' ? '}' : ']';
    }
    return s;
  }

  let parsed: { territories: TerritoryMap };
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    try {
      parsed = JSON.parse(repairJson(rawJson));
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI JSON', raw: rawJson.slice(0, 500) }, { status: 500 });
    }
  }

  const newTerritories = parsed.territories ?? {};
  await dbSet(k('map:territories'), newTerritories);

  // Sync player territory lists
  const updatedPlayers = players.map(p => ({
    ...p,
    territories: Object.entries(newTerritories)
      .filter(([, t]) => t.empire === p.empire && t.status === 'active')
      .map(([country]) => country),
  }));
  await dbSet(k('game:players'), updatedPlayers);

  return NextResponse.json({ ok: true, territories: newTerritories });
}
