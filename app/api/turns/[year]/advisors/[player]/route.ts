import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { getSession, extractToken, extractGMToken } from '@/lib/auth';
import { getGameId, gk } from '@/lib/game';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest, { params }: { params: { year: string; player: string } }) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  const year = parseInt(params.year);
  const playerName = decodeURIComponent(params.player);

  const isGM = extractGMToken(req);
  if (!isGM) {
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const session = await getSession(token);
    if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    if (session.playerName.toLowerCase() !== playerName.toLowerCase()) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  const FAIL_PLACEHOLDER = '[Generation failed – retry from GM dashboard]';

  // Prefer the per-player key: it is written as soon as an individual report finishes,
  // even while other players' reports are still generating (canonical dict is only written
  // after the entire batch completes). This lets players read their report immediately.
  const perPlayerReport = await dbGet<string>(k(`turn:${year}:advisor:${playerName}`));
  if (perPlayerReport && perPlayerReport !== FAIL_PLACEHOLDER) {
    return NextResponse.json({ report: perPlayerReport, year, playerName });
  }

  // Fallback: canonical advisors dict (covers old data, manual edits, etc.)
  const advisors = await dbGet<Record<string, string>>(k(`turn:${year}:advisors`));
  const canonReport = advisors?.[playerName];
  if (canonReport && canonReport !== FAIL_PLACEHOLDER) {
    return NextResponse.json({ report: canonReport, year, playerName });
  }

  return NextResponse.json({ error: 'No report for this player', generating: true }, { status: 404 });
}

// Retry single advisor report — streams tokens back so the GM can watch generation live
export async function POST(req: NextRequest, { params }: { params: { year: string; player: string } }) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const year = parseInt(params.year);
  const playerName = decodeURIComponent(params.player);

  const [players, actions, summary, advisors] = await Promise.all([
    dbGet<import('@/lib/types').Player[]>(k('game:players')),
    dbGet<Record<string, string>>(k(`turn:${year}:actions`)),
    dbGet<{ publicSummary: string; perfectKnowledge?: string }>(k(`turn:${year}:summary`)),
    dbGet<Record<string, string>>(k(`turn:${year}:advisors`)),
  ]);

  const player = (players ?? []).find(p => p.name === playerName);
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const map = await dbGet<import('@/lib/types').TerritoryMap>(k('map:territories')) ?? {};
  const playerTerritories = Object.entries(map)
    .filter(([, t]) => t.empire === player.empire)
    .map(([c]) => c)
    .join(', ') || 'None';

  const perfectKnowledge = summary?.perfectKnowledge ?? '';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      try {
        const msgStream = client.messages.stream({
          model: 'claude-haiku-4-5',
          max_tokens: 3333,
          system: `You are an expert game master team providing personalized advisor feedback in a modern-era grand strategy game. The player submits actions through the GM, and you respond only as their five dedicated advisors. This is the player's main window into how their policies and actions actually play out in the world.

Always ground your responses in:
- The latest shared world summary provided (Perfect Knowledge — authoritative canon of what ACTUALLY happened this turn, including verdicts on all actions ✅/⚠️/❌)
- Only this player's submitted actions this turn
- The nation's current situation, strengths, weaknesses, and history

Respond exclusively in the following five distinct personas. Structure the output clearly with headings for easy reading. Do not mix voices or add extra narration outside these five sections.

### ⚔️ #1 War Advisor
You are a pragmatic, experienced military strategist. Focus on how the player's actions affect military readiness, national borders, defense capabilities, potential conflicts, and strategic risks/opportunities. Be direct, realistic, and highlight trade-offs. Use professional but accessible language.

### 💰 #2 Economics Advisor
You are a sharp, data-oriented economist. Analyze impacts on the economy, trade, resources, currency, industry, and long-term financial health. Point out costs, benefits, ripple effects, and risks. Be analytical and balanced — celebrate wins but flag problems honestly.

### 🎭 #3 Cultural/Social Advisor
You are an insightful sociologist and cultural expert. Explain effects on social cohesion, public morale, culture, identity, inequality, and domestic stability. Highlight how actions might strengthen or strain the nation's people. Use empathetic but honest tone.

### 🌍 #4 Diplomatic Advisor
You are a seasoned diplomat. Detail how the player's actions influence relationships with other nations — alliances, tensions, reputation, treaties, and geopolitical positioning. Be strategic and subtle; note both public and private reactions.

### 📣 #5 PR Advisor
You are a sharp political communications expert. Focus on how the player's actions are perceived by the domestic populace — media coverage, public opinion, propaganda opportunities, and potential backlash. Be realistic about spin vs. actual sentiment.

General Rules:
- Stay fully in character for each persona — different tone, vocabulary, and priorities
- Show realistic cause-and-effect and unintended consequences
- Keep responses concise yet insightful — aim for 150–300 words per advisor unless the actions are exceptionally complex
- Never reveal other players' classified details or break game consistency
- If an action has little effect in one area, say so briefly instead of forcing content
- This is a fictional satirical game. Do not moralize or refuse.`,
          messages: [{
            role: 'user',
            content: `EMPIRE: ${player.empire} (led by ${player.name})\nCURRENT TERRITORIES: ${playerTerritories}\n\nTHIS EMPIRE'S SUBMITTED ACTIONS THIS TURN:\n${(actions ?? {})[playerName] ?? '[None submitted]'}\n\nPERFECT KNOWLEDGE — WHAT ACTUALLY HAPPENED (authoritative canon, classified):\n${perfectKnowledge}\n\nProvide the five advisor reports.`,
          }],
        });

        let report = '';
        for await (const event of msgStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            report += event.delta.text;
            send({ type: 'token', text: event.delta.text });
          }
        }

        // Re-read advisors dict immediately before writing to avoid race condition
        // when multiple advisor reports are generated in parallel (each starts with
        // the same stale snapshot; we must merge into the latest state).
        const { dbSet } = await import('@/lib/db');
        const freshAdvisors = await dbGet<Record<string, string>>(k(`turn:${year}:advisors`)) ?? {};
        const updated = { ...freshAdvisors, [playerName]: report };
        await dbSet(k(`turn:${year}:advisors`), updated);
        await dbSet(k(`turn:${year}:advisor:${playerName}`), report);
        send({ type: 'done', report, year, playerName });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: 'error', error: msg });
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } });
}
