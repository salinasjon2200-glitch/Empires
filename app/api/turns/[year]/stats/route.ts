import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbSet } from '@/lib/db';
import { extractGMToken, getSession, extractToken } from '@/lib/auth';
import { getGameId, gk } from '@/lib/game';
import Anthropic from '@anthropic-ai/sdk';
import {
  Player,
  TerritoryMap,
  EmpireStats,
  AllEmpireStats,
} from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── System prompt ─────────────────────────────────────────────────────────────

const STATS_SYSTEM = `You are a classified intelligence analyst for a grand strategy game set in the modern era. Your job is to produce a precise, structured statistics sheet for an empire, grounded in realism.

OUTPUT FORMAT — respond with ONLY a JSON object (no markdown fences, no preamble). Use exactly these fields:

{
  "gdp": <number — billions USD>,
  "gdpPerCapita": <number — thousands USD per person>,
  "areaSqMiles": <number — total controlled territory in thousands of square miles>,
  "population": <number — millions>,
  "birthRate": <number — per 1000 per year>,
  "stockMarket": <"Bust"|"Bear"|"Moderate"|"Bull"|"Boom">,
  "inflationRate": <number — percent>,
  "socialCohesion": <"Fractured"|"Strained"|"Moderate"|"United"|"Cohesive">,
  "publicApproval": <number 0–100>,
  "governmentType": <"Democracy"|"Republic"|"Constitutional Monarchy"|"Absolute Monarchy"|"Military Junta"|"Single-Party State"|"Theocracy"|"Oligarchy"|"Federal Republic"|"Technocracy"|"Anarchy">,
  "debt": <number — billions USD>,
  "revenue": <number — billions USD per year>,
  "spending": <number — billions USD per year>,
  "interestRate": <number — percent>,
  "technologyYears": <number — years ahead (+) or behind (–) global average>,
  "tradeDeficit": <number — billions USD, negative = surplus>,
  "military": {
    "infantry": <number — thousands of personnel>,
    "armor": <number — armored vehicles and tanks>,
    "artillery": <number — artillery pieces>,
    "fighters": <number — combat aircraft>,
    "bombers": <number — bomber aircraft>,
    "antiAir": <number — anti-air batteries>,
    "navy": <number — major surface vessels>,
    "nukes": <number>,
    "missiles": <number — strategic missiles>,
    "antiMissiles": <number — anti-missile batteries>
  },
  "militaryTech": {
    "infantry": <number — years relative to 2025 baseline, can be negative>,
    "armor": <number>,
    "artillery": <number>,
    "fighters": <number>,
    "bombers": <number>,
    "antiAir": <number>,
    "navy": <number>,
    "nukes": <number>,
    "missiles": <number>,
    "antiMissiles": <number>
  },
  "intelligence": <"Blind"|"Weak"|"Moderate"|"Strong"|"Elite">,
  "trainingLevel": <"Untrained"|"Basic"|"Regular"|"Veteran"|"Elite">,
  "militarySupply": <"Starved"|"Depleted"|"Sustained"|"Well-supplied"|"Abundant">,
  "tradeSurplus": <number — billions USD, positive = surplus, negative = deficit>,
  "spaceProgram": <string — brief description or "None">,
  "gmNotes": <string — brief analyst reasoning, 1–3 sentences>
}

RULES:
- Base stats on the ACTUAL territories this empire controls (their real-world economic/military weight)
- Military tech levels: 0 = 2025 world-average technology. +10 = ten years ahead. –5 = five years behind.
- Reflect changes described in the Perfect Knowledge document — victories, defeats, economic events all shift stats
- Be realistic and proportional — a small nation cannot have US-level GDP; a nuclear state cannot suddenly gain 500 nukes
- If an action was DENIED or PARTIAL per the PK verdicts, reflect the failure in stats
- Produce only the JSON object. No extra text.`;

// ── Helper: load previous stats for a given empire ────────────────────────────

async function loadPrevStats(
  archive: number[],
  beforeYear: number,
  empire: string,
  k: (key: string) => string,
): Promise<EmpireStats | null> {
  const pastYears = archive.filter(y => y < beforeYear).sort((a, b) => b - a);
  for (const y of pastYears) {
    const all = await dbGet<AllEmpireStats>(k(`turn:${y}:stats`));
    if (all?.[empire]) return all[empire];
  }
  return null;
}

// ── Helper: get controlled territories for an empire ─────────────────────────

function getEmpireTerritories(map: TerritoryMap, empire: string): string[] {
  return Object.entries(map)
    .filter(([, t]) => t.empire === empire && t.status === 'active')
    .map(([country]) => country);
}

// ── Generate stats for one empire (streaming to controller) ──────────────────

async function generateStatsForEmpire(
  player: Player,
  pk: string,
  prevStats: EmpireStats | null,
  territories: string[],
  year: number,
  isInitial: boolean,
  send: (obj: object) => void,
): Promise<EmpireStats | null> {
  const empireCtx = `EMPIRE: ${player.empire} (leader: ${player.name})
CONTROLLED TERRITORIES: ${territories.length > 0 ? territories.join(', ') : 'None'}`;

  const prevCtx = prevStats
    ? `PREVIOUS YEAR STATISTICS (Year ${prevStats.generatedYear}):\n${JSON.stringify(prevStats, null, 2)}`
    : 'PREVIOUS YEAR STATISTICS: None (this is the initial generation)';

  const pkSection = pk
    ? `PERFECT KNOWLEDGE DOCUMENT (what actually happened this year):\n${pk}`
    : `PERFECT KNOWLEDGE DOCUMENT: None — this is a starting-position generation based purely on controlled territories. Generate realistic baseline stats for an empire holding these territories at the game start.`;

  const userContent = `GAME YEAR: ${year} (the in-game calendar year is ${year}; all stats must reflect the state of this empire as of the year ${year})

${empireCtx}

${prevCtx}

${pkSection}

Generate the empire statistics JSON for Year ${year}. The year is ${year} — make sure all figures, technology levels, and narrative references are appropriate for ${year}, not any earlier year.`;

  try {
    let rawJson = '';

    if (isInitial && !prevStats) {
      // Web-search path: use real-world 2025 data as baseline
      const resp = await (client.beta.messages as unknown as {
        create: (params: object) => Promise<{ content: Array<{ type: string; text?: string }> }>;
      }).create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        betas: ['web-search-2025-03-05'],
        system: STATS_SYSTEM,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
        messages: [{
          role: 'user',
          content: `${userContent}

IMPORTANT: This is the FIRST time generating stats for this empire. Search the web for current (2025) real-world economic and military data for the territories this empire controls. Use that as the starting baseline, then apply any changes from this year's Perfect Knowledge document.`,
        }],
      });
      // Extract text blocks from response
      for (const block of resp.content) {
        if (block.type === 'text' && block.text) rawJson += block.text;
      }
    } else {
      // Standard update path
      const msgStream = client.messages.stream({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: STATS_SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      });

      for await (const event of msgStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          rawJson += event.delta.text;
          send({ type: 'token', empire: player.empire, text: event.delta.text });
        }
      }
    }

    // Parse JSON — strip markdown fences, then extract the { } block from any surrounding prose
    let jsonStr = rawJson.replace(/```(?:json)?\n?/g, '').replace(/\n?```/g, '').trim();
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
    const parsed = JSON.parse(jsonStr);

    const stats: EmpireStats = {
      empire: player.empire,
      generatedYear: year,
      generatedAt: Date.now(),
      isInitial,
      gdp: parsed.gdp ?? 0,
      gdpPerCapita: parsed.gdpPerCapita ?? 0,
      areaSqMiles: parsed.areaSqMiles ?? 0,
      population: parsed.population ?? 0,
      birthRate: parsed.birthRate ?? 0,
      stockMarket: parsed.stockMarket ?? 'Moderate',
      inflationRate: parsed.inflationRate ?? 0,
      socialCohesion: parsed.socialCohesion ?? 'Moderate',
      publicApproval: parsed.publicApproval ?? 50,
      governmentType: parsed.governmentType ?? 'Republic',
      debt: parsed.debt ?? 0,
      revenue: parsed.revenue ?? 0,
      spending: parsed.spending ?? 0,
      interestRate: parsed.interestRate ?? 0,
      technologyYears: parsed.technologyYears ?? 0,
      tradeDeficit: parsed.tradeDeficit ?? 0,
      tradeSurplus: parsed.tradeSurplus ?? 0,
      military: {
        infantry: parsed.military?.infantry ?? 0,
        armor: parsed.military?.armor ?? 0,
        artillery: parsed.military?.artillery ?? 0,
        fighters: parsed.military?.fighters ?? 0,
        bombers: parsed.military?.bombers ?? 0,
        antiAir: parsed.military?.antiAir ?? 0,
        navy: parsed.military?.navy ?? 0,
        nukes: parsed.military?.nukes ?? 0,
        missiles: parsed.military?.missiles ?? 0,
        antiMissiles: parsed.military?.antiMissiles ?? 0,
      },
      militaryTech: {
        infantry: parsed.militaryTech?.infantry ?? 0,
        armor: parsed.militaryTech?.armor ?? 0,
        artillery: parsed.militaryTech?.artillery ?? 0,
        fighters: parsed.militaryTech?.fighters ?? 0,
        bombers: parsed.militaryTech?.bombers ?? 0,
        antiAir: parsed.militaryTech?.antiAir ?? 0,
        navy: parsed.militaryTech?.navy ?? 0,
        nukes: parsed.militaryTech?.nukes ?? 0,
        missiles: parsed.militaryTech?.missiles ?? 0,
        antiMissiles: parsed.militaryTech?.antiMissiles ?? 0,
      },
      intelligence: parsed.intelligence ?? 'Moderate',
      trainingLevel: parsed.trainingLevel ?? 'Regular',
      militarySupply: parsed.militarySupply ?? 'Sustained',
      spaceProgram: parsed.spaceProgram ?? 'None',
      gmNotes: parsed.gmNotes ?? '',
    };

    return stats;
  } catch (e) {
    send({ type: 'empire_error', empire: player.empire, error: String(e) });
    return null;
  }
}

// ── GET — read stats (GM = all empires; player = own empire only) ─────────────

export async function GET(req: NextRequest, { params }: { params: { year: string } }) {
  const gameId = getGameId(req);
  const k = gk(gameId);
  const year = parseInt(params.year);

  const isGM = extractGMToken(req);
  if (!isGM) {
    const token = extractToken(req);
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const session = await getSession(token);
    if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const all = await dbGet<AllEmpireStats>(k(`turn:${year}:stats`));
    if (!all) return NextResponse.json({ error: 'No stats for this year', generating: true }, { status: 404 });

    // Find the player's empire
    const players = await dbGet<Player[]>(k('game:players')) ?? [];
    const player = players.find(p => p.name === session.playerName);
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const stats = all[player.empire];
    if (!stats) return NextResponse.json({ error: 'No stats for your empire', generating: true }, { status: 404 });

    // Strip GM notes before returning to player
    const { gmNotes: _gmNotes, ...publicStats } = stats;
    return NextResponse.json({ stats: publicStats, year });
  }

  // GM: return all
  const all = await dbGet<AllEmpireStats>(k(`turn:${year}:stats`));
  if (!all) return NextResponse.json({ error: 'No stats for this year' }, { status: 404 });
  return NextResponse.json({ stats: all, year });
}

// ── POST — generate stats (GM only, streaming) ────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: { year: string } }) {
  const gameId = getGameId(req);
  const k = gk(gameId);

  if (!extractGMToken(req)) return NextResponse.json({ error: 'GM auth required' }, { status: 401 });

  const year = parseInt(params.year);
  const body = await req.json().catch(() => ({}));
  const skipExisting: boolean = body.skipExisting ?? false;
  const forceInitial: boolean = body.forceInitial ?? false; // force web-search mode

  const [players, summary, map, archive] = await Promise.all([
    dbGet<Player[]>(k('game:players')) ?? Promise.resolve([] as Player[]),
    dbGet<{ perfectKnowledge?: string }>(k(`turn:${year}:summary`)),
    dbGet<TerritoryMap>(k('map:territories')) ?? Promise.resolve({} as TerritoryMap),
    dbGet<number[]>(k('turn:archive')) ?? Promise.resolve([] as number[]),
  ]);

  const playerList = (players ?? []) as Player[];
  const mapData = (map ?? {}) as TerritoryMap;
  const archiveList = (archive ?? []) as number[];
  // PK is optional — if absent (e.g. post-bidding before any turn is processed),
  // stats are generated purely from territory data and real-world baselines.
  const pk = summary?.perfectKnowledge ?? '';

  const activePlayers = playerList.filter(p => p.status === 'active');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      try {
        // Load existing stats dict (to skip or merge)
        const existingStats = await dbGet<AllEmpireStats>(k(`turn:${year}:stats`)) ?? {};

        // Determine if this is an initial generation (no previous year has stats)
        const hasPrevStats = archiveList.some(async () => false); // placeholder — we check per empire
        void hasPrevStats;

        send({ type: 'start', total: activePlayers.length, year });

        // Process all empires in parallel
        const results = await Promise.all(
          activePlayers.map(async (player) => {
            // Skip if already has stats and skipExisting is set
            if (skipExisting && existingStats[player.empire]) {
              send({ type: 'skipped', empire: player.empire });
              return { empire: player.empire, stats: existingStats[player.empire] };
            }

            const prevStats = await loadPrevStats(archiveList, year, player.empire, k);
            const territories = getEmpireTerritories(mapData, player.empire);
            const isInitial = forceInitial || prevStats === null;

            send({ type: 'empire_start', empire: player.empire, isInitial });

            const stats = await generateStatsForEmpire(
              player, pk, prevStats, territories, year, isInitial, send
            );

            if (stats) {
              send({ type: 'empire_done', empire: player.empire });
              return { empire: player.empire, stats };
            } else {
              return { empire: player.empire, stats: null };
            }
          })
        );

        // Merge into existing dict and save
        const freshDict = await dbGet<AllEmpireStats>(k(`turn:${year}:stats`)) ?? {};
        for (const { empire, stats } of results) {
          if (stats) freshDict[empire] = stats;
        }
        await dbSet(k(`turn:${year}:stats`), freshDict);

        const succeeded = results.filter(r => r.stats !== null).length;
        const failed = results.filter(r => r.stats === null).length;
        send({ type: 'done', succeeded, failed, year });

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: 'error', error: msg });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
