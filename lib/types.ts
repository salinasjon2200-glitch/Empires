export interface Player {
  name: string;
  empire: string;
  email?: string;
  passwordHash: string;
  color: string;
  status: 'active' | 'eliminated';
  eliminatedYear?: number;
  territories: string[];
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
    method: 'manual' | 'stripe';
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

export interface BidState {
  [country: string]: Bid | null;
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
