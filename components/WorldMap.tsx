'use client';
import { useState, useRef, useEffect } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { TerritoryMap, BidState } from '@/lib/types';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// M49 numeric code → ISO-3 country code for name-based territory matching
// Used to map geo.id → a canonical country name for TerritoryMap lookups
const M49_TO_NAME: Record<number, string> = {
  4: 'Afghanistan', 8: 'Albania', 12: 'Algeria', 24: 'Angola', 36: 'Australia',
  40: 'Austria', 31: 'Azerbaijan', 44: 'Bahamas', 56: 'Belgium', 68: 'Bolivia',
  70: 'Bosnia', 72: 'Botswana', 76: 'Brazil', 100: 'Bulgaria', 108: 'Burundi',
  120: 'Cameroon', 124: 'Canada', 140: 'Central African Republic', 152: 'Chile',
  156: 'China', 170: 'Colombia', 178: 'Republic of Congo', 180: 'DR Congo',
  191: 'Croatia', 192: 'Cuba', 208: 'Denmark', 262: 'Djibouti', 232: 'Eritrea',
  231: 'Ethiopia', 250: 'France', 266: 'Gabon', 288: 'Ghana', 300: 'Greece',
  324: 'Guinea', 624: 'Guinea-Bissau', 356: 'India', 360: 'Indonesia',
  364: 'Iran', 368: 'Iraq', 372: 'Ireland', 376: 'Israel', 380: 'Italy',
  392: 'Japan', 398: 'Kazakhstan', 404: 'Kenya', 408: 'North Korea',
  410: 'South Korea', 417: 'Kyrgyzstan', 428: 'Latvia', 430: 'Liberia',
  434: 'Libya', 440: 'Lithuania', 450: 'Madagascar', 454: 'Malawi',
  484: 'Mexico', 466: 'Mali', 504: 'Morocco', 508: 'Mozambique', 516: 'Namibia',
  528: 'Netherlands', 554: 'New Zealand', 562: 'Niger', 566: 'Nigeria',
  578: 'Norway', 586: 'Pakistan', 591: 'Panama', 598: 'Papua New Guinea',
  604: 'Peru', 608: 'Philippines', 616: 'Poland', 620: 'Portugal',
  642: 'Romania', 643: 'Russia', 646: 'Rwanda', 682: 'Saudi Arabia',
  686: 'Senegal', 694: 'Sierra Leone', 706: 'Somalia', 710: 'South Africa',
  724: 'Spain', 729: 'Sudan', 728: 'South Sudan', 752: 'Sweden', 756: 'Switzerland',
  762: 'Tajikistan', 768: 'Togo', 788: 'Tunisia', 792: 'Turkey', 800: 'Uganda',
  804: 'Ukraine', 826: 'United Kingdom', 840: 'United States', 858: 'Uruguay',
  860: 'Uzbekistan', 862: 'Venezuela', 704: 'Vietnam', 894: 'Zambia',
  716: 'Zimbabwe', 32: 'Argentina', 499: 'Montenegro', 807: 'North Macedonia',
  688: 'Serbia', 204: 'Benin', 854: 'Burkina Faso', 226: 'Equatorial Guinea',
  270: 'Gambia', 304: 'Greenland', 352: 'Iceland', 426: 'Lesotho',
  470: 'Malta', 496: 'Mongolia', 334: 'Heard Island', 336: 'Vatican City',
  384: 'Ivory Coast', 51: 'Armenia', 268: 'Georgia', 148: 'Chad',
  834: 'Tanzania', 748: 'Eswatini', 158: 'Taiwan', 674: 'San Marino',
  795: 'Turkmenistan',
};

const COUNTRY_NAME_MAP: Record<string, string> = {
  'United States of America': 'United States',
  'Russian Federation': 'Russia',
  'Democratic People\'s Republic of Korea': 'North Korea',
  'Republic of Korea': 'South Korea',
  'Lao PDR': 'Laos',
  'Czech Republic': 'Czech Republic',
  'Bosnia and Herzegovina': 'Bosnia',
  'United Kingdom': 'United Kingdom',
  'New Zealand': 'New Zealand',
  'Saudi Arabia': 'Saudi Arabia',
  'South Africa': 'South Africa',
  'Sri Lanka': 'Sri Lanka',
  'Viet Nam': 'Vietnam',
  'Iran (Islamic Republic of)': 'Iran',
  'Venezuela, Bolivarian Republic of': 'Venezuela',
  'Bolivia, Plurinational State of': 'Bolivia',
  'United Republic of Tanzania': 'Tanzania',
  "Côte d'Ivoire": 'Ivory Coast',
  'Congo, the Democratic Republic of the': 'DR Congo',
  'Dem. Rep. Congo': 'DR Congo',
  'S. Sudan': 'South Sudan',
  'Eq. Guinea': 'Equatorial Guinea',
  'Central African Rep.': 'Central African Republic',
  'Bosnia and Herz.': 'Bosnia',
  'Czechia': 'Czech Republic',
  'N. Korea': 'North Korea',
  'S. Korea': 'South Korea',
};

function matchCountry(geoName: string, geoId: number, territories: TerritoryMap | BidState): string | null {
  // Try M49 ID → canonical name first
  const m49Name = M49_TO_NAME[geoId];
  if (m49Name && territories[m49Name]) return m49Name;
  // Fall back to atlas name mapping
  const mapped = COUNTRY_NAME_MAP[geoName] ?? geoName;
  if (territories[mapped]) return mapped;
  for (const key of Object.keys(territories)) {
    if (key.startsWith(mapped + ' (') || key === mapped) return key;
  }
  return null;
}

interface WorldMapProps {
  territories?: TerritoryMap;
  bids?: BidState;
  mode?: 'territories' | 'bidding';
  height?: number;
  onCountryClick?: (gameName: string) => void;
  selectedCountry?: string;
}

export default function WorldMap({ territories = {}, bids = {}, mode = 'territories', height = 400, onCountryClick, selectedCountry }: WorldMapProps) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [isFs, setIsFs] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function getGameName(atlasName: string, geoId: number): string {
    const existingKey = matchCountry(atlasName, geoId, territories);
    return existingKey ?? (M49_TO_NAME[geoId] ?? COUNTRY_NAME_MAP[atlasName] ?? atlasName);
  }

  function getColor(geoName: string, geoId: number): string {
    const gameName = getGameName(geoName, geoId);
    if (selectedCountry && gameName === selectedCountry) return '#00d4ff55';
    if (mode === 'bidding') {
      const key = matchCountry(geoName, geoId, bids);
      const leaders = key ? (bids[key] as unknown as Array<{ color: string }>) : null;
      if (leaders && leaders.length > 0) return leaders[0].color + 'b3';
      return '#1e3a5f';
    }
    const key = matchCountry(geoName, geoId, territories);
    if (!key) return '#1a2a3a';
    const t = territories[key];
    if (!t) return '#1a2a3a';
    switch (t.status) {
      case 'active': return t.color + 'b3';
      case 'contested': return '#6b7280b3';
      case 'ungoverned': return '#374151b3';
      case 'eliminated': return '#1f2937b3';
      default: return '#1a2a3a';
    }
  }

  function getStroke(geoName: string, geoId: number): string {
    const gameName = getGameName(geoName, geoId);
    if (selectedCountry && gameName === selectedCountry) return '#00d4ff';
    if (mode === 'bidding') {
      const key = matchCountry(geoName, geoId, bids);
      const leaders = key ? (bids[key] as unknown as Array<{ color: string }>) : null;
      if (leaders && leaders.length > 0) return leaders[0].color;
      return '#1e3a5f';
    }
    const key = matchCountry(geoName, geoId, territories);
    if (!key) return '#1e3a5f';
    const t = territories[key];
    if (t?.status === 'active') return t.color;
    if (t?.status === 'contested') return '#6b7280';
    return '#374151';
  }

  function getTooltip(geoName: string, geoId: number): string {
    if (mode === 'bidding') {
      const key = matchCountry(geoName, geoId, bids);
      const leaders = key ? (bids[key] as unknown as Array<{ empireName: string; amount: number }>) : null;
      if (leaders && leaders.length > 0) {
        if (leaders.length === 1) return `${geoName} — Leader: ${leaders[0].empireName} (${leaders[0].amount} pts)`;
        return `${geoName} — ${leaders.length}-way tie at ${leaders[0].amount} pts`;
      }
      return `${geoName} — No bids`;
    }
    const key = matchCountry(geoName, geoId, territories);
    if (!key) return `${geoName} — Unclaimed`;
    const t = territories[key];
    if (!t) return `${geoName} — Unclaimed`;
    if (t.status === 'active') return `${geoName}\n${t.empire}\nLed by ${t.leader}`;
    return `${geoName} — ${t.status}`;
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        height: isFs ? '100vh' : height,
        background: isFs ? 'var(--bg)' : 'transparent',
      }}
    >
      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        title={isFs ? 'Exit fullscreen' : 'Fullscreen map'}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          zIndex: 10,
          width: '1.75rem',
          height: '1.75rem',
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '0.3rem',
          color: '#ccc',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {isFs ? (
            <>
              <polyline points="8 3 3 3 3 8"/><line x1="3" y1="3" x2="10" y2="10"/>
              <polyline points="16 3 21 3 21 8"/><line x1="21" y1="3" x2="14" y2="10"/>
              <polyline points="8 21 3 21 3 16"/><line x1="3" y1="21" x2="10" y2="14"/>
              <polyline points="16 21 21 21 21 16"/><line x1="21" y1="21" x2="14" y2="14"/>
            </>
          ) : (
            <>
              <polyline points="15 3 21 3 21 9"/><line x1="21" y1="3" x2="14" y2="10"/>
              <polyline points="9 21 3 21 3 15"/><line x1="3" y1="21" x2="10" y2="14"/>
              <polyline points="21 15 21 21 15 21"/><line x1="21" y1="21" x2="14" y2="14"/>
              <polyline points="3 9 3 3 9 3"/><line x1="3" y1="3" x2="10" y2="10"/>
            </>
          )}
        </svg>
      </button>

      <ComposableMap
        projectionConfig={{ scale: 130 }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map(geo => {
              const name = geo.properties.name;
              const geoId = parseInt(geo.id as string, 10);
              const color = getColor(name, geoId);
              const stroke = getStroke(name, geoId);
              const clickable = !!onCountryClick;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={color}
                  stroke={stroke}
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: clickable ? '#00d4ff33' : stroke, outline: 'none', cursor: clickable ? 'pointer' : 'default' },
                    pressed: { outline: 'none' },
                  }}
                  onMouseEnter={(evt) => {
                    setTooltip({ text: getTooltip(name, geoId), x: evt.clientX, y: evt.clientY });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseMove={(evt) => {
                    setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : null);
                  }}
                  onClick={() => {
                    if (onCountryClick) onCountryClick(getGameName(name, geoId));
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-2 text-xs rounded shadow-lg whitespace-pre-line"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontFamily: 'var(--font-body)',
            maxWidth: 200,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
