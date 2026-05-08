'use client';
import { useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import Link from 'next/link';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Atlas name → game name
const ATLAS_TO_GAME: Record<string, string> = {
  'United States of America': 'United States',
  'Russian Federation': 'Russia',
  "Democratic People's Republic of Korea": 'North Korea',
  'Republic of Korea': 'South Korea',
  'Viet Nam': 'Vietnam',
  'Iran (Islamic Republic of)': 'Iran',
  'Venezuela, Bolivarian Republic of': 'Venezuela',
  'Bolivia, Plurinational State of': 'Bolivia',
  'United Republic of Tanzania': 'Tanzania',
  'Tanzania, United Republic of': 'Tanzania',
  'Lao PDR': 'Laos',
  'Czech Republic': 'Czech Republic',
  'Bosnia and Herzegovina': 'Bosnia',
  'Syrian Arab Republic': 'Syria',
  "Côte d'Ivoire": 'Ivory Coast',
  'Congo, the Democratic Republic of the': 'DR Congo',
  'Central African Republic': 'Central African Republic',
  'Guinea-Bissau': 'Guinea-Bissau',
  'Papua New Guinea': 'Papua New Guinea',
  'Taiwan, Province of China': 'Taiwan',
  'Korea, Republic of': 'South Korea',
  "Korea, Democratic People's Republic of": 'North Korea',
  'Moldova, Republic of': 'Moldova',
  'Macedonia, the former Yugoslav Republic of': 'North Macedonia',
  'Libyan Arab Jamahiriya': 'Libya',
  'Sudan (the)': 'Sudan',
  'S. Sudan': 'South Sudan',
  'Solomon Is.': 'Solomon Islands',
  'Eq. Guinea': 'Equatorial Guinea',
  'W. Sahara': 'Western Sahara',
  'Dominican Rep.': 'Dominican Republic',
  'Dem. Rep. Congo': 'DR Congo',
  'Central African Rep.': 'Central African Republic',
  'Bosnia and Herz.': 'Bosnia',
  'Czechia': 'Czech Republic',
  'N. Korea': 'North Korea',
  'S. Korea': 'South Korea',
  'Dem. Rep. Korea': 'North Korea',
  'Rep. Korea': 'South Korea',
};

type TerritorySpec = {
  empire: string;
  leader: string;
  color: string;
  pattern?: 'crosshatch' | 'stripes';
  note?: string;
};

const TERRITORIES: Record<string, TerritorySpec> = {
  // AMAZONIAN EMPIRE — #5DADE2
  'Germany':        { empire: 'Amazonian Empire', leader: 'Hudson', color: '#5DADE2' },
  'Mongolia':       { empire: 'Amazonian Empire', leader: 'Hudson', color: '#5DADE2' },
  'Iraq':           { empire: 'Amazonian Empire', leader: 'Hudson', color: '#5DADE2' },
  'Australia':      { empire: 'Amazonian Empire', leader: 'Hudson', color: '#5DADE2' },
  // USA: Arby's holds interior; Amazon holds western coastline (same atlas polygon)
  'United States':  { empire: "Arby's", leader: 'Michael', color: '#F4D03F', note: 'Interior: Arby\'s. Western coastline: Amazonian beachheads (Amazon, #5DADE2).' },

  // GREAT PHILIPPEAH EMPIRE — #F1C40F
  'Saudi Arabia':   { empire: 'Great Philippeah Empire', leader: 'Phillip', color: '#F1C40F' },
  'Mexico':         { empire: 'Great Philippeah Empire', leader: 'Phillip', color: '#F1C40F' },
  'North Korea':    { empire: 'Great Philippeah Empire', leader: 'Phillip', color: '#F1C40F' },
  'Taiwan':         { empire: 'Great Philippeah Empire', leader: 'Phillip', color: '#F1C40F' },

  // NOT SEE EMPIRE — #E67E22
  'China':          { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22', note: 'EMP-devastated. Military offline. Invasion of Eagle\'s Eye ongoing.' },
  'Kazakhstan':     { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Turkey':         { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Georgia':        { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Azerbaijan':     { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Armenia':        { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Morocco':        { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Algeria':        { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Tunisia':        { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Libya':          { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Sudan':          { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Ethiopia':       { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Somalia':        { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Kenya':          { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Uganda':         { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },
  'Tanzania':       { empire: 'Not See Empire', leader: 'Alex', color: '#E67E22' },

  // IKEA — #82E0AA
  'Poland':         { empire: 'IKEA', leader: 'Gabe', color: '#82E0AA' },
  'Sweden':         { empire: 'IKEA', leader: 'Gabe', color: '#82E0AA' },
  'Lithuania':      { empire: 'IKEA', leader: 'Gabe', color: '#82E0AA' },
  'Latvia':         { empire: 'IKEA', leader: 'Gabe', color: '#82E0AA' },

  // LOGAN'S EMPIRE — #95A5A6
  'Russia':         { empire: "Logan's Empire", leader: 'Logan', color: '#95A5A6', note: 'Zero Empire collapsed. Logan absorbs eastern half by attrition.' },

  // ARBY'S — #F4D03F
  'Cuba':           { empire: "Arby's", leader: 'Michael', color: '#F4D03F' },

  // NOOBIAN EMPIRE — #FF69B4
  'Italy':          { empire: 'Noobian Empire', leader: 'Noah', color: '#FF69B4' },
  'Ireland':        { empire: 'Noobian Empire', leader: 'Noah', color: '#FF69B4' },
  'Iceland':        { empire: 'Noobian Empire', leader: 'Noah', color: '#FF69B4' },

  // LEGOLAND — #9B59B6
  'Israel':         { empire: 'LegoLand', leader: 'Aiden', color: '#9B59B6' },
  'South Korea':    { empire: 'LegoLand', leader: 'Aiden', color: '#9B59B6' },
  'United Kingdom': { empire: 'LegoLand', leader: 'Aiden', color: '#9B59B6' },
  'Denmark':        { empire: 'LegoLand', leader: 'Aiden', color: '#9B59B6' },
  'Pakistan':       { empire: 'LegoLand', leader: 'Aiden', color: '#9B59B6' },

  // WINITALL — #D7BDE2
  'Japan':          { empire: 'Winitall', leader: 'Kendel', color: '#D7BDE2' },
  'Portugal':       { empire: 'Winitall', leader: 'Kendel', color: '#D7BDE2' },

  // ICE MELTERS — #8B4513
  'France':         { empire: 'Ice Melters', leader: 'Daniel', color: '#8B4513' },
  'Panama':         { empire: 'Ice Melters', leader: 'Daniel', color: '#8B4513' },
  'Egypt':          { empire: 'Ice Melters', leader: 'Daniel', color: '#8B4513' },
  'India':          { empire: 'Ice Melters', leader: 'Daniel', color: '#8B4513' },

  // JONATHAN'S EMPIRE — #A0522D
  'Indonesia':      { empire: "Jonathan's Empire", leader: 'Jonathan', color: '#A0522D' },
  'Netherlands':    { empire: "Jonathan's Empire", leader: 'Jonathan', color: '#A0522D' },
  'Belgium':        { empire: "Jonathan's Empire", leader: 'Jonathan', color: '#A0522D' },

  // BRYSON'S EMPIRE — #1C1C1C
  'Brazil':         { empire: "Bryson's Empire", leader: 'Bryson', color: '#2a2a2a' },
  'Iran':           { empire: "Bryson's Empire", leader: 'Bryson', color: '#2a2a2a' },
  'Venezuela':      { empire: "Bryson's Empire", leader: 'Bryson', color: '#2a2a2a' },

  // WORLD BREAKERS — #186A3B
  'Vietnam':        { empire: 'World Breakers', leader: '—', color: '#186A3B' },
  'Papua New Guinea': { empire: 'World Breakers', leader: '—', color: '#186A3B' },
  'Peru':           { empire: 'World Breakers', leader: '—', color: '#186A3B' },
  'Colombia':       { empire: 'World Breakers', leader: '—', color: '#186A3B' },
  'Chile':          { empire: 'World Breakers', leader: '—', color: '#186A3B' },

  // VILTRUM — #F5B041
  'Canada':         { empire: 'Viltrum', leader: 'Nolan', color: '#F5B041' },
  'Ukraine':        { empire: 'Viltrum', leader: 'Nolan', color: '#F5B041' },
  'New Zealand':    { empire: 'Viltrum', leader: 'Nolan', color: '#F5B041' },
  'Philippines':    { empire: 'Viltrum', leader: 'Nolan', color: '#F5B041' },
  'Greenland':      { empire: 'Viltrum', leader: 'Nolan', color: '#F5B041' },

  // NEW YUGOSLAVIA — #DC7633
  'Bulgaria':       { empire: 'New Yugoslavia', leader: 'Carl Marks', color: '#DC7633' },
  'Romania':        { empire: 'New Yugoslavia', leader: 'Carl Marks', color: '#DC7633' },
  'Albania':        { empire: 'New Yugoslavia', leader: 'Carl Marks', color: '#DC7633' },
  'Serbia':         { empire: 'New Yugoslavia', leader: 'Carl Marks', color: '#DC7633' },
  'Croatia':        { empire: 'New Yugoslavia', leader: 'Carl Marks', color: '#DC7633' },

  // TEMU'S EMPIRE — #A9CCE3
  'Afghanistan':    { empire: "Temu's Empire", leader: 'Temu', color: '#A9CCE3' },
  'Turkmenistan':   { empire: "Temu's Empire", leader: 'Temu', color: '#A9CCE3' },
  'Tajikistan':     { empire: "Temu's Empire", leader: 'Temu', color: '#A9CCE3' },
  'Uzbekistan':     { empire: "Temu's Empire", leader: 'Temu', color: '#A9CCE3' },
  'Kyrgyzstan':     { empire: "Temu's Empire", leader: 'Temu', color: '#A9CCE3' },

  // RUBBLE — crosshatch #4A4A4A
  'Switzerland':    { empire: 'Rubble', leader: '—', color: '#4A4A4A', pattern: 'crosshatch', note: 'Bombed by Not See in 2027. Surface obliterated.' },
  'Austria':        { empire: 'Rubble', leader: '—', color: '#4A4A4A', pattern: 'crosshatch', note: 'Bombed by Not See in 2027.' },

  // UNGOVERNED / SPECIAL
  'Spain':          { empire: 'Contested', leader: '—', color: '#4A4A4A', pattern: 'stripes', note: 'Half Winitall, half ungoverned. Eagle\'s Eye collapsed.' },
  'Norway':         { empire: 'Ungoverned', leader: '—', color: '#4A4A4A' },
  'Argentina':      { empire: 'Ungoverned', leader: '—', color: '#4A4A4A' },
  'Bolivia':        { empire: 'Ungoverned', leader: '—', color: '#4A4A4A' },
  'Madagascar':     { empire: 'Ungoverned', leader: '—', color: '#4A4A4A' },
  'Greece':         { empire: 'Ungoverned', leader: '—', color: '#4A4A4A' },
};

const EMPIRE_LEGEND = [
  { empire: 'Amazonian Empire',       leader: 'Hudson',     color: '#5DADE2' },
  { empire: 'Great Philippeah Empire',leader: 'Phillip',    color: '#F1C40F' },
  { empire: 'Not See Empire',         leader: 'Alex',       color: '#E67E22' },
  { empire: "Logan's Empire",         leader: 'Logan',      color: '#95A5A6' },
  { empire: "Arby's",                 leader: 'Michael',    color: '#F4D03F' },
  { empire: 'Noobian Empire',         leader: 'Noah',       color: '#FF69B4' },
  { empire: 'LegoLand',               leader: 'Aiden',      color: '#9B59B6' },
  { empire: 'Ice Melters',            leader: 'Daniel',     color: '#8B4513' },
  { empire: 'IKEA',                   leader: 'Gabe',       color: '#82E0AA' },
  { empire: 'Winitall',               leader: 'Kendel',     color: '#D7BDE2' },
  { empire: 'Viltrum',                leader: 'Nolan',      color: '#F5B041' },
  { empire: 'New Yugoslavia',         leader: 'Carl Marks', color: '#DC7633' },
  { empire: 'Noobian Empire',         leader: 'Noah',       color: '#FF69B4' },
  { empire: "Temu's Empire",          leader: 'Temu',       color: '#A9CCE3' },
  { empire: "Jonathan's Empire",      leader: 'Jonathan',   color: '#A0522D' },
  { empire: "Bryson's Empire",        leader: 'Bryson',     color: '#2a2a2a' },
  { empire: 'World Breakers',         leader: '—',          color: '#186A3B' },
];

// Deduplicate legend
const LEGEND = EMPIRE_LEGEND.filter((e, i, arr) => arr.findIndex(x => x.empire === e.empire) === i);

function gameName(atlasName: string): string {
  return ATLAS_TO_GAME[atlasName] ?? atlasName;
}

function getTerritoryInfo(atlasName: string): TerritorySpec | null {
  const name = gameName(atlasName);
  return TERRITORIES[name] ?? null;
}

function getFill(atlasName: string, hovered: string | null): string {
  const name = gameName(atlasName);
  if (hovered === name) return '#ffffff22';
  const t = getTerritoryInfo(atlasName);
  if (!t) return '#2C3E50';
  if (t.pattern === 'crosshatch') return 'url(#crosshatch)';
  if (t.pattern === 'stripes') return 'url(#stripes)';
  return t.color + 'cc';
}

function getStroke(atlasName: string): string {
  const t = getTerritoryInfo(atlasName);
  if (!t) return '#3d5166';
  if (t.color === '#4A4A4A' || t.pattern) return '#666';
  return t.color;
}

export default function MapInner() {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const selectedInfo = selected ? getTerritoryInfo(selected) ?? { empire: 'Neutral / Unaffiliated', leader: '—', color: '#2C3E50' } : null;
  const selectedTerritories = selected && selectedInfo
    ? Object.entries(TERRITORIES).filter(([, v]) => v.empire === selectedInfo.empire).map(([k]) => k)
    : [];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0A1628', color: '#e2e8f0', fontFamily: 'var(--font-body, sans-serif)', overflow: 'hidden' }}>

      {/* LEFT SIDEBAR */}
      <aside style={{ width: 260, minWidth: 260, borderRight: '1px solid #1e3a5f', overflowY: 'auto', padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ padding: '0 1rem 0.75rem', borderBottom: '1px solid #1e3a5f' }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.15em', color: '#4a9eff', textTransform: 'uppercase', marginBottom: 4 }}>EMPIRES</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.1em', color: '#e2e8f0' }}>MODERN AGE</div>
          <Link href="/submit" style={{ fontSize: '0.65rem', color: '#4a9eff', textDecoration: 'none' }}>← Back to Game</Link>
        </div>

        <div style={{ padding: '0.75rem 1rem 0.5rem', fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Active Empires
        </div>

        {LEGEND.map(e => (
          <div
            key={e.empire}
            onClick={() => setSelected(selected === e.empire ? null : e.empire)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '0.45rem 1rem', cursor: 'pointer',
              background: selected === e.empire ? '#1e3a5f' : 'transparent',
              transition: 'background 0.15s',
            }}
            onMouseEnter={el => (el.currentTarget.style.background = selected === e.empire ? '#1e3a5f' : '#0f2440')}
            onMouseLeave={el => (el.currentTarget.style.background = selected === e.empire ? '#1e3a5f' : 'transparent')}
          >
            <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, background: e.color, border: '1px solid rgba(255,255,255,0.15)' }} />
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.2 }}>{e.empire}</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{e.leader}</div>
            </div>
          </div>
        ))}

        <div style={{ padding: '0.75rem 1rem 0.5rem', fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', borderTop: '1px solid #1e3a5f', marginTop: 8 }}>
          Special Zones
        </div>
        {[
          { color: '#4A4A4A', label: 'Rubble / Bombed', sub: 'Switzerland, Austria' },
          { color: '#4A4A4A', label: 'Ungoverned / Collapsed', sub: 'Spain, Norway, Argentina, Bolivia, Greece, Madagascar' },
          { color: '#2C3E50', label: 'Neutral / Unaffiliated', sub: 'No empire' },
        ].map(e => (
          <div key={e.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.4rem 1rem' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, background: e.color, border: '1px solid rgba(255,255,255,0.15)', marginTop: 1 }} />
            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{e.label}</div>
              <div style={{ fontSize: '0.6rem', color: '#475569' }}>{e.sub}</div>
            </div>
          </div>
        ))}
      </aside>

      {/* MAP AREA */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Year label */}
        <div style={{ position: 'absolute', top: 16, right: 20, zIndex: 10, textAlign: 'right', pointerEvents: 'none' }}>
          <div style={{ fontSize: '0.6rem', color: '#4a9eff', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Game Year</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#e2e8f0', lineHeight: 1, letterSpacing: '0.05em' }}>2031</div>
        </div>

        <ComposableMap
          projectionConfig={{ scale: 155, center: [15, 10] }}
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            {/* Crosshatch pattern for Rubble territories */}
            <pattern id="crosshatch" patternUnits="userSpaceOnUse" width="8" height="8">
              <rect width="8" height="8" fill="#2a2a2a" />
              <line x1="0" y1="0" x2="8" y2="8" stroke="#666" strokeWidth="1.2" />
              <line x1="8" y1="0" x2="0" y2="8" stroke="#666" strokeWidth="1.2" />
            </pattern>
            {/* Diagonal stripes for Spain (Winitall + Ungoverned) */}
            <pattern id="stripes" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
              <rect width="5" height="10" fill="#D7BDE2cc" />
              <rect x="5" width="5" height="10" fill="#4A4A4A" />
            </pattern>
          </defs>

          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => {
                const atlasName: string = geo.properties.name;
                const name = gameName(atlasName);
                const fill = getFill(atlasName, hovered);
                const stroke = getStroke(atlasName);
                const isSelected = selected ? (() => {
                  const t = TERRITORIES[name];
                  return t && selectedInfo && t.empire === selectedInfo.empire;
                })() : false;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={isSelected ? fill.replace('cc', '') : fill}
                    stroke={isSelected ? '#ffffff' : stroke}
                    strokeWidth={isSelected ? 1.2 : 0.4}
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none', cursor: 'pointer' },
                      pressed: { outline: 'none' },
                    }}
                    onMouseEnter={evt => {
                      setHovered(name);
                      const t = getTerritoryInfo(atlasName);
                      const empireText = t ? `${t.empire}` : 'Neutral';
                      const leaderText = t && t.leader !== '—' ? `  ${t.leader}` : '';
                      setTooltip({ text: `${name}\n${empireText}${leaderText}`, x: evt.clientX, y: evt.clientY });
                    }}
                    onMouseLeave={() => { setHovered(null); setTooltip(null); }}
                    onMouseMove={evt => setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : null)}
                    onClick={() => setSelected(prev => prev === name ? null : name)}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: 'fixed', zIndex: 50, pointerEvents: 'none',
              left: tooltip.x + 14, top: tooltip.y - 12,
              background: '#0f1e35', border: '1px solid #1e3a5f',
              borderRadius: 6, padding: '6px 10px',
              fontSize: '0.75rem', color: '#e2e8f0',
              whiteSpace: 'pre-line', maxWidth: 220,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}
          >
            {tooltip.text}
          </div>
        )}

        {/* Info panel */}
        {selected && selectedInfo && (
          <div
            style={{
              position: 'absolute', bottom: 24, right: 24, zIndex: 20,
              background: '#0f1e35cc', backdropFilter: 'blur(8px)',
              border: '1px solid #1e3a5f', borderRadius: 10,
              padding: '1rem 1.25rem', minWidth: 240, maxWidth: 320,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: selectedInfo.color, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0' }}>{selectedInfo.empire}</div>
                {selectedInfo.leader !== '—' && (
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Led by {selectedInfo.leader}</div>
                )}
              </div>
              <button onClick={() => setSelected(null)} style={{ marginLeft: 'auto', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
            </div>
            {selectedInfo.note && (
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: 8, lineHeight: 1.4, borderLeft: '2px solid #1e3a5f', paddingLeft: 8 }}>
                {selectedInfo.note}
              </div>
            )}
            <div style={{ fontSize: '0.65rem', color: '#4a9eff', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Territories ({selectedTerritories.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {selectedTerritories.map(t => (
                <span key={t} style={{ fontSize: '0.65rem', background: '#1e3a5f', color: '#94a3b8', borderRadius: 4, padding: '2px 6px' }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Click hint */}
        {!selected && (
          <div style={{ position: 'absolute', bottom: 24, right: 24, fontSize: '0.65rem', color: '#2d4a6a', pointerEvents: 'none' }}>
            Click any country or empire to inspect
          </div>
        )}
      </div>
    </div>
  );
}
