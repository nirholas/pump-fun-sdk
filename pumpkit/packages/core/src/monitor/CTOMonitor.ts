/**
 * @pumpkit/core — CTO (Creator Transfer / Takeover) Monitor
 *
 * Detects when token creator authority is transferred to a new wallet.
 * Listens for creator-related authority change instructions.
 */

import type { Connection } from '@solana/web3.js';
import { BaseMonitor } from './BaseMonitor.js';
import { PUMP_PROGRAM_ID } from '../solana/programs.js';
import type { CTOEvent } from '../types/events.js';

export interface CTOMonitorOptions {
  connection: Connection;
  onCTO: (event: CTOEvent) => void | Promise<void>;
}

export class CTOMonitor extends BaseMonitor {
  private readonly connection: Connection;
  private readonly onCTO: CTOMonitorOptions['onCTO'];