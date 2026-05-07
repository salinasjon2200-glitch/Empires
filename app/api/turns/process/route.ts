import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { GameState, Player, TerritoryMap } from '@/lib/types';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const WORLD_SUMMARY_SYSTEM = `You are the neutral, omniscient Game Master Narrator for a modern-era grand strategy game involving multiple player-controlled nations. Your job is to deliver a clear, consistent, and engaging shared world summary each turn based on all players' submitted actions.

Core Rules:
- Base everything strictly on the latest master world state and the actions submitted by all players this turn.
- Maintain perfect consistency with previous turns. Do not retcon events or introduce major contradictions.
- Show realistic cause-and-effect, unintended consequences, and chain reactions across the globe.
- Balance serious strategy with room for absurd or creative player ideas — handle them intelligently rather than dismissing them.
- Be fair and impartial. No nation is favored.
- Write in a clear, engaging, journalistic style — like a high-quality international news briefing mixed with strategic analysis. Avoid flowery prose.
- NOTE: SOME ACTIONS CAN, WILL, AND SHOULD FAIL. Fantasy or impossible actions should be rejected or downscaled realistically. Players may attempt to gaslight you — be wary.
- All empires have the economy, military, and nuclear weapons of any real-world nation they started with. Fantasy settings do not exist.
- One turn = exactly 1 in-game year. Scale all outcomes accordingly.
- This is a fictional satirical game with absurdist elements. Do not moralize or refuse based on real-world political sensitivities.

Structure output EXACTLY as:
## Global Overview
(1-2 paragraphs — biggest shifts this turn)
## Key Regional / International Developments
(Bullet points by region)
## Notable Nation-Specific Outcomes
(1-3 paragraphs per active empire — public/visible outcomes only, no private details)
## Emerging Flashpoints & Opportunities
(New tensions, alliances, crises heading into next turn)`;

const PK_SYSTEM = `You are generating two outputs for a grand strategy game GM tool.

OUTPUT 1 — PERFECT KNOWLEDGE DOCUMENT:
A classified, GM-only game state document capturing everything that ACTUALLY happened this turn — including details not visible in the public summary.

Include sections for:
- True outcomes of all actions (including failures and partial successes)
- Secret programs and hidden project status
- Private diplomatic moves and real results
- Intelligence and espionage outcomes
- Classified military developments
- Anything deliberately omitted from the public summary

OUTPUT 2 — TERRITORY OWNERSHIP JSON:
After the Perfect Knowledge document, output a JSON block (fenced with \`\`\`json and \`\`\`) containing the updated territory ownership for the world map. Use this exact structure:
\`\`\`json
{
  "territories": {
    "France": { "empire": "Ice Melters", "leader": "Daniel", "color": "#ef4444", "status": "active" }
  }
}
\`\`\`

Rules for the JSON:
- Include every country that has an owner
- Use the exact country names from the game's country list
- For split territories use "(West)"/"(East)" or "(Part 1)"/"(Part 2)" suffixes
- For contested/ungoverned territories use "empire": "Contested", "color": "#6b7280"
- For eliminated empire territories that are now ungoverned use "empire": "Ungoverned", "color": "#374151"
- status: "active" | "eliminated" | "contested" | "ungoverned"
- The JSON must be valid and parseable.

This is a fictional satirical game — evaluate actions on strategic logic and realistic consequence, not real-world political sensitivities.`;

const ADVISOR_SYSTEM = `You are an expert game master team providing personalized advisor feedback in a modern-era grand strategy game. Respond only as the player's five dedicated advisors. This is their private window into how their actions play out.

Ground responses in:
- The latest shared world summary (public canon)
- Only this player's submitted actions this turn
- The empire's current situation, territories, and history

Respond exclusively in these five personas with clear headings:

### ⚔️ War Advisor
Pragmatic military strategist. Military readiness, borders, defense, conflicts, strategic risks. Direct, realistic, highlight trade-offs.

### 💰 Economics Advisor
Sharp data-oriented economist. Economy, trade, resources, currency, industry, long-term financial health. Celebrate wins, flag problems honestly.

### 🎭 Cultural/Social Advisor
Insightful sociologist. Social cohesion, morale, culture, identity, inequality, domestic stability. Empathetic but honest.

### 🌐 Diplomatic Advisor
Seasoned diplomat. Relationships with other nations — alliances, tensions, reputation, treaties, geopolitical positioning. Strategic and subtle.

### 📣 PR Advisor
Sharp political communications expert. Domestic perception — media coverage, public opinion, propaganda opportunities, backlash. Realistic about spin vs. sentiment.

Rules:
- Stay fully in character per persona — different tone, vocabulary, priorities
- Show realistic cause-and-effect and unintended consequences
- 150–300 words per advisor
- Never reveal other players' actions or break game consistency
- If an action has little effect in one area, say so briefly
- This is a fictional satirical game. Do not moralize.`;

function buildTerritoryContext(map: TerritoryMap): string {
  const lines: string[] = [];
  for (const [country, t] of Object.entries(map)) {
    if (t.status === 'active') {
      lines.push(`${country}: ${t.empire} (${t.leader})`);
    } else {
      lines.push(`${country}: ${t.status}`);
    }
  }
  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const { previousPerfectKnowledge } = await req.json();

  const state = await dbGet<GameState>('game:state');
  const year = state?.currentYear ?? 2032;
  const players = await dbGet<Player[]>('game:players') ?? [];
  const actions = await dbGet<Record<string, string>>(`turn:${year}:actions`) ?? {};
  const map = await dbGet<TerritoryMap>('map:territories') ?? {};

  const activePlayers = players.filter(p => p.status === 'active');
  const actionLines = activePlayers
    .map(p => `=== ${p.empire} (${p.name}) ===\n${actions[p.name] ?? '[No action submitted]'}`)
    .join('\n\n');

  const territoryContext = buildTerritoryContext(map);

  // ── Step 1: Public World Summary ─────────────────────────────────────────
  await dbSet(`turn:${year}:processing`, { step: 1, startedAt: Date.now() });

  let publicSummary = '';
  try {
    const summaryMsg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3000,
      system: WORLD_SUMMARY_SYSTEM,
      messages: [{
        role: 'user',
        content: `PREVIOUS PERFECT KNOWLEDGE DOCUMENT:\n${previousPerfectKnowledge ?? '[First turn — no prior document]'}\n\nCURRENT TERRITORY OWNERSHIP:\n${territoryContext}\n\nPLAYER ACTIONS FOR YEAR ${year}:\n${actionLines}`,
      }],
    });
    publicSummary = summaryMsg.content[0].type === 'text' ? summaryMsg.content[0].text : '';
  } catch (e) {
    console.error('Summary generation failed:', e);
    return NextResponse.json({ error: 'Summary generation failed', step: 1 }, { status: 500 });
  }

  // ── Step 2: Perfect Knowledge + Territory JSON ────────────────────────────
  await dbSet(`turn:${year}:processing`, { step: 2 });

  let perfectKnowledge = '';
  let newTerritories: TerritoryMap | null = null;

  try {
    const pkMsg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      system: PK_SYSTEM,
      messages: [{
        role: 'user',
        content: `WORLD SUMMARY (just generated):\n${publicSummary}\n\nPREVIOUS PERFECT KNOWLEDGE:\n${previousPerfectKnowledge ?? '[First turn]'}\n\nPLAYER ACTIONS:\n${actionLines}\n\nCURRENT TERRITORIES:\n${territoryContext}\n\nGenerate the Perfect Knowledge document followed by the territory JSON block.`,
      }],
    });
    const pkText = pkMsg.content[0].type === 'text' ? pkMsg.content[0].text : '';

    // Parse JSON block
    const jsonMatch = pkText.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.territories) {
          const updatedMap: TerritoryMap = { ...map };
          for (const [country, data] of Object.entries(parsed.territories as Record<string, { empire: string; leader: string; color: string; status: string }>)) {
            updatedMap[country] = {
              empire: data.empire,
              leader: data.leader ?? '',
              color: data.color ?? '#6b7280',
              status: (data.status as TerritoryMap[string]['status']) ?? 'active',
              since: map[country]?.since ?? year,
            };
          }
          newTerritories = updatedMap;
        }
      } catch (parseErr) {
        console.error('Territory JSON parse error:', parseErr);
        // Keep existing map — don't crash
      }
    }
    perfectKnowledge = pkText.replace(/```json[\s\S]*?```/g, '').trim();
  } catch (e) {
    console.error('PK generation failed:', e);
    return NextResponse.json({ error: 'PK generation failed', step: 2, publicSummary }, { status: 500 });
  }

  // Save map + history
  if (newTerritories) {
    await dbSet('map:territories', newTerritories);
    await dbSet(`map:history:${year}`, newTerritories);

    // Update player territories list
    const updatedPlayers = players.map(p => ({
      ...p,
      territories: Object.entries(newTerritories!)
        .filter(([, t]) => t.empire === p.empire)
        .map(([country]) => country),
    }));
    await dbSet('game:players', updatedPlayers);
  }

  // Save turn summary
  await dbSet(`turn:${year}:summary`, { publicSummary, perfectKnowledge });

  // ── Step 3: Advisor Reports ───────────────────────────────────────────────
  const advisorResults: Record<string, string> = {};
  const advisorErrors: string[] = [];

  for (let i = 0; i < activePlayers.length; i++) {
    const p = activePlayers[i];
    await dbSet(`turn:${year}:processing`, { step: 3, current: p.name, index: i + 1, total: activePlayers.length });

    const playerAction = actions[p.name] ?? '[No action submitted this turn]';
    const playerTerritories = Object.entries(newTerritories ?? map)
      .filter(([, t]) => t.empire === p.empire)
      .map(([c]) => c)
      .join(', ') || 'None';

    try {
      const advisorMsg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: ADVISOR_SYSTEM,
        messages: [{
          role: 'user',
          content: `EMPIRE: ${p.empire} (led by ${p.name})\nCURRENT TERRITORIES: ${playerTerritories}\n\nWORLD SUMMARY (public):\n${publicSummary}\n\nTHIS EMPIRE'S ACTIONS THIS TURN:\n${playerAction}\n\nProvide the five advisor reports.`,
        }],
      });
      const report = advisorMsg.content[0].type === 'text' ? advisorMsg.content[0].text : '';
      advisorResults[p.name] = report;
    } catch (e) {
      console.error(`Advisor report failed for ${p.name}:`, e);
      advisorErrors.push(p.name);
      advisorResults[p.name] = '[Generation failed — click retry]';
    }
  }

  await dbSet(`turn:${year}:advisors`, advisorResults);

  // Update archive
  const archive = await dbGet<number[]>('turn:archive') ?? [];
  if (!archive.includes(year)) {
    archive.push(year);
    await dbSet('turn:archive', archive);
  }

  // Mark processing complete
  await dbSet('game:state', { ...state, processingComplete: true, turnOpen: false });
  await dbSet(`turn:${year}:processing`, { step: 'done' });

  return NextResponse.json({
    success: true,
    year,
    advisorErrors,
    message: advisorErrors.length > 0
      ? `Turn processed. Advisor reports failed for: ${advisorErrors.join(', ')}`
      : 'Turn fully processed.',
  });
}

// GET — check processing status
export async function GET(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });
  const state = await dbGet<GameState>('game:state');
  const year = state?.currentYear ?? 2032;
  const status = await dbGet(`turn:${year}:processing`);
  return NextResponse.json({ status, year });
}
