import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';
import { extractGMToken } from '@/lib/auth';
import { getGameId, gk } from '@/lib/game';
import { Player } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export interface AlertAction {
  type: 'eliminate' | 'rename' | 'merge' | 'reset_password' | 'other';
  empire?: string;          // primary empire name (as it appears in the system)
  empires?: string[];       // for merges
  newEmpireName?: string;   // for merges / renames
  newLeaderName?: string;   // for renames / resets
  details: string;          // human-readable reason
}

export async function POST(req: NextRequest) {
  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const gameId = getGameId(req);
  const k = gk(gameId);

  const { year } = await req.json();
  const targetYear = year ?? (await dbGet<{ currentYear: number }>(k('game:state')))?.currentYear ?? 2032;

  const [summary, players] = await Promise.all([
    dbGet<{ publicSummary: string; perfectKnowledge?: string }>(k(`turn:${targetYear}:summary`)),
    dbGet<Player[]>(k('game:players')) ?? [],
  ]);

  const perfectKnowledge = summary?.perfectKnowledge ?? '';
  if (!perfectKnowledge) return NextResponse.json({ error: 'No Perfect Knowledge document found for this year' }, { status: 404 });

  const empireList = (players as Player[])
    .filter(p => p.status === 'active')
    .map(p => `- ${p.empire} (leader: ${p.name})`)
    .join('\n');

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      try {
        // ── Phase 1: Stream the analysis ──────────────────────────────────
        let fullText = '';
        const msgStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: `You are an assistant to a game master running a grand strategy game. Your job is to read the Perfect Knowledge document and identify specific GM panel actions that need to be taken. Be concrete and direct — name the exact empires and what to do. Format your response as a clear bulleted list grouped by action type.`,
          messages: [{
            role: 'user',
            content: `CURRENT ACTIVE EMPIRES IN THE SYSTEM:\n${empireList}\n\nPERFECT KNOWLEDGE — YEAR ${targetYear}:\n${perfectKnowledge}\n\nAnalyze this and list every GM action needed. Focus on these categories:\n\n**🔴 ELIMINATE** — Empires that were destroyed, collapsed, conquered, or ceased to exist this turn. List which empire to eliminate and why. IMPORTANT: Only list empires that are currently in the "Active Empires" list above.\n\n**⚔️ MERGE** — Empires that unified, formed a union, or merged governments. List which empires to merge, suggested new empire name, and recommended action weights for each leader.\n\n**✏️ RENAME** — Empires or leaders that changed their name, rebranded, or were officially renamed in the lore. List old name → new name.\n\n**🔑 RESET PASSWORD** — Only flag if a player's identity/leadership changed and their login may need updating.\n\n**⚠️ OTHER ALERTS** — Anything else the GM should act on (contested territories, ungoverned regions, unusual situations requiring GM judgment).\n\nIf there is nothing to act on in a category, write "None this turn." Be specific about which empires are involved in each action.`,
          }],
        });

        for await (const event of msgStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text;
            send({ type: 'token', text: event.delta.text });
          }
        }

        // ── Phase 2: Extract structured actions from the analysis ─────────
        send({ type: 'extracting' });

        const activeEmpireNames = (players as Player[])
          .filter(p => p.status === 'active')
          .map(p => p.empire);

        const extractionResp = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: `You extract structured GM actions from a game master analysis. Return ONLY valid JSON — no markdown, no explanation, no code fences.`,
          messages: [{
            role: 'user',
            content: `Active empires in the system: ${JSON.stringify(activeEmpireNames)}\n\nGM Analysis:\n${fullText}\n\nExtract every actionable item from this analysis as a JSON array. Each item must exactly match one of the active empire names listed above.\n\nReturn this exact format:\n{"actions":[{"type":"eliminate","empire":"ExactEmpireName","details":"brief reason"},{"type":"rename","empire":"OldExactName","newEmpireName":"NewName","newLeaderName":"NewLeaderOptional","details":"brief reason"},{"type":"merge","empires":["Empire1","Empire2"],"newEmpireName":"MergedName","details":"brief reason"},{"type":"reset_password","empire":"ExactEmpireName","newLeaderName":"NewLeaderName","details":"brief reason"},{"type":"other","empire":"ExactEmpireNameOrNull","details":"description"}]}\n\nRules:\n- Only include actions where there is something concrete to do (skip "None this turn" categories)\n- Empire names MUST exactly match the active empires list\n- If no actions detected, return {"actions":[]}\n- Return only JSON`,
          }],
        });

        let actions: AlertAction[] = [];
        try {
          const raw = extractionResp.content[0].type === 'text' ? extractionResp.content[0].text.trim() : '';
          // Strip markdown fences if model ignored instructions
          const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
          const parsed = JSON.parse(cleaned);
          actions = parsed.actions ?? [];
        } catch {
          // If parsing fails, actions stays empty — non-fatal
        }

        send({ type: 'done', actions });
      } catch (e) {
        send({ type: 'error', error: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } });
}
