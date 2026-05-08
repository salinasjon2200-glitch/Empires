/**
 * Seed script — populates the 2031 end-of-game state so Turn 7 (2032) can begin.
 * Run with: node scripts/seed.mjs
 *
 * Writes to Upstash KV if KV_REST_API_URL + KV_REST_API_TOKEN are set in .env.local,
 * otherwise falls back to local JSON files in /data.
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const useKV = !!(KV_URL && KV_TOKEN);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function safeKey(key) {
  return key.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

async function write(key, value) {
  if (useKV) {
    const res = await fetch(`${KV_URL}/pipeline`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', key, JSON.stringify(value)]]),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`KV write failed for "${key}": ${res.status} ${text}`);
    }
    console.log(`  ✓ ${key} → Upstash`);
  } else {
    const fp = path.join(DATA_DIR, safeKey(key) + '.json');
    fs.writeFileSync(fp, JSON.stringify(value, null, 2), 'utf-8');
    console.log(`  ✓ ${key} → local file`);
  }
}

// Simple SHA-256 hash for seed passwords (bcrypt adds startup overhead)
// The GM MUST reset all passwords before distributing. These are placeholders.
function hashPw(pw) {
  return '$sha256$' + createHash('sha256').update(pw).digest('hex');
}

console.log('\n🌍 EMPIRES — Seeding 2031 game state\n');
console.log(useKV ? '  📡 Writing to Upstash KV\n' : '  📁 Writing to local files\n');

async function seed() {

// ─── GAME STATE ──────────────────────────────────────────────────────────────
await write('game:state', {
  phase: 2,
  currentYear: 2032,
  theme: 'dark-military',
  biddingOpen: false,
  turnOpen: false,
  processingComplete: true,
});

// ─── PLAYERS ─────────────────────────────────────────────────────────────────
const players = [
  // Active empires
  { name: 'Phillip',     empire: 'Great Philippeah Empire', color: '#ef4444', status: 'active',   territories: ['Saudi Arabia', 'Mexico', 'North Korea', 'Taiwan'],                                              passwordHash: hashPw('PHILLIP-CHANGE-ME') },
  { name: 'Michael',     empire: "Arby's",                  color: '#f97316', status: 'active',   territories: ['United States (West)', 'Cuba', 'Little Saint James'],                                            passwordHash: hashPw('MICHAEL-CHANGE-ME') },
  { name: 'Daniel',      empire: 'Ice Melters',             color: '#eab308', status: 'active',   territories: ['France', 'Panama', 'Egypt', 'India'],                                                             passwordHash: hashPw('DANIEL-CHANGE-ME') },
  { name: 'Alex',        empire: 'Not See Empire',          color: '#6366f1', status: 'active',   territories: ['China', 'Kazakhstan', 'Turkey', 'Georgia', 'Azerbaijan', 'Armenia'],                            passwordHash: hashPw('ALEX-CHANGE-ME') },
  { name: 'Gabe',        empire: 'IKEA',                    color: '#22c55e', status: 'active',   territories: ['Poland', 'Sweden', 'Lithuania', 'Latvia'],                                                        passwordHash: hashPw('GABE-CHANGE-ME') },
  { name: 'Noah',        empire: 'Noobian Empire',          color: '#f97316', status: 'active',   territories: ['Italy', 'Ireland', 'Iceland'],                                                                     passwordHash: hashPw('NOAH-CHANGE-ME') },
  { name: 'Logan',       empire: "Logan's Empire",          color: '#06b6d4', status: 'active',   territories: ['Russia (East)'],                                                                                    passwordHash: hashPw('LOGAN-CHANGE-ME') },
  { name: 'Aiden',       empire: 'LegoLand',                color: '#3b82f6', status: 'active',   territories: ['Israel', 'South Korea', 'United Kingdom', 'Denmark', 'Pakistan'],                               passwordHash: hashPw('AIDEN-CHANGE-ME') },
  { name: 'Kendel',      empire: 'Winitall',                color: '#8b5cf6', status: 'active',   territories: ['Japan', 'Portugal', 'Spain (West)'],                                                               passwordHash: hashPw('KENDEL-CHANGE-ME') },
  { name: 'Hudson',      empire: 'Amazonian Empire',        color: '#ec4899', status: 'active',   territories: ['Germany', 'Mongolia', 'Iraq', 'Australia'],                                                       passwordHash: hashPw('HUDSON-CHANGE-ME') },
  { name: 'Nolan',       empire: 'Viltrum',                 color: '#14b8a6', status: 'active',   territories: ['Canada', 'Ukraine', 'New Zealand', 'Greenland', 'Philippines'],                                  passwordHash: hashPw('NOLAN-CHANGE-ME') },
  { name: 'Abraham',     empire: 'World Breakers',          color: '#f59e0b', status: 'active',   territories: ['Vietnam', 'Papua New Guinea', 'Peru', 'Colombia', 'Chile'],                                      passwordHash: hashPw('ABRAHAM-CHANGE-ME') },
  { name: 'Carl Marks',  empire: 'New Yugoslavia',          color: '#84cc16', status: 'active',   territories: ['Bulgaria', 'Romania', 'Albania', 'Serbia', 'Croatia'],                                            passwordHash: hashPw('CARL-CHANGE-ME') },
  { name: 'Unknown',     empire: "Temu's Empire",           color: '#a855f7', status: 'active',   territories: ['Afghanistan', 'Turkmenistan', 'Tajikistan', 'Uzbekistan', 'Kyrgyzstan'],                        passwordHash: hashPw('TEMU-CHANGE-ME') },

  // Eliminated empires
  { name: 'Jayden',      empire: "Eagle's Eye",             color: '#ef4444', status: 'eliminated', eliminatedYear: 2031, territories: [], passwordHash: hashPw('JAYDEN-ELIMINATED') },
  { name: 'Zantarian',   empire: 'Zero Empire',             color: '#6b7280', status: 'eliminated', eliminatedYear: 2031, territories: [], passwordHash: hashPw('ZERO-ELIMINATED') },
  { name: 'Robby',       empire: 'Ye',                      color: '#6b7280', status: 'eliminated', eliminatedYear: 2031, territories: [], passwordHash: hashPw('YE-ELIMINATED') },
  { name: 'Lasha',       empire: "Lasha's Empire",          color: '#6b7280', status: 'eliminated', eliminatedYear: 2029, territories: [], passwordHash: hashPw('LASHA-ELIMINATED') },
  { name: 'Devin',       empire: 'Mole Kingdom',            color: '#6b7280', status: 'eliminated', eliminatedYear: 2027, territories: [], passwordHash: hashPw('MOLE-ELIMINATED') },
  { name: 'Bus Michael', empire: 'Wall of Pongs',           color: '#6b7280', status: 'eliminated', eliminatedYear: 2026, territories: [], passwordHash: hashPw('PONGS-ELIMINATED') },
];

await write('game:players', players);

// ─── TERRITORY MAP ────────────────────────────────────────────────────────────
const territories = {
  // Great Philippeah Empire
  'Saudi Arabia':      { empire: 'Great Philippeah Empire', leader: 'Phillip', color: '#ef4444', status: 'active', since: 2032 },
  'Mexico':            { empire: 'Great Philippeah Empire', leader: 'Phillip', color: '#ef4444', status: 'active', since: 2032 },
  'North Korea':       { empire: 'Great Philippeah Empire', leader: 'Phillip', color: '#ef4444', status: 'active', since: 2032 },
  'Taiwan':            { empire: 'Great Philippeah Empire', leader: 'Phillip', color: '#ef4444', status: 'active', since: 2032 },

  // Arby's
  'United States (West)': { empire: "Arby's", leader: 'Michael', color: '#f97316', status: 'active', since: 2031 },
  'Cuba':              { empire: "Arby's",                  leader: 'Michael', color: '#f97316', status: 'active', since: 2031 },

  // Ice Melters
  'France':            { empire: 'Ice Melters',             leader: 'Daniel',  color: '#eab308', status: 'active', since: 2032 },
  'Panama':            { empire: 'Ice Melters',             leader: 'Daniel',  color: '#eab308', status: 'active', since: 2032 },
  'Egypt':             { empire: 'Ice Melters',             leader: 'Daniel',  color: '#eab308', status: 'active', since: 2032 },
  'India':             { empire: 'Ice Melters',             leader: 'Daniel',  color: '#eab308', status: 'active', since: 2032 },

  // Not See Empire
  'China':             { empire: 'Not See Empire',          leader: 'Alex',    color: '#6366f1', status: 'active', since: 2032 },
  'Kazakhstan':        { empire: 'Not See Empire',          leader: 'Alex',    color: '#6366f1', status: 'active', since: 2032 },
  'Turkey':            { empire: 'Not See Empire',          leader: 'Alex',    color: '#6366f1', status: 'active', since: 2032 },
  'Georgia':           { empire: 'Not See Empire',          leader: 'Alex',    color: '#6366f1', status: 'active', since: 2032 },
  'Azerbaijan':        { empire: 'Not See Empire',          leader: 'Alex',    color: '#6366f1', status: 'active', since: 2032 },
  'Armenia':           { empire: 'Not See Empire',          leader: 'Alex',    color: '#6366f1', status: 'active', since: 2032 },

  // IKEA
  'Poland':            { empire: 'IKEA',                    leader: 'Gabe',    color: '#22c55e', status: 'active', since: 2032 },
  'Sweden':            { empire: 'IKEA',                    leader: 'Gabe',    color: '#22c55e', status: 'active', since: 2032 },
  'Lithuania':         { empire: 'IKEA',                    leader: 'Gabe',    color: '#22c55e', status: 'active', since: 2032 },
  'Latvia':            { empire: 'IKEA',                    leader: 'Gabe',    color: '#22c55e', status: 'active', since: 2032 },

  // Noobian Empire
  'Italy':             { empire: 'Noobian Empire',          leader: 'Noah',    color: '#f97316', status: 'active', since: 2032 },
  'Ireland':           { empire: 'Noobian Empire',          leader: 'Noah',    color: '#f97316', status: 'active', since: 2032 },
  'Iceland':           { empire: 'Noobian Empire',          leader: 'Noah',    color: '#f97316', status: 'active', since: 2032 },

  // Logan's Empire
  'Russia (East)':     { empire: "Logan's Empire",          leader: 'Logan',   color: '#06b6d4', status: 'active', since: 2032 },

  // LegoLand
  'Israel':            { empire: 'LegoLand',                leader: 'Aiden',   color: '#3b82f6', status: 'active', since: 2032 },
  'South Korea':       { empire: 'LegoLand',                leader: 'Aiden',   color: '#3b82f6', status: 'active', since: 2032 },
  'United Kingdom':    { empire: 'LegoLand',                leader: 'Aiden',   color: '#3b82f6', status: 'active', since: 2032 },
  'Denmark':           { empire: 'LegoLand',                leader: 'Aiden',   color: '#3b82f6', status: 'active', since: 2032 },
  'Pakistan':          { empire: 'LegoLand',                leader: 'Aiden',   color: '#3b82f6', status: 'active', since: 2031 },

  // Winitall
  'Japan':             { empire: 'Winitall',                leader: 'Kendel',  color: '#8b5cf6', status: 'active', since: 2032 },
  'Portugal':          { empire: 'Winitall',                leader: 'Kendel',  color: '#8b5cf6', status: 'active', since: 2032 },
  'Spain (West)':      { empire: 'Winitall',                leader: 'Kendel',  color: '#8b5cf6', status: 'active', since: 2032 },

  // Amazonian Empire
  'Germany':           { empire: 'Amazonian Empire',        leader: 'Hudson',  color: '#ec4899', status: 'active', since: 2032 },
  'Mongolia':          { empire: 'Amazonian Empire',        leader: 'Hudson',  color: '#ec4899', status: 'active', since: 2032 },
  'Iraq':              { empire: 'Amazonian Empire',        leader: 'Hudson',  color: '#ec4899', status: 'active', since: 2032 },
  'Australia':         { empire: 'Amazonian Empire',        leader: 'Hudson',  color: '#ec4899', status: 'active', since: 2032 },

  // Viltrum
  'Canada':            { empire: 'Viltrum',                 leader: 'Nolan',   color: '#14b8a6', status: 'active', since: 2032 },
  'Ukraine':           { empire: 'Viltrum',                 leader: 'Nolan',   color: '#14b8a6', status: 'active', since: 2032 },
  'New Zealand':       { empire: 'Viltrum',                 leader: 'Nolan',   color: '#14b8a6', status: 'active', since: 2032 },
  'Philippines':       { empire: 'Viltrum',                 leader: 'Nolan',   color: '#14b8a6', status: 'active', since: 2032 },

  // World Breakers
  'Vietnam':           { empire: 'World Breakers',          leader: 'Abraham', color: '#f59e0b', status: 'active', since: 2032 },
  'Peru':              { empire: 'World Breakers',          leader: 'Abraham', color: '#f59e0b', status: 'active', since: 2032 },
  'Colombia':          { empire: 'World Breakers',          leader: 'Abraham', color: '#f59e0b', status: 'active', since: 2032 },
  'Chile':             { empire: 'World Breakers',          leader: 'Abraham', color: '#f59e0b', status: 'active', since: 2032 },

  // New Yugoslavia
  'Bulgaria':          { empire: 'New Yugoslavia',          leader: 'Carl Marks', color: '#84cc16', status: 'active', since: 2032 },
  'Romania':           { empire: 'New Yugoslavia',          leader: 'Carl Marks', color: '#84cc16', status: 'active', since: 2032 },
  'Albania':           { empire: 'New Yugoslavia',          leader: 'Carl Marks', color: '#84cc16', status: 'active', since: 2032 },
  'Serbia':            { empire: 'New Yugoslavia',          leader: 'Carl Marks', color: '#84cc16', status: 'active', since: 2032 },
  'Croatia':           { empire: 'New Yugoslavia',          leader: 'Carl Marks', color: '#84cc16', status: 'active', since: 2032 },

  // Temu's Empire
  'Afghanistan':       { empire: "Temu's Empire",           leader: 'Unknown', color: '#a855f7', status: 'active', since: 2032 },
  'Turkmenistan':      { empire: "Temu's Empire",           leader: 'Unknown', color: '#a855f7', status: 'active', since: 2032 },
  'Tajikistan':        { empire: "Temu's Empire",           leader: 'Unknown', color: '#a855f7', status: 'active', since: 2032 },
  'Uzbekistan':        { empire: "Temu's Empire",           leader: 'Unknown', color: '#a855f7', status: 'active', since: 2032 },
  'Kyrgyzstan':        { empire: "Temu's Empire",           leader: 'Unknown', color: '#a855f7', status: 'active', since: 2032 },

  // Contested / ungoverned
  'Argentina':         { empire: 'Contested',   leader: '', color: '#6b7280', status: 'contested' },
  'Greece':            { empire: 'Contested',   leader: '', color: '#6b7280', status: 'contested' },
  'Bolivia':           { empire: 'Contested',   leader: '', color: '#6b7280', status: 'contested' },
  'Spain (East)':      { empire: 'Contested',   leader: '', color: '#6b7280', status: 'contested' },
  'Norway':            { empire: 'Contested',   leader: '', color: '#6b7280', status: 'contested' },
  'Russia (West)':     { empire: 'Ungoverned',  leader: '', color: '#374151', status: 'ungoverned' },
};

await write('map:territories', territories);
await write('map:history:2031', territories);

// ─── TURN ARCHIVE ─────────────────────────────────────────────────────────────
await write('turn:archive', [2026, 2027, 2028, 2029, 2030, 2031]);

// ─── 2031 PERFECT KNOWLEDGE (verbatim from the build prompt) ─────────────────
const pk2031 = `🌍 SHARED WORLD SUMMARY — TURN 6 (2031)
Perfect Knowledge / Advisor-Chat Canon

Global Overview

2031 was the year Eagle's Eye died. Attacked simultaneously by the Amazonian Empire and the Not See Empire — both deploying nuclear weapons, bioweapons, naval blockades, and ground forces — the once-dominant American empire collapsed under the coordinated weight. LegoLand returned Norway but couldn't save the rest. The Zero Empire was nuked a SECOND time by Logan and effectively ceased to exist as a functioning state. The Soviet Reunion fractured again. The Grat Zero Empire surrendered, rebranded as "Arby's," and joined the Big Corp Alliance. Ye abdicated. The Noobian Empire detonated a China-sized EMP against the Not See Empire and declared World War III. And through it all, IKEA offered to host peace talks and kept building its bridge.

The world has never been more violent, more fractured, or more absurd.

Key Regional / International Developments

THE FALL OF EAGLE'S EYE
Eagle's Eye entered 2031 under invasion from Not See (east coast) and facing Amazon's expanding west coast campaign.

Amazon's attack on Eagle's Eye:
✅ Amazon launched a nuclear strike on Eagle's Eye
✅ Amazon diverted its Grat Zero invasion force to Eagle's Eye
✅ Amazon deployed a naval blockade around Eagle's Eye
⚠️ "Atlantean communication-disabling tech" — begin R&D, operational 2-3 turns

Not See's attack on Eagle's Eye:
✅ Not See continued the east coast invasion with fresh reinforcements and new bioweapons
⚠️ "Lil Frank" — slightly more virulent strain, NOT alien, NOT instant-kill. Noobian vaccine 60% effective.
⚠️ Trojan Horse warheads — 2 detonated in Eagle's Eye, 2 in Zero Empire

Eagle's Eye's response:
✅ Eagle's Eye launched nuclear strikes against Not See invasion forces
⚠️ Eagle's Eye targeted Not See's homeland (China) — several warheads reach China

💀 Eagle's Eye is functionally destroyed by year's end. Territories fragmenting: Western (Amazon/Arby's), East coast (contested), Argentina/Greece/Bolivia/Madagascar (cut off).

THE SECOND NUKING OF ZERO EMPIRE
✅ Logan launched a SECOND nuclear strike on Zero Empire
💀 Zero Empire FUNCTIONALLY DESTROYED. Eastern Russia is a radioactive wasteland.

THE NOOBIAN EMP ATTACK ON CHINA
✅ EMP detonation succeeded — ALL electronics in mainland China fried
💀 Not See Empire's China operations CRIPPLED. ~70% of China-based nuclear capability temporarily disabled.
✅ Noah formally declared WWIII against Not See

THE SOVIET REUNION — FRACTURED AGAIN
💀 The Soviet Reunion is now: Noobian only. Logan expelled, Viltrum out.
✅ Noah invites Philippeah to join Soviet Reunion — pending
✅ Noah offered $3 trillion to Amazon — accepted

THE NOOBIAN EMPIRE — MASSIVE TURN
✅ China-sized EMP deployed
✅ More EMPs built — multiple continent-scale EMPs now in arsenal
✅ $500B into energy-based weapons — operational next turn
✅ $200B into Shockwave Bombs — operational 2032
✅ Strengthened vaccine — 80% effective against Lil Frank
✅ Formally exposed Not See for creating the plague

THE ARBY'S TRANSFORMATION
✅ Renamed from Grat Zero Empire to "Arby's"
✅ Joined Big Corp Alliance
✅ Amazon ceasefire — Amazon keeps coastal territories, Arby's keeps interior + Cuba
✅ $500B in stabilization funding from Amazon
✅ Absorbed Ye's empire. Now owns Kanye West.

LEGOLAND
✅ Norway returned to Eagle's Eye (subsequently ungoverned as Eagle's Eye collapsed)
✅ Pakistan absorbed via Ye's abdication
✅ Arsenal: ~40-50 warheads

NOT SEE EMPIRE — DEVASTATED
💀 Hit by Noobian EMP (China devastated)
💀 Hit by Eagle's Eye retaliatory nukes
💀 Complete diplomatic isolation
✅ East coast Eagle's Eye invasion continuing despite homeland crisis
❌ Space-mutated alien plague — REJECTED
❌ Alien technology — REJECTED
❌ Bomb-proof shield — REJECTED

AMAZONIAN EMPIRE — DOMINANT
✅ 350+ warheads
✅ $3T received from Noobian
✅ Arby's as client state
✅ Optimus PRIME weapons platform operational
✅ Eagle's Eye conquered (with Not See's help)
Hudson is now the undisputed most powerful leader in the world.

OTHER EMPIRES
Philippeah: Quiet year. Taiwan tech booming. Space program advancing. Anti-nuke defenses operational.
IKEA: Bridge 85% complete. International reputation at all-time high.
Winitall: Escaped false-flag consequences. Rebuilding. Quiet year.
New Yugoslavia: Excellent defensive consolidation. Non-aggression pacts with IKEA. Well-defended minor power.
Viltrum: Ukraine fortified permanently. Philippine fleet. Lost Soviet Reunion membership.
Ice Melters: Anti-missile defense operational. India recovery advancing.
Logan: Nuked Zero twice. ~275 warheads. Expelled from Soviet Reunion. Now unaligned.
World Breakers: No actions for 6+ turns. Territories held by inertia.
Temu's Empire: Static. Peace treaties from 2030 hold.

Emerging Flashpoints & Opportunities for 2032

🔴 Not See China Crisis — EMP devastated the homeland. Will Alex pull back or push forward?
🔴 Eagle's Eye Territory Scramble — Argentina, Greece, Bolivia, Madagascar, Spain, Norway all up for grabs.
🔴 Zero Empire Aftermath — Eastern Russia ungoverned. Logan will likely absorb.
🔴 Amazon's Total Dominance — Most powerful empire in game history.
🔴 WWIII — Noobian vs Not See — Anti-Not See coalition forming.
🟠 Big Corp Alliance Internal Tension — Aiden vs Hudson.
🟠 Logan's Isolation — Massive arsenal, no allies. Wildcard.
🟠 Philippeah's Neutrality — How long can Phillip stay neutral?
🟡 Arby's Recovery — Can Michael rebuild under Amazon's shadow?
🟡 New Yugoslavia's Rise — Positioned perfectly.
🟡 IKEA's Bridge — 85% complete. Full completion 2032.

End of Turn 6 — 2031 World Summary.`;

await write('turn:2031:summary', {
  publicSummary: pk2031,
  perfectKnowledge: pk2031,
});

// ─── INITIAL CHAT MESSAGE ─────────────────────────────────────────────────────
const welcomeMsg = {
  id: 'seed-msg-1',
  senderName: 'Game Master',
  empireName: 'GM',
  color: '#ffffff',
  text: '🎲 Welcome to Year 2032. The world map has been updated. All empire passwords are set to placeholders — GM must reset before distributing. Good luck.',
  timestamp: Date.now(),
  isGM: true,
};
await write('chat:public', [welcomeMsg]);

console.log('\n✅ Seed complete! Game is ready for Year 2032.');
console.log('\n⚠️  IMPORTANT: All empire passwords are set to placeholder values.');
console.log('   The GM must reset each password via the GM Dashboard before distributing to players.');
console.log('\n   Placeholder passwords follow the pattern: PLAYERNAME-CHANGE-ME');
console.log('   Example: PHILLIP-CHANGE-ME, MICHAEL-CHANGE-ME, etc.\n');

} // end seed()

seed().catch(err => { console.error('\n❌ Seed failed:', err.message); process.exit(1); });
