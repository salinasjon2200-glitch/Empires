'use client';
import { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { TerritoryMap, Bid, BidState } from '@/lib/types';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Map from world-atlas country names to our game country names
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
};

function matchCountry(geoName: string, territories: TerritoryMap | BidState): string | null {
  const mapped = COUNTRY_NAME_MAP[geoName] ?? geoName;
  // Direct match
  if (territories[mapped]) return mapped;
  // Partial match for split territories (e.g., "United States (West)")
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
}

export default function WorldMap({ territories = {}, bids = {}, mode = 'territories', height = 400 }: WorldMapProps) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  function getColor(geoName: string): string {
    if (mode === 'bidding') {
      const key = matchCountry(geoName, bids);
      if (key && bids[key]) return (bids[key] as any).color + 'b3';
      return '#1e3a5f';
    }
    const key = matchCountry(geoName, territories);
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

  function getStroke(geoName: string): string {
    if (mode === 'bidding') {
      const key = matchCountry(geoName, bids);
      if (key && bids[key]) return (bids[key] as any).color;
      return '#1e3a5f';
    }
    const key = matchCountry(geoName, territories);
    if (!key) return '#1e3a5f';
    const t = territories[key];
    if (t?.status === 'active') return t.color;
    if (t?.status === 'contested') return '#6b7280';
    return '#374151';
  }

  function getTooltip(geoName: string): string {
    if (mode === 'bidding') {
      const key = matchCountry(geoName, bids);
      if (key && bids[key]) {
        const b = bids[key] as any;
        return `${geoName} — Leader: ${b.empireName} (${b.amount} pts)`;
      }
      return `${geoName} — No bids`;
    }
    const key = matchCountry(geoName, territories);
    if (!key) return `${geoName} — Unclaimed`;
    const t = territories[key];
    if (!t) return `${geoName} — Unclaimed`;
    if (t.status === 'active') return `${geoName}\n${t.empire}\nLed by ${t.leader}`;
    return `${geoName} — ${t.status}`;
  }

  return (
    <div className="relative" style={{ height }}>
      <ComposableMap
        projectionConfig={{ scale: 130 }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map(geo => {
              const name = geo.properties.name;
              const color = getColor(name);
              const stroke = getStroke(name);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={color}
                  stroke={stroke}
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: stroke, outline: 'none', cursor: 'pointer' },
                    pressed: { outline: 'none' },
                  }}
                  onMouseEnter={(evt) => {
                    setTooltip({ text: getTooltip(name), x: evt.clientX, y: evt.clientY });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseMove={(evt) => {
                    setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : null);
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
