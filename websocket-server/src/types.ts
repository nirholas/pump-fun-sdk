// ════════════════════════════════════════════════════════════════════
// Shared types for the PumpFun WebSocket relay
// ════════════════════════════════════════════════════════════════════

/** A parsed token launch event broadcast to browser clients */
export interface TokenLaunchEvent {
  type: 'token-launch';
  signature: string;
  time: string;        // ISO timestamp
  name: string | null;
  symbol: string | null;
  metadataUri: string | null;
  mint: string | null;
  creator: string | null;
  isV2: boolean;
  hasGithub: boolean;
  githubUrls: string[];
  imageUri: string | null;
  description: string | null;
  marketCapSol: number | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

/** Server status broadcast */
export interface ServerStatus {
  type: 'status';
  connected: boolean;
  uptime: number;       // seconds
  totalLaunches: number;
  githubLaunches: number;
  clients: number;
}

/** Heartbeat / ping */
export interface Heartbeat {
  type: 'heartbeat';
  ts: number;
}

export type RelayMessage = TokenLaunchEvent | ServerStatus | Heartbeat;
