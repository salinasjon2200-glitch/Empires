export interface MergedLeader {
  name: string;           // leader's display name (original player name)
  originalEmpire: string; // original empire name
  weight: number;         // action weight 0–100
  passwordHash: string;   // individual password hash for this leader
}

export interface Player {
  name: string;
  empire: string;
  email?: string;
  passwordHash: string;
  color: string;
  status: 'active' | 'eliminated';
  joinedYear?: number;
  eliminatedYear?: number;
  territories: string[];
  // Merged empire fields
  isMerged?: boolean;
  leaders?: MergedLeader[];
}

export interface GameState {
  phase: 0 | 1 | 2 | 3 | 4;
  currentYear: number;
  theme: 'dark-military' | 'clean-modern';
  biddingOpen: boolean;
  biddingClosesAt?: number;
  turnOpen: boolean;
  processingComplete: boolean;
  lastTurnCompletedAt?: number;
  contentMode?: 'unrestricted' | 'school';
  joinPassword?: string;
}

export interface GameInstance {
  id: string;
  name: string;
  startYear: number;
  contentMode: 'unrestricted' | 'school';
  setupMode: 'bidding' | 'random';
  warChestPerPlayer: number;
  createdAt: number;
  status: 'active' | 'archived';
}

export interface WarChest {
  balance: number;
  threshold: number;
  contributions: Array<{
    name: string;
    amount: number;
    method: 'manual' | 'stripe' | 'deduction';
    timestamp: number;
  }>;
  lastTurnCost: number;
  lastUpdated: number;
}

export interface Territory {
  empire: string;
  leader: string;
  color: string;
  status: 'active' | 'eliminated' | 'contested' | 'ungoverned';
  since?: number;
}

export interface TerritoryMap {
  [country: string]: Territory;
}

export interface Bid {
  playerName: string;
  empireName: string;
  color: string;
  amount: number;
  placedAt: number;
}

// Each country maps to an array of tied top-bidders (all at the same amount).
// A single entry = one leader; multiple entries = a tie that will split the territory on confirm.
export interface BidState {
  [country: string]: Bid[];
}

export interface PlayerPoints {
  [playerName: string]: number;
}

export interface TurnCode {
  used: boolean;
  player: string;
  usedAt?: number;
}

export interface TurnCodes {
  [code: string]: TurnCode;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  empireName: string;
  color: string;
  text: string;
  timestamp: number;
  isGM?: boolean;
}

export interface Group {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
  createdAt: number;
}

export interface ThemeVote {
  [playerName: string]: 'dark-military' | 'clean-modern';
}

// ── Empire Statistics ────────────────────────────────────────────────────────

export type StockMarketStatus = 'Bust' | 'Bear' | 'Moderate' | 'Bull' | 'Boom';
export type SocialCohesion = 'Fractured' | 'Strained' | 'Moderate' | 'United' | 'Cohesive';
export type IntelligenceLevel = 'Blind' | 'Weak' | 'Moderate' | 'Strong' | 'Elite';
export type TrainingLevel = 'Untrained' | 'Basic' | 'Regular' | 'Veteran' | 'Elite';
export type MilitarySupply = 'Starved' | 'Depleted' | 'Sustained' | 'Well-supplied' | 'Abundant';
export type GovernmentType =
  | 'Democracy' | 'Republic' | 'Constitutional Monarchy' | 'Absolute Monarchy'
  | 'Military Junta' | 'Single-Party State' | 'Theocracy' | 'Oligarchy'
  | 'Federal Republic' | 'Technocracy' | 'Anarchy';

export interface MilitaryTechLevels {
  infantry: number;      // years relative to 2025 baseline (can be negative)
  armor: number;
  artillery: number;
  fighters: number;
  bombers: number;
  antiAir: number;
  navy: number;
  nukes: number;
  missiles: number;
  antiMissiles: number;
}

export interface MilitaryQuantities {
  infantry: number;      // in thousands
  armor: number;         // armored vehicles/tanks
  artillery: number;     // artillery pieces
  fighters: number;      // combat aircraft
  bombers: number;
  antiAir: number;       // anti-air batteries
  navy: number;          // major surface vessels
  nukes: number;
  missiles: number;
  antiMissiles: number;
}

export interface EmpireStats {
  // Identity
  empire: string;
  generatedYear: number;
  generatedAt: number;   // unix ms
  isInitial: boolean;    // true if generated via web search (post-bidding first time)

  // Economy
  gdp: number;                       // billions USD
  gdpPerCapita: number;              // thousands USD
  areaSqMiles: number;               // thousands of square miles
  population: number;                // millions
  birthRate: number;                 // per 1000 per year
  stockMarket: StockMarketStatus;
  inflationRate: number;             // percent
  socialCohesion: SocialCohesion;
  publicApproval: number;            // 0–100
  governmentType: GovernmentType;
  debt: number;                      // billions USD
  revenue: number;                   // billions USD per year
  spending: number;                  // billions USD per year
  interestRate: number;              // percent
  technologyYears: number;           // years ± relative to global average
  tradeDeficit: number;              // billions USD (negative = surplus)
  tradeSurplus: number;              // billions USD (negative = deficit)

  // Military — Quantities
  military: MilitaryQuantities;

  // Military — Tech Levels (years ± relative to 2025 baseline)
  militaryTech: MilitaryTechLevels;

  // Qualitative
  intelligence: IntelligenceLevel;
  trainingLevel: TrainingLevel;
  militarySupply: MilitarySupply;

  // Space
  spaceProgram?: string;             // free-text description, optional

  // GM notes / AI reasoning (not shown to players)
  gmNotes?: string;
}

export interface AllEmpireStats {
  [empire: string]: EmpireStats;
}
