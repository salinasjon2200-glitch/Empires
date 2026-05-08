// Run: node scripts/seed-2031-news.mjs
// Seeds the 2031 World News Report into the live Vercel deployment.
// Requires GM_PASSWORD and BASE_URL env vars (or hardcode below for one-time use).

const BASE_URL = process.env.BASE_URL || 'https://empires-alpha.vercel.app';
const GM_PASSWORD = process.env.GM_PASSWORD;

if (!GM_PASSWORD) {
  console.error('Set GM_PASSWORD env var before running this script.');
  process.exit(1);
}

const NEWS_2031 = `# 🌍 WORLD NEWS REPORT — YEAR 2031
### *Your window into the state of the world — as the public sees it.*

---

## The Big Picture

2031 was the year everything broke. Eagle's Eye — once the dominant military power in the Americas — was destroyed by a coordinated assault from the Amazonian Empire and the Not See Empire. The Zero Empire was nuked a second time and ceased to exist. The Noobian Empire detonated a continent-sized electromagnetic pulse over China and formally declared World War III. The Grat Zero Empire surrendered, renamed itself Arby's, and joined the Big Corp Alliance. Ye abdicated. LegoLand gave back Norway and then it didn't matter because Eagle's Eye collapsed anyway.

And IKEA continued building its bridge.

The 2030s have become the most destructive period in human history. The body count is in the hundreds of millions. The nuclear weapon count is higher. The world that emerges from 2031 barely resembles the one that entered it.

---

## What Happened This Year

**Eagle's Eye Is Gone**
The empire that once spanned from the eastern United States to Argentina to Norway was destroyed in 2031 — attacked from both sides simultaneously. The Amazonian Empire launched nuclear strikes on Eagle's Eye's east coast military infrastructure, then redirected its entire western ground invasion force eastward while imposing a total naval blockade. At the same time, the Not See Empire continued its east coast invasion, deploying fresh bioweapons and reinforcements. Eagle's Eye retaliated with nuclear strikes of its own — some hitting Not See forces on American soil, others reaching mainland China — but it wasn't enough. By year's end, Eagle's Eye has fragmented. The central government has collapsed. Argentina, Greece, Bolivia, Madagascar, Norway, and portions of Spain are cut off and effectively independent. Jayden's empire is finished.

**The Zero Empire Is Gone**
Logan's Empire launched a second nuclear strike on the Zero Empire — this time targeting food supplies, nuclear stockpiles, and remaining military bases. Combined with the devastation from the first strike in 2030, the Zero Empire has ceased to function as a state. Eastern Russia is a radioactive, starving wasteland with no central government. Zantarian is missing, presumed dead or in hiding. In a final desperate act, the Zero Empire launched several warheads at the Noobian Empire before collapsing — a handful reached Italian and Irish territory, causing real but limited damage.

**The Noobian Empire Declared World War III**
In the single most dramatic action of 2031, the Noobian Empire detonated a continent-sized electromagnetic pulse over China — the Not See Empire's homeland. Every electronic system in mainland China was instantly destroyed. Military command, power grids, hospitals, communications, transportation — all offline. The civilian death toll from infrastructure collapse is estimated in the millions and climbing. Noah formally declared World War III against the Not See Empire and issued a global call to arms, inviting every empire in the world to join the fight against Alex.

**The Soviet Reunion Collapsed — Again**
Noah expelled Logan's Empire from the Soviet Reunion for continuing to attack the Zero Empire instead of focusing on Not See. The Soviet Reunion, which once included Noobian, Not See, Zero, Logan, and Viltrum, is now just... Noah. Alone. However, Noah immediately reopened the alliance to anyone willing to oppose Not See, effectively rebooting it as a global anti-Not See coalition. Invitations have been sent to Philippeah, IKEA, and others.

**The Grat Zero Empire Became Arby's**
In the most unusual diplomatic maneuver of the year, the Grat Zero Empire formally surrendered to the Amazonian Empire, renamed itself "Arby's" after the fast food chain, and applied to join the Big Corp Alliance. Amazon accepted. The war between them is over. Arby's keeps its interior territories and Cuba in exchange for accepting Amazon's territorial gains along the coast. Amazon is providing approximately $500 billion in reconstruction aid. The roast beef sandwich chain is now a sovereign nation.

**Ye Abdicated**
Robby formally handed control of his entire empire to Michael (Arby's). Little Saint James and whatever remains of the Kanye concert economy now belong to Arby's. Pakistan, which had been under sustained LegoLand military pressure, was formally absorbed by LegoLand. Kanye West is now an Arby's employee. The strangest economy in game history comes to an end.

**LegoLand Returned Norway — Then It Didn't Matter**
In a striking act of conscience, Aiden returned all of Norway to Eagle's Eye, apologized for seizing it, and paid reparations. Eagle's Eye gratefully accepted. Then Eagle's Eye collapsed entirely. Norway is now effectively ungoverned again. LegoLand also formally absorbed Pakistan following Ye's abdication. Aiden continues to produce warheads and maintain one of the strongest defensive postures in the world.

**Not See's Homeland Is Devastated**
The EMP strike on China has crippled the Not See Empire's core infrastructure. Military command systems are offline. Nuclear launch capability is temporarily disabled. Civilian infrastructure has collapsed. Meanwhile, Eagle's Eye's retaliatory nuclear strikes also hit Chinese military installations. The Not See Empire is now winning territory abroad (conquering Eagle's Eye's east coast) while its homeland burns. Alex's forces overseas are fighting without coordination from Beijing. The Not See Empire also attempted to send "apology" warheads to Eagle's Eye and Zero Empire that were secretly rigged to explode — the old Trojan Horse trick from 2027. Some were detected and destroyed. Some detonated. The international community's opinion of Not See has reached absolute rock bottom.

**Amazon Is Now the Most Powerful Empire in the World**
Hudson's empire received $3 trillion from the Noobian Empire, absorbed Arby's as a client state and Big Corp Alliance member, completed the Optimus PRIME AI weapons platform in Mongolia, conquered significant portions of Eagle's Eye territory, and maintained the world's largest nuclear arsenal at over 350 warheads. Amazon's economy runs entirely on renewable energy. Oil is still technically for sale at $10/barrel but nobody needs it anymore. Amazon frames everything as humanitarian reconstruction. Most of the world either believes it or knows better than to argue.

**The Big Corp Alliance Expanded**
Arby's is now the fourth member of the Big Corp Alliance, alongside Amazon, IKEA (defensive only), and LegoLand. The alliance is the most powerful bloc in the world — but internal tensions exist. LegoLand returned Norway to Eagle's Eye at the same time Amazon was destroying Eagle's Eye. IKEA continues to reject offensive obligations. The alliance is unified in name but divided in values.

**Philippeah Continues the Long Game**
The Philippeah Empire invested further in Taiwan's technology sector, advanced its Mars and Venus space program, and deployed anti-nuke defenses across all territories. Phillip is the only major power not currently in a war, an alliance crisis, or a state of collapse. Oil revenue remains depressed but Taiwan tech exports are picking up the slack. Noah invited Phillip to join the Soviet Reunion. Phillip has not responded.

**Logan Is Now Isolated**
Expelled from the Soviet Reunion for nuking Zero Empire a second time, Logan's Empire now sits alone with approximately 275 nuclear warheads, no allies, and a growing reputation as a state that commits mass destruction without strategic purpose. The welfare programs from 2030 continue, creating the bizarre contrast of a nation with excellent mental health services and a habit of nuclear genocide.

**New Yugoslavia Is Doing Everything Right**
Carl Marks raised taxes, built defenses, recruited volunteers, constructed missile silos, signed non-aggression pacts with IKEA and European neighbors, and launched morale campaigns. New Yugoslavia is now one of the most well-defended minor powers in Europe — non-threatening, stable, and ready. The bioweapon program has been quietly sidelined. Glory to the second coming of Yugoslavia.

**Other Notable Developments**
- **Winitall** raised taxes, built military, and quietly escaped any consequences from the 2029 false-flag involvement. Kendel survives by being forgettable.
- **The Ice Melters** developed anti-missile defense systems and continued rebuilding India. Daniel also attempted to develop "handheld teleportation devices," which turned out to be very fast trains. India is recovering.
- **Viltrum** fortified Ukraine as a permanent holding, canceled plans to evacuate, and sent a fleet to the Philippines. Now unaligned after the Soviet Reunion collapse.
- **The Noobian Empire** also made its Shockwave Bombs operational — a weapon that electrocutes humans within a large radius while leaving buildings and the environment intact. The most humane weapon of mass destruction ever invented, if that phrase can be used non-ironically.

---

## Where Things Stand Heading Into 2032

| Region | Status |
|---|---|
| Eastern USA | Contested ruins — Not See vs Amazon vs resistance |
| Western USA | Arby's territory under Amazon protection |
| Eastern Russia (Zero) | Radioactive wasteland — no government |
| China | EMP'd — infrastructure collapsed, millions suffering |
| Norway | Ungoverned again |
| Argentina / Greece / Bolivia / Madagascar | Former Eagle's Eye — cut off, independent |
| Pakistan | Now LegoLand |
| Little Saint James | Now Arby's |
| Cuba | Still Arby's |
| Africa (Zero's former half) | Ceded to Not See — partially landmined |
| Mongolia | Optimus PRIME weapons platform operational |
| Taiwan | Global tech capital — Philippeah |
| Iceland | Clean energy export hub — Noobian |
| Italy | Mediterranean trade hub — Noobian, minor nuke damage |

---

## Things Everyone Is Watching

- 🔴 **World War III** — Noah has declared it. The Noobian Empire, Amazon, and allies are forming an anti-Not See coalition. Not See's homeland is crippled but its overseas forces are still fighting. This is the defining conflict heading into 2032.
- 🔴 **Eagle's Eye Territory Scramble** — Multiple former Eagle's Eye territories are now ungoverned. Expect a land rush from every neighbor.
- 🔴 **Not See's China Dilemma** — The EMP devastated the homeland. Does Alex pull forces back to save China or keep pushing into Eagle's Eye?
- 🔴 **Amazon's Dominance** — The most powerful empire in recorded history. 350+ warheads, $3T in fresh cash, client states, Atlantean tech, Optimus PRIME. Who balances against this?
- 🟠 **Logan's Isolation** — 275 warheads, no allies, expelled from Soviet Reunion. A nuclear wildcard with nothing to lose.
- 🟠 **Big Corp Alliance Cracks** — LegoLand and Amazon have fundamentally different values. How long does this alliance hold?
- 🟠 **Philippeah's Silence** — The most stable empire in the world has declined every alliance invitation. What is Phillip waiting for?
- 🟠 **African Landmine Crisis** — Zero's parting gift to Not See: thousands of mines across the continent. Humanitarian disaster.
- 🟡 **Noobian Shockwave Bombs** — Operational. A weapon that kills people but leaves everything else standing. The implications are terrifying.
- 🟡 **IKEA's Bridge** — 85% complete. Probably finishes in 2032. The most consistent, least dramatic, and most successful long-term project in the game.
- 🟡 **Arby's Recovery** — Can a fast food chain rebuild a nation? Under Amazon's protection, maybe.

---

*This report reflects publicly known or widely rumored information as of the end of 2031. Some details may be incomplete, disputed, or deliberately obscured by the empires involved.*`;

const r = await fetch(`${BASE_URL}/api/turns/2031/summary`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${GM_PASSWORD}`,
  },
  body: JSON.stringify({ publicSummary: NEWS_2031 }),
});

const text = await r.text();
console.log(`Status: ${r.status}`);
console.log(text);
